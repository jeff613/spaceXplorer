import * as THREE from 'three';
import { J2000, displayLenToAU } from './data.js';
import { FINNHUB_KEY } from './config.js';

// ─── Object navigator ─────────────────────────────────────────────────────

export function buildNavigator(bodies, craft, onSelect) {
  const list = document.getElementById('nav-list');
  const groups = [
    { title: 'Star', ids: ['sun'] },
    {
      title: 'Planets & Moons',
      ids: ['mercury', 'venus', 'earth', 'moon', 'mars', 'phobos', 'deimos', 'jupiter',
        'io', 'europa', 'ganymede', 'callisto', 'saturn', 'titan', 'enceladus', 'rhea',
        'iapetus', 'uranus', 'miranda', 'titania', 'oberon', 'neptune', 'triton'],
    },
    {
      title: 'Dwarfs, Asteroids & Comets',
      ids: ['ceres', 'vesta', 'pallas', 'bennu', 'apophis', 'pluto', 'charon', 'eris', 'makemake', 'haumea',
        'sedna', 'arrokoth', 'halley', 'churyumov', 'neowise'],
    },
    {
      title: 'Spacecraft',
      ids: ['iss', 'dragon', 'starship', 'tiangong', 'hubble', 'starlink', 'gps', 'geo', 'jwst', 'gaia', 'soho', 'danuri', 'lro',
        'akatsuki', 'tgo', 'marsexpress', 'mro', 'perseverance', 'curiosity', 'juno', 'clipper', 'cassini', 'parker',
        'roadster', 'newhorizons', 'pioneer10', 'pioneer11',
        'voyager1', 'voyager2'],
    },
    { title: 'SpaceX Launch Sites', ids: ['starbase', 'lc39a', 'slc4e'] },
  ];
  const items = new Map();
  const headers = [];

  for (const group of groups) {
    const h = document.createElement('div');
    h.className = 'nav-group';
    h.textContent = group.title;
    list.appendChild(h);
    const groupItems = [];
    headers.push({ el: h, items: groupItems });
    for (const id of group.ids) {
      const body = bodies.get(id) || craft.get(id);
      if (!body) continue;
      const el = document.createElement('button');
      el.className = 'nav-item';
      if (body.data.parent && !body.data.kind) el.classList.add('nav-moon');
      el.textContent = body.data.name;
      el.addEventListener('click', () => onSelect(body));
      list.appendChild(el);
      items.set(id, el);
      groupItems.push({ name: body.data.name.toLowerCase(), el });
    }
  }

  // live filter
  // ticker easter egg: SPCX finds the only SpaceX hardware on a permanent solar orbit
  const ALIASES = { spcx: 'tesla roadster' };
  const search = document.getElementById('nav-search');
  search.addEventListener('input', () => {
    const raw = search.value.trim().toLowerCase();
    const q = ALIASES[raw] ?? raw;
    for (const { el, items: gi } of headers) {
      let any = false;
      for (const it of gi) {
        const hit = !q || it.name.includes(q);
        it.el.style.display = hit ? '' : 'none';
        if (hit) any = true;
      }
      el.style.display = any ? '' : 'none';
    }
  });

  // Enter selects the first visible match
  search.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const first = [...list.querySelectorAll('.nav-item')]
      .find((el) => el.style.display !== 'none');
    if (first) {
      first.click();
      search.blur();
    }
  });

  // flat selection order for keyboard cycling
  const order = groups.flatMap((g) => g.ids)
    .map((id) => bodies.get(id) || craft.get(id))
    .filter(Boolean);

  return {
    order,
    setActive(id) {
      for (const [key, el] of items) el.classList.toggle('active', key === id);
    },
  };
}

// ─── Info panel ───────────────────────────────────────────────────────────

const panel = () => document.getElementById('info-panel');

