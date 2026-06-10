// SPACEXPLORER end-to-end test suite.
// Drives the real site in headless Chrome (system install, via puppeteer-core)
// and asserts behavior: boot, data integrity, orbital accuracy, selection,
// camera, search, toggles, time controls, deep links, and numeric stability.
//
// Run: npm test

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 8643;
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// ── tiny harness ──────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else {
    failed++;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const approx = (a, b, tol) => Math.abs(a - b) <= tol;

// ── server ────────────────────────────────────────────────────────────────
function startServer() {
  const proc = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'],
    { cwd: ROOT, stdio: 'ignore' });
  return new Promise((resolve) => setTimeout(() => resolve(proc), 800));
}

// ── page helpers ──────────────────────────────────────────────────────────
async function openPage(browser, url, consoleErrors) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForFunction('window.__sx !== undefined', { timeout: 15000 });
  await page.evaluate(() => window.__sx.frame());
  return page;
}

const frames = (page, n = 1) => page.evaluate(async (k) => {
  for (let i = 0; i < k; i++) await window.__sx.frame();
}, n);

// display units → AU (inverse of the power-law compression in data.js)
const AU_FROM_UNITS = 'Math.pow(len / 62, 1 / 0.55)';

async function helioDistanceAU(page, id) {
  return page.evaluate((bodyId) => {
    const b = window.__sx.bodies.get(bodyId);
    const v = new (b.mesh.position.constructor)();
    b.mesh.getWorldPosition(v);
    const len = v.length();
    return Math.pow(len / 62, 1 / 0.55);
  }, id);
}

// ── main ──────────────────────────────────────────────────────────────────
const server = await startServer();
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-first-run', '--window-size=1440,900'],
});

