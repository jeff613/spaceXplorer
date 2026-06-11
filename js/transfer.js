import * as THREE from 'three';
import { PLANETS, scaleDistance, J2000 } from './data.js';
import { keplerPosition } from './bodies.js';
import { makeStarship } from './spacecraft.js';

const DEG = Math.PI / 180;
const earthEl = PLANETS.find((p) => p.id === 'earth').elements;
const marsEl = PLANETS.find((p) => p.id === 'mars').elements;
const STAGGER = 14; // days between fleet departures

// ─── Window finder ────────────────────────────────────────────────────────
// Real heliocentric longitude (rad) and distance (AU): the same Kepler solve
// bodies.js uses, but uncompressed — the physics never sees display space.

function helio(el, days) {
  const n = 360 / el.period;
  let M = ((el.L0 - el.varpi + n * days) % 360) * DEG;
  if (M > Math.PI) M -= Math.PI * 2;
  if (M < -Math.PI) M += Math.PI * 2;
  const e = el.e;
  let E = M;
  for (let k = 0; k < 20; k++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-9) break;
  }
  const xv = el.a * (Math.cos(E) - e);
  const yv = el.a * Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yv, xv);
  const r = Math.sqrt(xv * xv + yv * yv);
  const wv = (el.varpi - el.Om) * DEG + v;
  const Om = el.Om * DEG;
  const i = el.i * DEG;
  const x = r * (Math.cos(Om) * Math.cos(wv) - Math.sin(Om) * Math.sin(wv) * Math.cos(i));
  const y = r * (Math.sin(Om) * Math.cos(wv) + Math.cos(Om) * Math.sin(wv) * Math.cos(i));
  return { lon: Math.atan2(y, x), r };
}

const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// time of flight (days) along a Hohmann half-ellipse between radii r1, r2
// (AU) — Kepler's third law on the transfer ellipse's semi-major axis
const transferDays = (r1, r2) => 0.5 * Math.sqrt(((r1 + r2) / 2) ** 3) * 365.25;

// Next Earth→Mars departure after fromDays: scan day by day for the moment
// Mars's actual longitude at arrival matches the point opposite Earth at
// departure. This is the phase-angle condition derived from the real radii
// at that epoch (~44° for circular orbits, 30–60° with Mars's eccentricity).
// A window recurs every synodic period (~780 days), so the scan always hits.
export function findWindow(fromDays) {
  let prev = null;
  for (let t = Math.ceil(fromDays); t < fromDays + 820; t++) {
    const e = helio(earthEl, t);
    let T = transferDays(e.r, helio(marsEl, t).r);
    T = transferDays(e.r, helio(marsEl, t + T).r); // refine with the arrival radius
    const f = wrapPi(helio(marsEl, t + T).lon - e.lon - Math.PI);
    if (prev !== null && prev > 0 && f <= 0 && prev - f < Math.PI) return { dep: t, arr: t + T };
    prev = f;
  }
  return null;
}

// ─── Transfer arc ─────────────────────────────────────────────────────────
// The half-ellipse is computed in real AU (perihelion at Earth's departure
// radius, aphelion at Mars's arrival radius), then each point is compressed
// through scaleDistance like every orbit line — the drawing inherits the
// display warp, the dates never do.