export function showInfo(body) {
  const p = panel();
  p.querySelector('.info-name').textContent = body.data.name;
  p.querySelector('.info-type').textContent = body.data.type;
  const rows = p.querySelector('.info-rows');
  rows.innerHTML = '';
  for (const [k, v] of Object.entries(body.data.info || {})) {
    const row = document.createElement('div');
    row.className = 'info-row';
    row.innerHTML = `<span class="info-key"></span><span class="info-val"></span>`;
    row.querySelector('.info-key').textContent = k;
    row.querySelector('.info-val').textContent = v;
    rows.appendChild(row);
  }
  p.querySelector('.info-live').innerHTML = `
    <div class="info-row"><span class="info-key" id="live-dist-key"></span><span class="info-val" id="live-dist"></span></div>
    <div class="info-row"><span class="info-key">Light travel time</span><span class="info-val" id="live-light"></span></div>
    <div class="info-row" id="live-extra-row" style="display:none"><span class="info-key" id="live-extra-key"></span><span class="info-val" id="live-extra"></span></div>
    <div class="info-row" id="live-extra2-row" style="display:none"><span class="info-key" id="live-extra2-key"></span><span class="info-val" id="live-extra2"></span></div>
    <div class="info-row" id="live-extra3-row" style="display:none"><span class="info-key" id="live-extra3-key"></span><span class="info-val" id="live-extra3"></span></div>`;

  // size comparison vs Earth, drawn to scale
  const cmp = p.querySelector('.info-compare');
  const rKm = body.data.radiusKm;
  if (rKm && body.data.id !== 'earth') {
    const ratio = rKm / 6371;
    const big = Math.max(ratio, 1);
    const scale = 26 / big; // largest disc gets 26px radius
    const rA = Math.max(ratio * scale, 1.2);
    const rB = Math.max(1 * scale, 1.2);
    const cxA = 10 + rA;
    const cxB = cxA + rA + rB + 24;
    const label = ratio >= 1
      ? `${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}× Earth's radius`
      : `${(ratio).toFixed(ratio < 0.01 ? 3 : 2)}× Earth's radius`;
    cmp.innerHTML = `
      <svg width="270" height="64" viewBox="0 0 270 64">
        <circle cx="${cxA}" cy="32" r="${rA.toFixed(1)}" fill="rgba(255,179,71,0.7)" />
        <circle cx="${cxB}" cy="32" r="${rB.toFixed(1)}" fill="rgba(127,214,255,0.7)" />
        <text x="${cxB + rB + 8}" y="36" fill="#8696a6" font-size="10" font-family="Chakra Petch">Earth</text>
      </svg>
      <div class="compare-label">${label}</div>`;
    cmp.style.display = '';
  } else {
    cmp.innerHTML = '';
    cmp.style.display = 'none';
  }

  p.querySelector('.info-fact').textContent = body.data.fact || '';
  p.classList.add('open');
}

export function hideInfo() {
  panel().classList.remove('open');
}

// ─── Floating labels ──────────────────────────────────────────────────────

export function createLabels(bodies, craft, onSelect) {
  const layer = document.getElementById('label-layer');
  const entries = [];
  const tmp = new THREE.Vector3();
  const camPos = new THREE.Vector3();

  const add = (body, cls) => {
    const el = document.createElement('button');
    el.className = `label ${cls}`;
    el.textContent = body.data.name;
    el.addEventListener('click', () => onSelect(body));
    layer.appendChild(el);
    entries.push({ body, el });
  };

  for (const [id, body] of bodies) {
    add(body, id === 'sun' ? 'label-sun' : body.data.parent ? 'label-moon' : 'label-planet');
  }
  for (const [, body] of craft) {
    if (!body.isCloud) add(body, 'label-craft');
  }

  // priority for collision resolution: lower wins a contested spot
  const priorityOf = (body, selectedId) => {
    if (body.data.id === selectedId) return 0;
    if (body.data.id === 'sun') return 1;
    if (body.data.parent) return 4;
    if (body.data.kind) return 3;
    return 2; // planets, dwarfs, comets
  };

  let visible = true;
  return {
    setVisible(v) { visible = v; layer.style.display = v ? '' : 'none'; },
    update(camera, width, height, selectedId = null) {
      if (!visible) return;
      camera.getWorldPosition(camPos);
      const candidates = [];
      for (const entry of entries) {
        const { body, el } = entry;
        body.mesh.getWorldPosition(tmp);
        const dist = camPos.distanceTo(tmp);
        // moons + small craft only get labels up close, to avoid clutter
        const nearOnly = body.data.parent || ['orbiter', 'lagrange', 'surface'].includes(body.data.kind);
        if (nearOnly && dist > 110) { el.style.display = 'none'; continue; }
        tmp.project(camera);
        if (tmp.z > 1 || tmp.x < -1.05 || tmp.x > 1.05 || tmp.y < -1.05 || tmp.y > 1.05) {
          el.style.display = 'none';
          continue;
        }
        candidates.push({
          entry,
          sx: (tmp.x * 0.5 + 0.5) * width,
          sy: (-tmp.y * 0.5 + 0.5) * height,
          dist,
          pri: priorityOf(body, selectedId),
        });
      }

      // greedy collision-aware placement: high priority + nearer first
      candidates.sort((a, b) => a.pri - b.pri || a.dist - b.dist);
      const placed = [];
      for (const c of candidates) {
        const el = c.entry.el;
        if (!c.entry.w) c.entry.w = el.offsetWidth || c.entry.body.data.name.length * 7 + 10;
        const w = c.entry.w;
        const x0 = c.sx - w / 2;
        const y0 = c.sy - 32;
        const x1 = x0 + w;
        const y1 = y0 + 18;
        const hit = placed.some((p) => x0 < p.x1 && x1 > p.x0 && y0 < p.y1 && y1 > p.y0);
        if (hit) { el.style.display = 'none'; continue; }
        placed.push({ x0, y0, x1, y1 });
        el.style.display = '';
        el.style.left = `${c.sx}px`;
        el.style.top = `${c.sy}px`;
      }
    },
  };
}

