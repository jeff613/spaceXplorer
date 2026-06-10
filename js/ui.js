import * as THREE from 'three';
import { J2000 } from './data.js';

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
      ids: ['ceres', 'vesta', 'pluto', 'charon', 'eris', 'makemake', 'haumea',
        'sedna', 'arrokoth', 'halley'],
    },
    {
      title: 'Spacecraft',
      ids: ['iss', 'hubble', 'starlink', 'gps', 'geo', 'jwst', 'juno', 'cassini',
        'parker', 'roadster', 'newhorizons', 'pioneer10', 'pioneer11',
        'voyager1', 'voyager2'],
    },
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
  const search = document.getElementById('nav-search');
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
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
        const nearOnly = body.data.parent || body.data.kind === 'orbiter' || body.data.kind === 'l2';
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

export function setupTimeControls(sim) {
  const playBtn = document.getElementById('btn-play');
  const nowBtn = document.getElementById('btn-now');
  const reverseBtn = document.getElementById('btn-reverse');
  const slider = document.getElementById('speed-slider');
  const speedLabel = document.getElementById('speed-label');
  const dateLabel = document.getElementById('date-label');
  const dateInput = document.getElementById('date-input');

  const sliderToSpeed = (v) => Math.pow(10, (v / 100) * 4 - 2); // 0.01 → 100 days/s

  const fmtSpeed = (dps) => {
    if (dps >= 1) return `${dps >= 10 ? Math.round(dps) : dps.toFixed(1)} days/s`;
    const hps = dps * 24;
    if (hps >= 1) return `${hps.toFixed(1)} hrs/s`;
    return `${(hps * 60).toFixed(0)} min/s`;
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

  return {
    updateDate() {
      const d = new Date(J2000 + sim.days * 86400000);
      dateLabel.textContent = d.toISOString().slice(0, 10) + '  ' + d.toISOString().slice(11, 16) + ' UTC';
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