function buildArcPoints(dep, arr) {
  const p0 = keplerPosition(earthEl, dep, new THREE.Vector3());
  const p1 = keplerPosition(marsEl, arr, new THREE.Vector3());
  const r1 = helio(earthEl, dep).r;
  const r2 = helio(marsEl, arr).r;
  const a = (r1 + r2) / 2;
  const ecc = (r2 - r1) / (r2 + r1);
  const lon0 = Math.atan2(-p0.z, p0.x);
  // prograde sweep from departure to the (≈ opposite) arrival longitude
  const sweep = ((Math.atan2(-p1.z, p1.x) - lon0) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  const pts = [];
  const N = 160;
  for (let k = 0; k <= N; k++) {
    const f = k / N;
    const r = a * (1 - ecc * ecc) / (1 + ecc * Math.cos(f * Math.PI));
    const R = scaleDistance(r);
    const lon = lon0 + f * sweep;
    pts.push(new THREE.Vector3(Math.cos(lon) * R, p0.y + (p1.y - p0.y) * f, -Math.sin(lon) * R));
  }
  pts[0].copy(p0);
  pts[N].copy(p1);
  return pts;
}

// ─── Visualizer ───────────────────────────────────────────────────────────

export function createTransfer(scene, bodies, sim) {
  const caption = document.getElementById('transfer-caption');
  const group = new THREE.Group();
  group.name = 'transfer';
  group.visible = false;
  scene.add(group);

  let on = false;
  let win = null; // { dep, arr, pts }
  let arc = null;
  let ships = null;

  const fmtDate = (days) => new Date(J2000 + days * 86400000).toISOString().slice(0, 10);

  function clearArc() {
    if (!arc) return;
    group.remove(arc);
    arc.geometry.dispose();
    arc.material.dispose();
    arc = null;
  }

  function rebuild(fromDays) {
    const w = findWindow(fromDays);
    if (!w) return;
    clearArc();
    const pts = buildArcPoints(w.dep, w.arr);
    arc = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineDashedMaterial({
        color: 0xffb347, dashSize: 2.4, gapSize: 1.6, transparent: true, opacity: 0.8,
      }),
    );
    arc.computeLineDistances();
    arc.name = 'transfer-arc';
    group.add(arc);
    if (!ships) {
      ships = [0, 1, 2].map(() => {
        const s = makeStarship();
        s.scale.setScalar(1.3);
        group.add(s);
        return s;
      });
    }
    win = { ...w, pts };
    caption.textContent = `EARTH → MARS · DEPART ${fmtDate(w.dep)} · ARRIVE ${fmtDate(w.arr)}`;
  }

  const radial = new THREE.Vector3();
  const aim = new THREE.Vector3();

  // queue a ship just off a planet, nose along the orbital direction
  function park(s, i, body) {
    radial.copy(body.anchor.position).normalize();
    s.position.copy(body.anchor.position)
      .addScaledVector(radial, body.displayRadius * 1.8 + i * 0.8);
    aim.set(radial.z, 0, -radial.x).add(s.position);
    s.lookAt(aim);
  }

  function placeShips(days) {
    const span = win.arr - win.dep;
    for (let i = 0; i < ships.length; i++) {
      const s = ships[i];
      const u = (days - win.dep - i * STAGGER) / span;
      if (u <= 0) {
        park(s, i, bodies.get('earth')); // staging at Earth until departure
      } else if (u >= 1) {
        park(s, i, bodies.get('mars')); // arrived, parked off Mars
      } else {
        const k = u * u * (3 - 2 * u); // smoothstep ≈ Kepler pacing
        const x = k * (win.pts.length - 1);
        const i0 = Math.min(Math.floor(x), win.pts.length - 2);
        s.position.lerpVectors(win.pts[i0], win.pts[i0 + 1], x - i0);
        s.lookAt(win.pts[Math.min(i0 + 2, win.pts.length - 1)]);
      }
    }
  }

  return {
    setEnabled(v) {
      on = v;
      group.visible = v;
      if (v) {
        rebuild(sim.days); // always the next window after the current sim date
        if (win) placeShips(sim.days);
      } else {
        clearArc();
        win = null;
      }
      caption.classList.toggle('show', v && !!win);
    },
    update(days) {
      if (!on || !win) return;
      // time-traveled past the last ship's arrival? roll to the next window
      if (days > win.arr + STAGGER * (ships.length - 1)) rebuild(days);
      placeShips(days);
    },
    state: () => (win
      ? { dep: win.dep, arr: win.arr, depDate: fmtDate(win.dep), arrDate: fmtDate(win.arr) }
      : null),
    ships: () => ships ?? [],
  };
}