// ─── Time controls ────────────────────────────────────────────────────────

export function setupTimeControls(sim, sound) {
  const playBtn = document.getElementById('btn-play');
  const nowBtn = document.getElementById('btn-now');
  const reverseBtn = document.getElementById('btn-reverse');
  const slider = document.getElementById('speed-slider');
  const speedLabel = document.getElementById('speed-label');
  const dateLabel = document.getElementById('date-label');
  const dateInput = document.getElementById('date-input');

  const REALTIME = 1 / 86400; // one real second per second, in days/s

  // Two log-linear segments: left half spans real time → 1 day/s (the
  // default, at v=50), right half spans 1 → 100 days/s. v=0 is exactly
  // real time, so the leftmost stop literally runs the clock at 1 s/s.
  const sliderToSpeed = (v) =>
    v <= 50
      ? REALTIME * Math.pow(86400, v / 50) // real time → 1 day/s
      : Math.pow(10, (v - 50) / 25); //          1 → 100 days/s

  const fmtSpeed = (dps) => {
    if (dps >= 1) return `${dps >= 10 ? Math.round(dps) : dps.toFixed(1)} days/s`;
    const hps = dps * 24;
    if (hps >= 1) return `${hps.toFixed(1)} hrs/s`;
    const mps = hps * 60;
    if (mps >= 1) return `${mps.toFixed(0)} min/s`;
    const sps = mps * 60;
    if (sps < 1.005) return 'real time'; // 1 s/s
    return `${sps < 10 ? sps.toFixed(1) : Math.round(sps)} sec/s`;
  };

  const apply = () => {
    sim.speed = sliderToSpeed(Number(slider.value));
    speedLabel.textContent = fmtSpeed(sim.speed);
  };
  slider.addEventListener('input', apply);
  apply();

  playBtn.addEventListener('click', () => {
    sim.playing = !sim.playing;
    playBtn.textContent = sim.playing ? '❚❚' : '▶';
    playBtn.title = sim.playing ? 'Pause' : 'Play';
  });

  nowBtn.addEventListener('click', () => {
    sim.days = (Date.now() - J2000) / 86400000;
  });

  reverseBtn.addEventListener('click', () => {
    sim.dir = -sim.dir;
    reverseBtn.classList.toggle('on', sim.dir < 0);
    reverseBtn.title = sim.dir < 0 ? 'Time running backwards — click for forwards' : 'Reverse time';
  });

  // jump to any date (e.g. 1986 for Halley's last visit, 2061 for the next)
  dateInput.addEventListener('change', () => {
    if (!dateInput.value) return;
    const [y, m, d] = dateInput.value.split('-').map(Number);
    sim.days = (Date.UTC(y, m - 1, d, 12) - J2000) / 86400000;
  });

  // SPCX IPO: Nasdaq market open, June 12 2026, 9:30 ET (13:30 UTC).
  // Runs on wall-clock time — time-travel never moves this clock.
  const IPO_MS = Date.UTC(2026, 5, 12, 13, 30);
  const ipoBadge    = document.getElementById('ipo-countdown');
  const ipoLabel    = document.getElementById('ipo-label');
  const ipoCells    = document.getElementById('ipo-cells');
  const ipoPrice    = document.getElementById('ipo-price');
  const ipoPriceVal = document.getElementById('ipo-price-val');
  const ipoPriceChg = document.getElementById('ipo-price-change');
  const ipoEls = {
    days: document.getElementById('ipo-days'),
    hrs:  document.getElementById('ipo-hrs'),
    min:  document.getElementById('ipo-min'),
    sec:  document.getElementById('ipo-sec'),
  };
  const pad2 = (n) => String(n).padStart(2, '0');
  let prevDelta = null;
  let celebrated = false;
  let pricePollingStarted = false;
  let priceLoaded = false; // first real quote received → swap cells for the price

  function startPricePolling() {
    // No real key yet → cells keep ticking T+ elapsed; don't make doomed requests.
    if (FINNHUB_KEY === 'YOUR_FINNHUB_KEY') return;
    const fetchPrice = async () => {
      try {
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=SPCX&token=${FINNHUB_KEY}`);
        const { c, d, dp } = await r.json();
        if (!c) return;
        ipoPriceVal.textContent = `$${c.toFixed(2)}`;
        priceLoaded = true;
        // d/dp are null on listing day (no previous close) — price still shows
        if (d != null && dp != null) {
          const sign = d >= 0 ? '▲' : '▼';
          ipoPriceChg.textContent = `${sign} ${Math.abs(d).toFixed(2)} (${dp >= 0 ? '+' : ''}${dp.toFixed(2)}%)`;
          ipoPriceChg.className = d >= 0 ? 'up' : 'down';
        }
      } catch { /* network/JSON hiccup — keep last price on screen */ }
    };
    fetchPrice();
    setInterval(fetchPrice, 15000);
  }

  return {
    updateDate() {
      const simMs = J2000 + sim.days * 86400000;
      const d = new Date(simMs);
      dateLabel.textContent = d.toISOString().slice(0, 10) + '  ' + d.toISOString().slice(11, 16) + ' UTC';

      const delta = IPO_MS - Date.now();
      const s = Math.abs(delta) / 1000;
      const live = delta <= 0;

      ipoLabel.textContent = live
        ? '★ SPCX is Live · Trading on Nasdaq'
        : 'Explore Space While Waiting for SPCX';

      // cells tick down pre-IPO and tick T+ elapsed until the first quote lands
      const showPrice = live && priceLoaded;
      if (!showPrice) {
        ipoEls.days.textContent = pad2(Math.floor(s / 86400));
        ipoEls.hrs.textContent  = pad2(Math.floor((s % 86400) / 3600));
        ipoEls.min.textContent  = pad2(Math.floor((s % 3600) / 60));
        ipoEls.sec.textContent  = pad2(Math.floor(s % 60));
      }

      ipoCells.style.display = showPrice ? 'none' : 'flex';
      ipoPrice.style.display = showPrice ? 'flex' : 'none';
      ipoBadge.classList.toggle('live', live);

      if (live && !pricePollingStarted) {
        pricePollingStarted = true;
        startPricePolling();
      }

      // one-time flourish when the real clock crosses T-0 while you're watching
      if (prevDelta !== null && prevDelta > 0 && delta <= 0 && !celebrated) {
        celebrated = true;
        ipoBadge.classList.add('celebrate');
        sound?.celebrate();
        setTimeout(() => ipoBadge.classList.remove('celebrate'), 6000);
      }
      prevDelta = delta;
    },
  };
}

// ─── View toggles ─────────────────────────────────────────────────────────

export function setupToggles(handlers) {
  for (const [id, fn] of Object.entries(handlers)) {
    const el = document.getElementById(id);
    el.addEventListener('change', () => fn(el.checked));
  }
}


// ─── Live distance readout ────────────────────────────────────────────────
// Real positions are recovered from display space: direction is preserved
// by the compression, so realPos = dir * trueAU.

const _ra = new THREE.Vector3();
const _rb = new THREE.Vector3();
const _rc = new THREE.Vector3();

function realAU(worldPos, target) {
  const len = worldPos.length();
  if (len === 0) return target.set(0, 0, 0);
  return target.copy(worldPos).multiplyScalar(displayLenToAU(len) / len);
}

function fmtLight(seconds) {
  if (seconds < 90) return `${seconds.toFixed(1)} s`;
  if (seconds < 5400) return `${(seconds / 60).toFixed(1)} min`;
  return `${(seconds / 3600).toFixed(1)} hours`;
}

export function updateLiveStats(body, earth, mars, sim) {
  const distEl = document.getElementById('live-dist');
  if (!distEl || !body) return;
  body.mesh.getWorldPosition(_ra);
  realAU(_ra, _ra);
  let dAU;
  if (body.data.id === 'earth') {
    document.getElementById('live-dist-key').textContent = 'Distance from Sun (now)';
    dAU = _ra.length();
  } else {
    document.getElementById('live-dist-key').textContent = 'Distance from Earth (now)';
    realAU(earth.anchor.position, _rb);
    dAU = _ra.distanceTo(_rb);
  }
  // the Moon gets a live phase readout from real geometry
  const extraRow = document.getElementById('live-extra-row');
  if (body.data.id === 'moon') {
    const toSun = _ra.clone().negate().normalize();
    const toEarth = _rb.clone().sub(_ra).normalize();
    const illum = (1 + toSun.dot(toEarth)) / 2;
    // waxing if the moon trails the sun in geocentric longitude
    const moonLon = Math.atan2(-(_ra.z - _rb.z), _ra.x - _rb.x);
    const sunLon = Math.atan2(_rb.z, -_rb.x);
    const waxing = ((moonLon - sunLon + Math.PI * 2) % (Math.PI * 2)) < Math.PI;
    let name;
    if (illum < 0.04) name = 'New Moon';
    else if (illum > 0.96) name = 'Full Moon';
    else if (illum > 0.45 && illum < 0.55) name = waxing ? 'First Quarter' : 'Last Quarter';
    else if (illum < 0.5) name = waxing ? 'Waxing Crescent' : 'Waning Crescent';
    else name = waxing ? 'Waxing Gibbous' : 'Waning Gibbous';
    document.getElementById('live-extra-key').textContent = 'Phase (now)';
    document.getElementById('live-extra').textContent = `${name} · ${(illum * 100).toFixed(0)}% lit`;
    extraRow.style.display = '';
  } else if (extraRow) {
    extraRow.style.display = 'none';
  }

  // Where is Starman? The Roadster gets live speed, Mars range, and the
  // running count of how many times it has out-driven its warranty.
  const extra2 = document.getElementById('live-extra2-row');
  const extra3 = document.getElementById('live-extra3-row');
  if (body.data.id === 'roadster' && mars && sim) {
    // heliocentric speed from vis-viva (a = 1.325 AU, its orbital element)
    const rAU = _ra.length();
    const k = 0.01720209895; // Gaussian gravitational constant, AU^1.5/day
    const vKms = k * Math.sqrt(Math.max(0, 2 / rAU - 1 / 1.325)) * 149597870.7 / 86400;
    document.getElementById('live-extra-key').textContent = 'Speed (now)';
    document.getElementById('live-extra').textContent =
      `${(vKms * 3600).toLocaleString('en-US', { maximumFractionDigits: 0 })} km/h`;
    extraRow.style.display = '';
    realAU(mars.anchor.position, _rc);
    document.getElementById('live-extra2-key').textContent = 'Distance from Mars (now)';
    document.getElementById('live-extra2').textContent = `${_ra.distanceTo(_rc).toFixed(2)} AU`;
    extra2.style.display = '';
    // odometer estimate: mean orbital speed × time since the FH demo launch
    const simMs = J2000 + sim.days * 86400000;
    const days = Math.max(0, (simMs - Date.UTC(2018, 1, 6, 20, 45)) / 86400000);
    const warranties = days * (2 * Math.PI * 1.325 * 149597870.7 / 557) / 1.609344 / 36000;
    document.getElementById('live-extra3-key').textContent = 'Warranty exceeded (est.)';
    document.getElementById('live-extra3').textContent =
      `${Math.floor(warranties).toLocaleString('en-US')}× the 36,000-mile plan`;
    extra3.style.display = '';
  } else {
    if (extra2) extra2.style.display = 'none';
    if (extra3) extra3.style.display = 'none';
  }

  const km = dAU * 149597870;
  const kmTxt = km >= 1e9 ? `${(km / 1e9).toFixed(2)} billion km` : `${Math.round(km).toLocaleString('en-US')} km`;
  distEl.textContent = `${dAU >= 0.01 ? dAU.toFixed(2) : dAU.toFixed(4)} AU (${kmTxt})`;
  document.getElementById('live-light').textContent = fmtLight(dAU * 499.005);
}