try {
  const consoleErrors = [];

  console.log('\n— Boot & data integrity');
  const page = await openPage(browser, BASE, consoleErrors);

  check('app boots (body.loaded)', await page.evaluate(() => document.body.classList.contains('loaded')));
  check('WebGL canvas present', await page.evaluate(() => {
    const c = document.getElementById('scene');
    return c.width > 0 && c.height > 0;
  }));

  const integrity = await page.evaluate(() => {
    const out = { count: 0, missing: [] };
    const all = [...window.__sx.bodies.entries(), ...window.__sx.craft.entries()];
    for (const [id, b] of all) {
      out.count++;
      const d = b.data;
      if (!d.name || !d.type || !d.info || !d.fact) out.missing.push(id);
      if (!(b.update instanceof Function)) out.missing.push(`${id}:update`);
    }
    return out;
  });
  check(`all ${integrity.count} objects have name/type/info/fact/update`,
    integrity.missing.length === 0, integrity.missing.join(','));
  check('object count ≥ 42', integrity.count >= 42, `got ${integrity.count}`);
  check('new objects present (Vesta, Makemake, Haumea, Juno)', await page.evaluate(() => {
    const sx = window.__sx;
    return ['vesta', 'makemake', 'haumea'].every((id) => sx.bodies.has(id)) && sx.craft.has('juno');
  }));

  const navOk = await page.evaluate(() => {
    const items = document.querySelectorAll('.nav-item');
    return { items: items.length, search: !!document.getElementById('nav-search') };
  });
  check('navigator lists every object', navOk.items >= 35, `got ${navOk.items}`);

  const rings = await page.evaluate(() => {
    const b = window.__sx.bodies;
    return ['saturn', 'uranus', 'neptune'].map((id) => b.get(id).rings?.length || 0);
  });
  check('Saturn, Uranus, Neptune have ring meshes', rings.every((n) => n >= 1), rings.join(','));

  console.log('\n— Orbital accuracy (current date)');
  const earthAU = await helioDistanceAU(page, 'earth');
  check(`Earth at ${earthAU.toFixed(3)} AU (0.98–1.02)`, earthAU > 0.98 && earthAU < 1.02);
  const marsAU = await helioDistanceAU(page, 'mars');
  check(`Mars at ${marsAU.toFixed(2)} AU (1.38–1.67)`, marsAU > 1.38 && marsAU < 1.67);
  const plutoAU = await helioDistanceAU(page, 'pluto');
  check(`Pluto at ${plutoAU.toFixed(1)} AU (29.6–49.5)`, plutoAU > 29.6 && plutoAU < 49.5);
  const halleyAU = await helioDistanceAU(page, 'halley');
  check(`Halley at ${halleyAU.toFixed(1)} AU (30–35.5, near aphelion in 2026)`,
    halleyAU > 30 && halleyAU < 35.5);

  // one full Earth year returns Earth to the same spot
  const drift = await page.evaluate(async () => {
    const sx = window.__sx;
    const earth = sx.bodies.get('earth');
    const V = earth.mesh.position.constructor;
    sx.sim.playing = false;
    const p0 = new V();
    earth.anchor.position.clone ? p0.copy(earth.anchor.position) : null;
    sx.sim.days += 365.256; // sidereal year
    await sx.frame();
    const p1 = earth.anchor.position.clone();
    sx.sim.days -= 365.256;
    await sx.frame();
    sx.sim.playing = true;
    return p0.distanceTo(p1);
  });
  check(`Earth returns after 1 sidereal year (drift ${drift.toFixed(2)} u < 1.5)`, drift < 1.5);

  console.log('\n— Selection, camera, info panel');
  await page.evaluate(() => window.__sx.select(window.__sx.bodies.get('mars')));
  await frames(page, 3);
  // let the fly-to finish (real time)
  await new Promise((r) => setTimeout(r, 1800));
  await frames(page, 3);
  const sel = await page.evaluate(() => {
    const sx = window.__sx;
    const v = sx.camera.position.clone();
    const mars = sx.bodies.get('mars');
    const mp = mars.mesh.position.constructor === v.constructor ? mars.anchor.position : null;
    const w = mars.anchor.position.clone();
    return {
      name: document.querySelector('.info-name').textContent,
      open: document.getElementById('info-panel').classList.contains('open'),
      camDist: v.distanceTo(w),
      targetDist: sx.controls.target.distanceTo(w),
      active: document.querySelector('.nav-item.active')?.textContent,
    };
  });
  check('info panel opens with MARS', sel.open && sel.name === 'Mars', sel.name);
  check('nav item marked active', sel.active === 'Mars', String(sel.active));
  check(`camera arrives near Mars (dist ${sel.camDist.toFixed(1)} < 25)`, sel.camDist < 25);
  check(`controls target locks Mars (${sel.targetDist.toFixed(2)} < 0.5)`, sel.targetDist < 0.5);

  // click empty space deselects
  await page.mouse.click(720, 80);
  await frames(page, 2);
  check('click on empty space deselects', await page.evaluate(
    () => window.__sx.selected() === null
      && !document.getElementById('info-panel').classList.contains('open'),
  ));

  // click directly on a planet selects it
  await page.evaluate(() => window.__sx.select(window.__sx.bodies.get('earth')));
  await new Promise((r) => setTimeout(r, 1800));
  await frames(page, 2);
  await page.evaluate(() => window.__sx.deselect());
  await frames(page, 2);
  const screenPos = await page.evaluate(() => {
    const sx = window.__sx;
    const v = sx.bodies.get('earth').anchor.position.clone().project(sx.camera);
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
  });
  await page.mouse.click(screenPos.x, screenPos.y);
  await frames(page, 2);
  check('clicking a planet selects it', await page.evaluate(
    () => window.__sx.selected()?.data.id === 'earth',
  ));

  await page.keyboard.press('Escape');
  await frames(page, 2);
  check('Esc deselects', await page.evaluate(() => window.__sx.selected() === null));

  console.log('\n— Search & toggles');
  await page.type('#nav-search', 'tit');
  const visible = await page.evaluate(() => [...document.querySelectorAll('.nav-item')]
    .filter((el) => el.style.display !== 'none').map((el) => el.textContent));
  check('search "tit" → Titan, Titania', visible.length === 2 && visible.includes('Titan') && visible.includes('Titania'), visible.join(','));
  await page.evaluate(() => {
    const s = document.getElementById('nav-search');
    s.value = '';
    s.dispatchEvent(new Event('input'));
    s.blur();
  });

  await page.click('#toggle-orbits');
  const orbitsHidden = await page.evaluate(() => {
    let hidden = true;
    window.__sx.scene.traverse((o) => { if (o.userData.isOrbit && o.visible) hidden = false; });
    return hidden;
  });
  check('orbit toggle hides every orbit line', orbitsHidden);
  await page.click('#toggle-orbits');

  await page.click('#toggle-starlink');
  check('starlink toggle hides constellation', await page.evaluate(
    () => !window.__sx.craft.get('starlink').mesh.visible,
  ));
  await page.click('#toggle-starlink');

  await page.click('#toggle-labels');
  check('label toggle hides label layer', await page.evaluate(
    () => document.getElementById('label-layer').style.display === 'none',
  ));
  await page.click('#toggle-labels');

  console.log('\n— Time controls');
  const t = await page.evaluate(async () => {
    const sx = window.__sx;
    document.getElementById('btn-play').click(); // pause
    const before = sx.sim.days;
    await sx.frame(); await sx.frame();
    const paused = sx.sim.days === before;
    document.getElementById('btn-play').click(); // resume
    const slider = document.getElementById('speed-slider');
    slider.value = 100;
    slider.dispatchEvent(new Event('input'));
    const fast = sx.sim.speed;
    slider.value = 50;
    slider.dispatchEvent(new Event('input'));
    sx.sim.days += 5000;
    document.getElementById('btn-now').click();
    const nowDelta = Math.abs(sx.sim.days - (Date.now() - Date.UTC(2000, 0, 1, 12)) / 86400000);
    return { paused, fast, nowDelta };
  });
  check('pause freezes simulation time', t.paused);
  check(`speed slider max = 100 days/s (got ${t.fast.toFixed(0)})`, approx(t.fast, 100, 1));
  check('NOW returns to the present', t.nowDelta < 0.01);

  // reverse time
  const rev = await page.evaluate(async () => {
    const sx = window.__sx;
    document.getElementById('btn-reverse').click();
    const before = sx.sim.days;
    await new Promise((r) => setTimeout(r, 300));
    const wentBack = sx.sim.days < before;
    document.getElementById('btn-reverse').click(); // forward again
    return { wentBack, dir: sx.sim.dir };
  });
  check('reverse button runs time backwards', rev.wentBack && rev.dir === 1);

  // date jump: Halley was near perihelion (0.59 AU) in Feb 1986
  const halley86 = await page.evaluate(async () => {
    const input = document.getElementById('date-input');
    input.value = '1986-02-09';
    input.dispatchEvent(new Event('change'));
    await window.__sx.frame();
    const b = window.__sx.bodies.get('halley');
    const v = b.mesh.position;
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    const au = Math.pow(len / 62, 1 / 0.55);
    const label = document.getElementById('date-label').textContent;
    document.getElementById('btn-now').click();
    return { au, label };
  });
  check(`date jump to 1986 → Halley at perihelion (${halley86.au.toFixed(2)} AU < 0.9)`,
    halley86.au < 0.9, `label: ${halley86.label}`);
  check('date label reflects the jump', halley86.label.startsWith('1986-02-09'));

  console.log('\n— Numeric stability under stress');
  const stable = await page.evaluate(async () => {
    const sx = window.__sx;
    sx.sim.speed = 100;
    for (let i = 0; i < 60; i++) { sx.sim.days += 50; await sx.frame(); }
    let finite = Number.isFinite(sx.camera.position.x);
    for (const [, b] of sx.bodies) {
      const p = b.mesh.position;
      if (!Number.isFinite(p.x + p.y + p.z)) finite = false;
    }
    document.getElementById('btn-now').click();
    return finite;
  });
  check('positions stay finite after +3000 days of fast-forward', stable);

  console.log('\n— Keyboard, help & labels');
  await page.keyboard.press('ArrowRight');
  await frames(page, 2);
  check('ArrowRight selects first object (Sun)', await page.evaluate(
    () => window.__sx.selected()?.data.id === 'sun',
  ));
  await page.keyboard.press('ArrowRight');
  await frames(page, 2);
  check('ArrowRight again advances (Mercury)', await page.evaluate(
    () => window.__sx.selected()?.data.id === 'mercury',
  ));
  await page.keyboard.press('ArrowLeft');
  await frames(page, 2);
  check('ArrowLeft goes back (Sun)', await page.evaluate(
    () => window.__sx.selected()?.data.id === 'sun',
  ));
  await page.keyboard.press('Escape');

  await page.keyboard.press('?');
  check('? opens help overlay', await page.evaluate(
    () => document.getElementById('help-overlay').classList.contains('open'),
  ));
  await page.keyboard.press('Escape');
  check('Esc closes help overlay', await page.evaluate(
    () => !document.getElementById('help-overlay').classList.contains('open'),
  ));

  const overlaps = await page.evaluate(async () => {
    await window.__sx.frame();
    const rects = [...document.querySelectorAll('.label')]
      .filter((el) => el.style.display !== 'none' && el.offsetParent !== null)
      .map((el) => el.getBoundingClientRect());
    let n = 0;
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        if (a.left < b.right - 2 && a.right > b.left + 2
          && a.top < b.bottom - 2 && a.bottom > b.top + 2) n++;
      }
    }
    return { n, visible: rects.length };
  });
  check(`no overlapping labels (${overlaps.visible} visible, ${overlaps.n} collisions)`, overlaps.n === 0);

  console.log('\n— Grand Tour');
  await page.click('#btn-tour');
  await frames(page, 2);
  const tourStart = await page.evaluate(() => ({
    active: window.__sx.tour.active,
    selected: window.__sx.selected()?.data.id,
    banner: document.getElementById('tour-banner').classList.contains('open'),
    step: document.getElementById('tour-step').textContent,
  }));
  check('tour starts at the Sun with banner', tourStart.active && tourStart.selected === 'sun'
    && tourStart.banner && tourStart.step.startsWith('1 /'), JSON.stringify(tourStart));

  await page.click('#tour-next');
  await frames(page, 2);
  check('tour next advances to Mercury', await page.evaluate(
    () => window.__sx.selected()?.data.id === 'mercury',
  ));

  // manual selection exits the tour
  await page.evaluate(() => document.querySelectorAll('.nav-item')[5].click());
  await frames(page, 2);
  check('manual selection exits the tour', await page.evaluate(
    () => !window.__sx.tour.active
      && !document.getElementById('tour-banner').classList.contains('open'),
  ));
  await page.keyboard.press('Escape');
  await frames(page, 2);

  console.log('\n— Performance');
  const fps = await page.evaluate(async () => {
    let n = 0;
    const t0 = performance.now();
    await new Promise((res) => {
      const tick = () => {
        n++;
        if (performance.now() - t0 < 1500) requestAnimationFrame(tick); else res();
      };
      requestAnimationFrame(tick);
    });
    return n / ((performance.now() - t0) / 1000);
  });
  // headless Chrome renders on SwiftShader (software GL) — a real GPU is
  // far faster, so this is a regression tripwire, not the 60fps product bar
  check(`headless FPS ${fps.toFixed(0)} ≥ 12 (software GL floor)`, fps >= 12);

  console.log('\n— Deep links');
  const page2 = await openPage(browser, `${BASE}/?focus=saturn`, consoleErrors);
  const deep = await page2.evaluate(() => {
    const sx = window.__sx;
    const sat = sx.bodies.get('saturn');
    return {
      id: sx.selected()?.data.id,
      camDist: sx.camera.position.distanceTo(sat.anchor.position),
      name: document.querySelector('.info-name').textContent,
    };
  });
  check('?focus=saturn selects Saturn', deep.id === 'saturn');
  check(`camera lands at Saturn (dist ${deep.camDist.toFixed(1)} < 40)`, deep.camDist < 40);
  await page2.close();

  console.log('\n— Console cleanliness');
  check('zero console/page errors across all tests', consoleErrors.length === 0,
    consoleErrors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  server.kill();
}

console.log(`\n${'─'.repeat(50)}\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('Failures:\n' + failures.map((f) => `  • ${f}`).join('\n'));
  process.exit(1);
}
