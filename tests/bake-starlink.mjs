// One-off bake script: snapshots the live Starlink constellation from
// CelesTrak into textures/starlink-shells.json for the renderer.
//
//   node tests/bake-starlink.mjs [starlink.tle]
//
// Without an argument it downloads the current GP data (TLE format) from
// celestrak.org. It parses inclination / RAAN / argument of perigee / mean
// anomaly / mean motion per satellite, clusters the constellation into its
// operational shells (altitude histogram peaks per inclination band), and
// writes per-shell summaries plus a downsampled per-sat [RAAN, phase] list
// (~1500 sats) so the site can render the real structure without runtime
// API calls. Committed for provenance — rerun to refresh the snapshot.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'textures', 'starlink-shells.json');
const URL = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle';
const MU = 398600.4418; // km^3/s^2
const EARTH_R = 6378.137; // km, equatorial
const TARGET_SATS = 1500; // rendered instances across all shells

const text = process.argv[2]
  ? fs.readFileSync(process.argv[2], 'utf8')
  : await (await fetch(URL)).text();

// ── parse TLEs ────────────────────────────────────────────────────────────
const lines = text.split(/\r?\n/);
const sats = [];
let latestEpoch = 0;
for (let i = 0; i < lines.length - 1; i++) {
  const l1 = lines[i];
  const l2 = lines[i + 1];
  if (!l1.startsWith('1 ') || !l2.startsWith('2 ')) continue;
  const mm = parseFloat(l2.slice(52, 63)); // rev/day
  const n = (mm * 2 * Math.PI) / 86400; // rad/s
  const a = Math.cbrt(MU / (n * n)); // semi-major axis, km
  sats.push({
    inc: parseFloat(l2.slice(8, 16)),
    raan: parseFloat(l2.slice(17, 25)),
    phase: (parseFloat(l2.slice(34, 42)) + parseFloat(l2.slice(43, 51))) % 360, // argp + M
    alt: a - EARTH_R,
    periodMin: 1440 / mm,
  });
  latestEpoch = Math.max(latestEpoch, parseFloat(l1.slice(18, 32)));
}

// epoch YYDDD.frac → ISO date of the snapshot
const epochDate = new Date(Date.UTC(2000 + Math.floor(latestEpoch / 1000), 0, 1)
  + ((latestEpoch % 1000) - 1) * 86400000);
const snapshot = epochDate.toISOString().slice(0, 10);

// ── cluster into shells ───────────────────────────────────────────────────
// inclination bands (split sorted inclinations where the gap exceeds 1°),
// then altitude-histogram peaks within each band; satellites more than 8 km
// from a peak are in transit (raising or deorbiting) and are left out.
sats.sort((p, q) => p.inc - q.inc);
const bands = [[sats[0]]];
for (let i = 1; i < sats.length; i++) {
  if (sats[i].inc - sats[i - 1].inc > 1) bands.push([]);
  bands.at(-1).push(sats[i]);
}

const shells = [];
for (const band of bands) {
  const hist = new Map(); // 2-km altitude bins
  for (const s of band) {
    const bin = Math.round(s.alt / 2) * 2;
    hist.set(bin, (hist.get(bin) ?? 0) + 1);
  }
  // local maxima with enough satellites to be an operational shell
  let peaks = [...hist.entries()]
    .filter(([bin, count]) => count >= 30
      && count >= (hist.get(bin - 2) ?? 0) && count >= (hist.get(bin + 2) ?? 0)
      && count > (hist.get(bin - 4) ?? 0) && count > (hist.get(bin + 4) ?? 0))
    .map(([bin]) => bin)
    .sort((p, q) => p - q);
  // merge peaks closer than 6 km (keep the busier one)
  peaks = peaks.filter((p, i) => !(i > 0 && p - peaks[i - 1] < 6
    && hist.get(p) <= hist.get(peaks[i - 1])));

  // each satellite joins its nearest peak (if within 8 km — anything
  // farther is in transit, raising or deorbiting, and is left out)
  const grouped = new Map(peaks.map((p) => [p, []]));
  for (const s of band) {
    const peak = peaks.reduce((best, p) => (
      Math.abs(s.alt - p) < Math.abs(s.alt - best) ? p : best), peaks[0] ?? Infinity);
    if (Math.abs(s.alt - peak) <= 8) grouped.get(peak).push(s);
  }
  for (const members of grouped.values()) {
    if (members.length < 60) continue;
    const mean = (key) => members.reduce((sum, s) => sum + s[key], 0) / members.length;
    shells.push({
      incDeg: Number(mean('inc').toFixed(1)),
      altKm: Math.round(mean('alt')),
      periodMin: Number(mean('periodMin').toFixed(1)),
      count: members.length,
      members,
    });
  }
}

// ── downsample, keeping the real RAAN/phase distribution ──────────────────
const kept = shells.reduce((sum, sh) => sum + sh.count, 0);
for (const sh of shells) {
  const n = Math.max(20, Math.round((sh.count / kept) * TARGET_SATS));
  sh.members.sort((p, q) => p.raan - q.raan || p.phase - q.phase);
  sh.sats = Array.from({ length: Math.min(n, sh.count) }, (_, i) => {
    const s = sh.members[Math.floor((i * sh.count) / n)];
    return [Math.round(s.raan), Math.round(s.phase)];
  });
  delete sh.members;
}

const out = {
  source: 'CelesTrak GROUP=starlink (TLE)',
  snapshot,
  totalTracked: sats.length,
  sampled: shells.reduce((sum, sh) => sum + sh.sats.length, 0),
  shells,
};
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`${OUT}: ${(fs.statSync(OUT).size / 1024).toFixed(1)} KB`);
console.log(`snapshot ${snapshot} — ${sats.length} tracked, ${out.sampled} sampled`);
for (const sh of shells) {
  console.log(`  ${sh.incDeg}° × ${sh.altKm} km: ${sh.count} sats (${sh.sats.length} sampled)`);
}
