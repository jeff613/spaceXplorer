// SPACEXPLORER end-to-end test suite.
// Drives the real site in headless Chrome (system install, via puppeteer-core)
// and asserts behavior: boot, data integrity, orbital accuracy, selection,
// camera, search, toggles, time controls, deep links, and numeric stability.
//
// Run: npm test

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.SX_TEST_PORT ?? 8643); // override when worktrees test in parallel
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
  // tests must never hit Finnhub (real clock is post-IPO, so the badge polls on
  // load once a real key is configured) — serve a canned SPCX quote instead
  await page.evaluateOnNewDocument(() => {
    const realFetch = window.fetch;
    window.fetch = (url, ...args) => String(url).includes('finnhub.io')
      ? Promise.resolve(new Response(JSON.stringify({ c: 185.42, d: 3.87, dp: 2.14 })))
      : realFetch(url, ...args);
  });
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
    const b = window.__sx.bodies.get(bodyId) ?? window.__sx.craft.get(bodyId);
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
  {
    // every image referenced in source must exist on disk and must not be
    // excluded from deploys (iter 72 found 2k stars excluded while in use)
    const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
    const src = ['js/data.js', 'js/bodies.js', 'js/spacecraft.js', 'js/main.js', 'index.html']
      .map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
    const refs = [...new Set([...src.matchAll(/'((?:textures\/)?[\w-]+\.(?:jpg|png|json))'/g)].map((m) => m[1]))];
    const missing = refs.filter((f) => !fs.existsSync(path.join(root, 'textures', f))
      && !fs.existsSync(path.join(root, f)));
    const ignore = fs.existsSync(path.join(root, '.railwayignore'))
      ? fs.readFileSync(path.join(root, '.railwayignore'), 'utf8') : '';
    const excluded = refs.filter((f) => ignore.includes(f));
    check(`all ${refs.length} referenced images exist and deploy`,
      missing.length === 0 && excluded.length === 0,
      JSON.stringify({ missing, excluded }));
  }
  const page = await openPage(browser, BASE, consoleErrors);

  check('app boots (body.loaded)', await page.evaluate(() => document.body.classList.contains('loaded')));
  check('boot splash exists and fades out after load', await page.evaluate(() => {
    const sp = document.getElementById('splash');
    if (!sp) return false;
    const cs = getComputedStyle(sp);
    return cs.opacity === '0' && cs.pointerEvents === 'none';
  }));
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
  check('object count ≥ 62', integrity.count >= 62, `got ${integrity.count}`);
  check('roster complete (dwarfs, probes, constellations, Mars fleet)', await page.evaluate(() => {
    const sx = window.__sx;
    return ['vesta', 'pallas', 'bennu', 'apophis', 'makemake', 'haumea', 'sedna', 'arrokoth', 'churyumov']
      .every((id) => sx.bodies.has(id))
      && ['juno', 'cassini', 'gps', 'geo', 'pioneer10', 'pioneer11',
        'mro', 'perseverance', 'curiosity', 'gaia', 'soho', 'dragon', 'starship'].every((id) => sx.craft.has(id));
  }));
  // rovers ride the planet's rotation; SOHO sits sunward of Earth
  const marsFleet = await page.evaluate(() => {
    const sx = window.__sx;
    const mars = sx.bodies.get('mars');
    const rover = sx.craft.get('perseverance');
    const v = rover.mesh.position.constructor;
    const roverW = new v(); rover.mesh.getWorldPosition(roverW);
    const surfDist = roverW.distanceTo(mars.anchor.position) / mars.displayRadius;
    const sohoW = new v(); sx.craft.get('soho').mesh.getWorldPosition(sohoW);
    const earthLen = sx.bodies.get('earth').anchor.position.length();
    return { surfDist, sohoInside: sohoW.length() < earthLen };
  });
  check(`Perseverance pinned to Mars surface (${marsFleet.surfDist.toFixed(2)} R)`,
    marsFleet.surfDist > 0.95 && marsFleet.surfDist < 1.1);
  // P0-3: rovers must stand on their wheels (local up = surface normal) and
  // read as tiny surface miniatures, not orbiter-sized boxes
  const roverPose = await page.evaluate(async () => {
    const THREE = await import('three');
    const sx = window.__sx;
    const mars = sx.bodies.get('mars');
    return ['perseverance', 'curiosity'].map((id) => {
      const c = sx.craft.get(id);
      c.mesh.updateWorldMatrix(true, true);
      const pos = c.mesh.getWorldPosition(new THREE.Vector3());
      const normal = pos.clone()
        .sub(mars.mesh.getWorldPosition(new THREE.Vector3())).normalize();
      const up = new THREE.Vector3(0, 1, 0)
        .applyQuaternion(c.mesh.getWorldQuaternion(new THREE.Quaternion()));
      const box = new THREE.Box3();
      const tmp = new THREE.Box3();
      c.mesh.traverse((o) => {
        if (o.isMesh && o.name !== 'pickproxy') box.union(tmp.setFromObject(o));
      });
      const s = box.getSize(new THREE.Vector3());
      return { id, upDot: +up.dot(normal).toFixed(3), size: +Math.max(s.x, s.y, s.z).toFixed(3) };
    });
  });
  check('rovers stand upright on the surface (up ∥ local normal)',
    roverPose.every((r) => r.upDot > 0.999), JSON.stringify(roverPose));
  check('rovers are surface miniatures (0.15–0.45 units, < ⅓ Mars radius)',
    roverPose.every((r) => r.size > 0.15 && r.size < 0.45), JSON.stringify(roverPose));
  check('SOHO sits sunward of Earth (L1)', marsFleet.sohoInside);
  // SpaceX launch sites: pinned to Earth's surface, riding its rotation
  const sites = await page.evaluate(async () => {
    const sx = window.__sx;
    const earth = sx.bodies.get('earth');
    const ids = ['starbase', 'lc39a', 'slc4e'];
    if (!ids.every((id) => sx.craft.has(id))) return null;
    const v = earth.anchor.position.constructor;
    const w = new v();
    const radii = ids.map((id) => {
      sx.craft.get(id).mesh.getWorldPosition(w);
      return +(w.distanceTo(earth.anchor.position) / earth.displayRadius).toFixed(3);
    });
    // advance sim time a quarter-day: the pad must move with the spin
    // but keep its surface radius
    const save = sx.sim.days;
    const before = new v();
    sx.craft.get('starbase').mesh.getWorldPosition(before);
    before.sub(earth.anchor.position);
    earth.update(save + 0.25);
    const after = new v();
    sx.craft.get('starbase').mesh.getWorldPosition(after);
    after.sub(earth.anchor.position);
    earth.update(save);
    await sx.frame();
    return {
      radii,
      moved: before.distanceTo(after) / earth.displayRadius,
      radiusAfter: after.length() / earth.displayRadius,
    };
  });
  check(`SpaceX launch sites pinned to Earth surface (${sites ? sites.radii.join(', ') : 'missing'} R)`,
    sites !== null && sites.radii.every((r) => r > 0.95 && r < 1.1));
  check(`launch sites ride Earth's rotation (moved ${(sites?.moved ?? 0).toFixed(2)} R, radius ${(sites?.radiusAfter ?? 0).toFixed(2)} R)`,
    sites !== null && sites.moved > 0.5 && sites.radiusAfter > 0.95 && sites.radiusAfter < 1.1);
  const sitePanel = await page.evaluate(async () => {
    const sx = window.__sx;
    if (!sx.craft.has('starbase')) return null;
    sx.select(sx.craft.get('starbase'));
    for (let i = 0; i < 3; i++) await sx.frame();
    const out = {
      open: document.getElementById('info-panel').classList.contains('open'),
      name: document.querySelector('.info-name').textContent,
      type: document.querySelector('.info-type').textContent,
    };
    sx.deselect();
    await sx.frame();
    return out;
  });
  check('selecting Starbase opens its Launch site panel',
    sitePanel !== null && sitePanel.open && sitePanel.name === 'Starbase'
    && sitePanel.type === 'Launch site', JSON.stringify(sitePanel));
  // LRO must circle the Moon, not the Earth
  const lro = await page.evaluate(() => {
    const sx = window.__sx;
    const v = sx.craft.get('lro').mesh.position.constructor;
    const lroW = new v(); sx.craft.get('lro').mesh.getWorldPosition(lroW);
    const moonW = new v(); sx.bodies.get('moon').mesh.getWorldPosition(moonW);
    return lroW.distanceTo(moonW) / sx.bodies.get('moon').displayRadius;
  });
  check(`LRO orbits the Moon (${lro.toFixed(2)} lunar radii, 1.2–2.2)`, lro > 1.2 && lro < 2.2);
  const danuri = await page.evaluate(() => {
    const sx = window.__sx;
    if (!sx.craft.has('danuri')) return -1;
    const v = sx.craft.get('danuri').mesh.position.constructor;
    const dW = new v(); sx.craft.get('danuri').mesh.getWorldPosition(dW);
    const moonW = new v(); sx.bodies.get('moon').mesh.getWorldPosition(moonW);
    return dW.distanceTo(moonW) / sx.bodies.get('moon').displayRadius;
  });
  check(`Danuri orbits the Moon (${danuri.toFixed(2)} lunar radii, 1.4–2.5)`,
    danuri > 1.4 && danuri < 2.5);
  const recede = await page.evaluate(async () => {
    const sx = window.__sx;
    const v1 = sx.craft.get('voyager1');
    const save = sx.sim.days;
    const auAt = (days) => {
      v1.update(days);
      const len = v1.mesh.position.length();
      return Math.pow(len / 62, 1 / 0.55); // displayLenToAU
    };
    const now = auAt(save);
    const tenYears = auAt(save + 3650);
    v1.update(save);
    await sx.frame();
    return { now: +now.toFixed(1), tenYears: +tenYears.toFixed(1) };
  });
  check(`Voyager 1 recedes with sim time (${recede.now}→${recede.tenYears} AU over 10 y)`,
    recede.tenYears - recede.now > 30 && recede.tenYears - recede.now < 42,
    JSON.stringify(recede));
  check('Tiangong present', await page.evaluate(() => window.__sx.craft.has('tiangong')));
  // SpaceX fleet must circle Earth in the LEO display band
  const spacex = await page.evaluate(() => {
    const sx = window.__sx;
    const out = {};
    for (const id of ['dragon', 'starship']) {
      if (!sx.craft.has(id)) { out[id] = -1; continue; }
      const v = sx.craft.get(id).mesh.position.constructor;
      const w = new v(); sx.craft.get(id).mesh.getWorldPosition(w);
      const earthW = new v(); sx.bodies.get('earth').mesh.getWorldPosition(earthW);
      out[id] = w.distanceTo(earthW) / sx.bodies.get('earth').displayRadius;
    }
    return out;
  });
  check(`Crew Dragon orbits Earth (${spacex.dragon.toFixed(2)} Earth radii, 1.2–2.0)`,
    spacex.dragon > 1.2 && spacex.dragon < 2.0);
  check(`Starship orbits Earth (${spacex.starship.toFixed(2)} Earth radii, 1.2–2.0)`,
    spacex.starship > 1.2 && spacex.starship < 2.0);
  // P0 (user): craft must read as models, not glowing orbs — when focused,
  // the visibility glint must be faded out and the model must have detail
  const orbCheck = await page.evaluate(async () => {
    const sx = window.__sx;
    sx.select(sx.craft.get('iss'), { instant: true });
    await sx.frame(); await sx.frame();
    const glint = sx.craft.get('iss').mesh.getObjectByName('glint');
    let meshCount = 0;
    sx.craft.get('iss').mesh.traverse((o) => { if (o.isMesh && o.material?.visible !== false) meshCount++; });
    sx.deselect();
    return { glintOpacity: glint ? glint.material.opacity : -1, meshCount };
  });
  check(`focused craft shows model not orb (glint ${orbCheck.glintOpacity.toFixed(2)} < 0.05)`,
    orbCheck.glintOpacity >= 0 && orbCheck.glintOpacity < 0.05);
  check(`craft models have real detail (${orbCheck.meshCount} parts ≥ 8)`, orbCheck.meshCount >= 8);
  const craftSizes = await page.evaluate(async () => {
    const THREE = await import('three');
    const sx = window.__sx;
    const visibleSize = (root) => {
      root.updateWorldMatrix(true, true);
      const box = new THREE.Box3();
      const tmp = new THREE.Box3();
      root.traverse((o) => {
        if (o.isMesh && o.name !== 'pickproxy' && o.material?.visible !== false) {
          box.union(tmp.setFromObject(o));
        }
      });
      const s = new THREE.Vector3();
      box.getSize(s);
      return +Math.max(s.x, s.y, s.z).toFixed(2);
    };
    // rovers are deliberately smaller (surface miniatures) — sized against
    // Mars in the rover pose check above
    return ['iss', 'roadster', 'hubble', 'jwst', 'parker', 'dragon', 'starship'].map(
      (id) => [id, visibleSize(sx.craft.get(id).mesh)],
    );
  });
  check('no craft renders speck-sized when focused (all ≥ 0.5 units)',
    craftSizes.every(([, s]) => s >= 0.5), JSON.stringify(craftSizes));
  check('Parker heat shield is matte ceramic, not bloom-white', await page.evaluate(() => {
    let ok = false;
    window.__sx.craft.get('parker').mesh.traverse((o) => {
      if (o.isMesh && o.material?.color?.r > 0.4 && o.material.color.r < 0.85
          && o.material.roughness > 0.7) ok = true;
    });
    return ok;
  }));
  // P0-7: the Roadster is a real model — curved body, spoked wheels, Starman —
  // not the old 8-part brick
  check('Roadster is a detailed model with Starman (≥ 40 parts)', await page.evaluate(() => {
    let n = 0;
    window.__sx.craft.get('roadster').mesh.traverse((o) => {
      if (o.isMesh && o.name !== 'pickproxy') n++;
    });
    return n >= 40;
  }));
  // L-point craft fly halo orbits — near, but not exactly on, the Sun-Earth line
  const halo = await page.evaluate(() => {
    const sx = window.__sx;
    const v = sx.craft.get('jwst').mesh.position.constructor;
    const jw = new v(); sx.craft.get('jwst').mesh.getWorldPosition(jw);
    const linePoint = sx.bodies.get('earth').anchor.position.clone().multiplyScalar(1.06);
    return jw.distanceTo(linePoint);
  });
  check(`JWST halo-orbits L2 (offset ${halo.toFixed(2)} in 0.1–0.8)`, halo > 0.1 && halo < 0.8);
  check('Mars Express + TGO orbit Mars (ESA fleet)', await page.evaluate(() => {
    const sx = window.__sx;
    return ['marsexpress', 'tgo'].every((id) => {
      if (!sx.craft.has(id)) return false;
      const v = sx.craft.get(id).mesh.position.constructor;
      const w = new v(); sx.craft.get(id).mesh.getWorldPosition(w);
      return w.distanceTo(sx.bodies.get('mars').anchor.position)
        < sx.bodies.get('mars').displayRadius * 4;
    });
  }));
  check('Akatsuki orbits Venus', await page.evaluate(() => {
    const sx = window.__sx;
    if (!sx.craft.has('akatsuki')) return false;
    const v = sx.craft.get('akatsuki').mesh.position.constructor;
    const ak = new v(); sx.craft.get('akatsuki').mesh.getWorldPosition(ak);
    return ak.distanceTo(sx.bodies.get('venus').anchor.position)
      < sx.bodies.get('venus').displayRadius * 5;
  }));
  const clipperAU = await helioDistanceAU(page, 'clipper');
  check(`Europa Clipper in transit at ${clipperAU.toFixed(2)} AU (0.8–3.5)`,
    clipperAU > 0.8 && clipperAU < 3.5);
  const cgAU = await helioDistanceAU(page, 'churyumov');
  check(`67P at ${cgAU.toFixed(1)} AU (within 1.2–5.7 range)`, cgAU > 1.2 && cgAU < 5.7);

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
  check('all atmospheric worlds have limb-haze shells', await page.evaluate(
    () => ['earth', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']
      .every((id) => !!window.__sx.bodies.get(id).atmosphere),
  ));
  const bands = await page.evaluate(async () => {
    const sx = window.__sx;
    // materials compile on first render — make sure Neptune has been on
    // camera before reading its patched shader
    sx.select(sx.bodies.get('neptune'), { instant: true });
    await sx.frame();
    sx.deselect();
    await sx.frame();
    return ['jupiter', 'saturn', 'uranus', 'neptune'].map((id) => {
      const sh = sx.bodies.get(id).mesh.material.userData.shader;
      return sh ? sh.uniforms.uDays.value : null;
    });
  });
  check('all four giants run the live band shader',
    bands.every((v) => typeof v === 'number' && v > 0), JSON.stringify(bands));
  const transits = await page.evaluate(async () => {
    const sx = window.__sx;
    await sx.frame();
    return ['jupiter', 'saturn'].map((id) => {
      const sh = sx.bodies.get(id).mesh.material.userData.shader;
      if (!sh?.uniforms.uMoonPos) return null;
      return sh.uniforms.uMoonPos.value.map((v) => v.length());
    });
  });
  check('Galilean transit shadows track all four moons',
    Array.isArray(transits[0]) && transits[0].length === 4 && transits[0].every((d) => d > 100),
    JSON.stringify(transits[0]));
  check('Saturn moon shadows track Titan/Enceladus/Rhea/Iapetus',
    Array.isArray(transits[1]) && transits[1].length === 4 && transits[1].every((d) => d > 100),
    JSON.stringify(transits[1]));
  const bumps = await page.evaluate(() => {
    const sx = window.__sx;
    return ['earth', 'mars', 'mercury', 'moon', 'pluto'].map((id) => {
      const m = sx.bodies.get(id).mesh.material;
      return !!m.bumpMap && m.bumpScale > 0;
    });
  });
  check('terrain bump maps on Earth, Mars, Mercury, Moon, Pluto', bumps.every(Boolean), JSON.stringify(bumps));
  const sunfx = await page.evaluate(async () => {
    const sx = window.__sx;
    await sx.frame();
    const sun = sx.bodies.get('sun');
    const rim = sun.mesh.children.find((ch) => ch.name === 'chromosphere');
    return {
      rim: !!rim,
      rimAnimated: rim ? rim.material.uniforms.time.value > 0 : false,
      limb: sun.mesh.material.fragmentShader.includes('limb darkening'),
    };
  });
  check('sun has limb darkening + animated chromosphere rim',
    sunfx.rim && sunfx.rimAnimated && sunfx.limb, JSON.stringify(sunfx));
  const film = await page.evaluate(async () => {
    const sx = window.__sx;
    await sx.frame();
    const f = sx.finishing;
    return {
      enabled: !!f?.enabled,
      simClock: f ? f.uniforms.uGrainTime.value === sx.sim.days % 1.0 : false,
    };
  });
  check('film finishing pass active with sim-time grain clock',
    film.enabled && film.simClock, JSON.stringify(film));
  const comet = await page.evaluate(async () => {
    const sx = window.__sx;
    const h = sx.bodies.get('halley');
    const coma = h.mesh.children.find((c) => c.name === 'coma');
    const p = h.mesh.geometry.attributes.position;
    let min = 1e9, max = 0;
    for (let i = 0; i < p.count; i++) {
      const r = Math.hypot(p.getX(i), p.getY(i), p.getZ(i));
      min = Math.min(min, r); max = Math.max(max, r);
    }
    const save = sx.sim.days;
    const days1986 = (Date.parse('1986-02-09T00:00Z') - Date.parse('2000-01-01T12:00Z')) / 86400000;
    h.update(days1986);
    const comaActive = coma.material.opacity;
    h.update(save);
    await sx.frame();
    return {
      dark: h.mesh.material.color.r < 0.4,
      lumpy: min / max < 0.8,
      comaActive: +comaActive.toFixed(2),
      comaIdleNow: coma.material.opacity < 0.05,
    };
  });
  check('comet nucleus is a dark lumpy body, coma swells at perihelion only',
    comet.dark && comet.lumpy && comet.comaActive > 0.3 && comet.comaIdleNow,
    JSON.stringify(comet));
  // tails are a fan, not a beam: dust spreads laterally and curves off-axis,
  // ion stays a narrower streak that reaches further anti-sunward
  const tails = await page.evaluate(async () => {
    const sx = window.__sx;
    const h = sx.bodies.get('halley');
    const save = sx.sim.days;
    const days1986 = (Date.parse('1986-02-09T00:00Z') - Date.parse('2000-01-01T12:00Z')) / 86400000;
    h.update(days1986);
    const p = h.mesh.position;
    const len = Math.hypot(p.x, p.y, p.z);
    const ax = p.x / len, ay = p.y / len, az = p.z / len; // anti-sunward axis
    const measure = (pts) => {
      const a = pts.geometry.attributes.position.array;
      const n = a.length / 3;
      let lat = 0, maxAlong = 0;
      for (let i = 0; i < n; i++) {
        const dx = a[i * 3] - p.x, dy = a[i * 3 + 1] - p.y, dz = a[i * 3 + 2] - p.z;
        const along = dx * ax + dy * ay + dz * az;
        lat += Math.hypot(dx - ax * along, dy - ay * along, dz - az * along);
        maxAlong = Math.max(maxAlong, along);
      }
      return {
        meanLat: +(lat / n).toFixed(2), maxAlong: +maxAlong.toFixed(1),
        visible: pts.visible, opacity: +pts.material.uniforms.uOpacity.value.toFixed(2),
      };
    };
    const dust = measure(h.dustTail), ion = measure(h.ionTail);
    h.update(save);
    await sx.frame();
    return { dust, ion };
  });
  check('comet dust tail at perihelion: visible broad fan with lateral spread',
    tails.dust.visible && tails.dust.opacity > 0.3 && tails.dust.meanLat > 1.5,
    JSON.stringify(tails.dust));
  check('comet ion tail at perihelion: visible, narrower than dust, reaches further',
    tails.ion.visible && tails.ion.opacity > 0.2
      && tails.ion.meanLat < tails.dust.meanLat
      && tails.ion.maxAlong > tails.dust.maxAlong,
    JSON.stringify(tails));
  const rocks = await page.evaluate(() => {
    const sx = window.__sx;
    const radiusSpread = (mesh) => {
      const p = mesh.geometry.attributes.position;
      let min = 1e9, max = 0;
      for (let i = 0; i < p.count; i++) {
        const r = Math.hypot(p.getX(i), p.getY(i), p.getZ(i));
        min = Math.min(min, r); max = Math.max(max, r);
      }
      return min / max;
    };
    return {
      bennuLumpy: radiusSpread(sx.bodies.get('bennu').mesh) < 0.8,
      vestaLumpy: radiusSpread(sx.bodies.get('vesta').mesh) < 0.8,
      phobosLumpy: radiusSpread(sx.bodies.get('phobos').mesh) < 0.8,
      deimosLumpy: radiusSpread(sx.bodies.get('deimos').mesh) < 0.8,
      ceresCraters: !!sx.bodies.get('ceres').mesh.material.bumpMap,
      erisCraters: !!sx.bodies.get('eris').mesh.material.bumpMap,
      haumeaEgg: sx.bodies.get('haumea').mesh.scale.x === 1.5,
    };
  });
  check('asteroids are irregular rocks, dwarfs cratered, Haumea egg-shaped',
    Object.values(rocks).every(Boolean), JSON.stringify(rocks));
  check('textureless moons have crater relief', await page.evaluate(
    () => ['europa', 'titan', 'triton', 'io'].every(
      (id) => !!window.__sx.bodies.get(id).mesh.material.bumpMap,
    ),
  ));
  const moonStyle = await page.evaluate(() => {
    const sx = window.__sx;
    return {
      colorMaps: ['io', 'europa', 'ganymede', 'callisto', 'titan', 'iapetus', 'triton', 'charon']
        .every((id) => !!sx.bodies.get(id).mesh.material.map),
      titanAtmosphere: sx.bodies.get('titan').mesh.children.some(
        (ch) => ch.material?.uniforms?.atmColor,
      ),
    };
  });
  check('major moons have color identity, Titan has haze shell',
    moonStyle.colorMaps && moonStyle.titanAtmosphere, JSON.stringify(moonStyle));
  check('Enceladus jets its south-polar plume', await page.evaluate(() => {
    const p = window.__sx.bodies.get('enceladus').mesh.children
      .find((ch) => ch.name === 'plume');
    return !!p && p.children.length >= 2 && p.position.y < 0;
  }));
  const binary = await page.evaluate(async () => {
    const sx = window.__sx;
    await sx.frame();
    const p = sx.bodies.get('pluto').mesh.position;
    const c = sx.bodies.get('charon').mesh.position;
    return {
      ratio: +(p.length() / c.length()).toFixed(3),
      opposite: p.dot(c) < 0,
    };
  });
  check('Pluto counter-wobbles around the Pluto–Charon barycenter',
    Math.abs(binary.ratio - 0.109) < 0.005 && binary.opposite, JSON.stringify(binary));
  const eclipse = await page.evaluate(async () => {
    const sx = window.__sx;
    const io = sx.bodies.get('io');
    const jup = sx.bodies.get('jupiter');
    const save = sx.sim.days;
    let minC = 1, maxC = 0;
    for (let d = 0; d < 1.8; d += 0.01) {
      jup.update(save + d);
      io.update(save + d);
      const c = io.mesh.material.color.r;
      minC = Math.min(minC, c);
      maxC = Math.max(maxC, c);
    }
    jup.update(save);
    io.update(save);
    await sx.frame();
    return { minC: +minC.toFixed(2), maxC: +maxC.toFixed(2) };
  });
  check('Io is eclipsed by Jupiter\'s shadow once per orbit',
    eclipse.minC < 0.35 && eclipse.maxC > 0.8, JSON.stringify(eclipse));
  check('every icon-only control is screen-reader labeled', await page.evaluate(
    () => [...document.querySelectorAll(
      'button, input[type=range], input[type=search], input[type=date]',
    )].every((el) => el.getAttribute('aria-label') || el.textContent.trim().length >= 2),
  ));
  const rmPage = await browser.newPage();
  await rmPage.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await rmPage.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 });
  await rmPage.waitForFunction(() => window.__sx && document.body.classList.contains('loaded'));
  const rmDrift = await rmPage.evaluate(async () => {
    const sx = window.__sx;
    sx.tour.start();
    await sx.frame();
    const drift = sx.controls.autoRotate;
    sx.tour.stop();
    return drift;
  });
  check('prefers-reduced-motion disables camera drift', rmDrift === false);
  await rmPage.close();
  await page.waitForFunction(
    () => window.__sx.bodies.get('earth').mesh.material.map?.image?.width === 8192,
    { timeout: 20000 },
  );
  check('Earth daymap upgrades progressively (2k paint, 8k swap)', await page.evaluate(() => {
    const e = window.__sx.bodies.get('earth');
    return e.data.texture.startsWith('2k') && e.data.textureHi.startsWith('8k')
      && e.mesh.material.map.image.width === 8192;
  }));
  await page.waitForFunction(
    () => window.__sx.scene.getObjectByName('skysphere')?.material.map?.image?.width === 8192,
    { timeout: 40000 },
  );
  check('Milky Way panorama upgrades progressively to 8k', true);
  await page.waitForFunction(
    () => ['moon', 'jupiter', 'saturn', 'mars', 'venus', 'mercury'].every(
      (id) => window.__sx.bodies.get(id).mesh.material.map?.image?.width === 4096,
    ),
    { timeout: 40000 },
  );
  check('all tour-stop worlds upgrade progressively to 4k', true);
  await page.waitForFunction(
    () => {
      const e = window.__sx.bodies.get('earth');
      const cl = e.tiltGroup.children.find((ch) => ch.material?.blending === 2 && ch.material.map);
      return cl?.material.map.image?.width === 4096;
    },
    { timeout: 40000 },
  );
  check('Earth cloud layer upgrades progressively to 4k', true);
  // P0-5 regression: mirror-smooth oceans (roughness 0) reflected the
  // RoomEnvironment's square light panels as hard-edged white blobs — the
  // ocean roughness floor must stay above mirror level, land stays matte
  await page.waitForFunction(
    () => !!window.__sx.bodies.get('earth').mesh.material.roughnessMap,
    { timeout: 20000 },
  );
  const oceanRough = await page.evaluate(() => {
    const c = window.__sx.bodies.get('earth').mesh.material.roughnessMap.image;
    const ctx = c.getContext('2d');
    const px = (u, v) => ctx.getImageData(
      Math.round(u * (c.width - 1)), Math.round(v * (c.height - 1)), 1, 1,
    ).data[1];
    // equirectangular: mid-Pacific ocean (0°N 150°W), Sahara land (20°N 10°E)
    return { ocean: px(30 / 360, 0.5), land: px(190 / 360, 70 / 180) };
  });
  check('Earth ocean roughness floored (no mirror IBL squares)',
    oceanRough.ocean >= 70 && oceanRough.land >= 200, JSON.stringify(oceanRough));
  const zoomClamp = await page.evaluate(async () => {
    const sx = window.__sx;
    sx.select(sx.bodies.get('sun'), { instant: true });
    await sx.frame();
    const sunMin = sx.controls.minDistance;
    sx.select(sx.bodies.get('jupiter'), { instant: true });
    await sx.frame();
    const jupMin = sx.controls.minDistance;
    sx.deselect();
    await sx.frame();
    return { sunMin, jupMin, idleMin: sx.controls.minDistance };
  });
  check('camera cannot zoom inside the selected body',
    zoomClamp.sunMin > 10 && zoomClamp.jupMin > 5 && zoomClamp.idleMin === 2,
    JSON.stringify(zoomClamp));
  const venusSpin = await page.evaluate(async () => {
    const sx = window.__sx;
    const v = sx.bodies.get('venus');
    const save = sx.sim.days;
    v.update(save);
    const r0 = v.mesh.rotation.y;
    v.update(save + 1);
    const r1 = v.mesh.rotation.y;
    v.update(save);
    await sx.frame();
    // cloud deck super-rotates: one day should advance ~24/96 of a turn
    return +((r1 - r0) / (Math.PI * 2)).toFixed(3);
  });
  check('Venus cloud deck super-rotates (~4-day visual spin, retrograde)',
    Math.abs(venusSpin - (-0.25)) < 0.01, String(venusSpin));
  const neb = await page.evaluate(() => {
    const g = window.__sx.scene.getObjectByName('nebulae');
    return {
      count: g ? g.children.length : 0,
      andromeda: !!g?.children.find((s) => s.name === 'andromeda'),
      farOut: g ? g.children.every((s) => s.position.length() > 4000) : false,
    };
  });
  check('starfield has nebula accents + Andromeda beyond the system',
    neb.count >= 7 && neb.andromeda && neb.farOut, JSON.stringify(neb));

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
  const bennuAU = await helioDistanceAU(page, 'bennu');
  check(`Bennu at ${bennuAU.toFixed(2)} AU (0.89–1.36 range)`, bennuAU > 0.89 && bennuAU < 1.36);
  const neowiseAU = await helioDistanceAU(page, 'neowise');
  check(`NEOWISE at ${neowiseAU.toFixed(1)} AU (outbound, 10-45)`, neowiseAU > 10 && neowiseAU < 45);
  const sednaAU = await helioDistanceAU(page, 'sedna');
  check(`Sedna at ${sednaAU.toFixed(1)} AU (76–95, approaching 2076 perihelion)`,
    sednaAU > 76 && sednaAU < 95);

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
  const cmp = await page.evaluate(() => {
    const el = document.querySelector('.info-compare');
    return { visible: el.style.display !== 'none', label: el.querySelector('.compare-label')?.textContent ?? '' };
  });
  check('size comparison shows Mars vs Earth (0.53×)', cmp.visible && cmp.label.startsWith('0.53'), cmp.label);
  check('nav item marked active', sel.active === 'Mars', String(sel.active));
  check(`camera arrives near Mars (dist ${sel.camDist.toFixed(1)} < 25)`, sel.camDist < 25);
  check(`controls target locks Mars (${sel.targetDist.toFixed(2)} < 0.5)`, sel.targetDist < 0.5);

  // P0-10: flying to a planet-orbiting craft must never arrive with the
  // parent planet blocking the view. Park the camera on the far side of the
  // parent (worst case: planet directly between camera and craft), select,
  // and assert the camera→craft segment clears the parent sphere.
  const occl = await page.evaluate(async () => {
    const THREE = await import('three');
    const sx = window.__sx;
    const wasPlaying = sx.sim.playing;
    sx.sim.playing = false; // freeze orbits — deterministic arrival geometry
    // fast orbiters ride rate-limited smooth clocks that snap to the exact
    // sim time on the first paused frame — settle that before parking
    await sx.frame();

    const worldPos = (obj) => obj.getWorldPosition(new THREE.Vector3());
    // smallest distance from the parent's center to the camera→craft segment,
    // in units of the parent's radius (< 1 ⇒ the planet occludes the craft)
    const clearance = (craftId, parentId) => {
      const parent = sx.bodies.get(parentId);
      const pPos = worldPos(parent.mesh);
      const cPos = worldPos(sx.craft.get(craftId).mesh);
      const ab = cPos.clone().sub(sx.camera.position);
      const t = THREE.MathUtils.clamp(
        pPos.clone().sub(sx.camera.position).dot(ab) / ab.lengthSq(), 0, 1);
      const closest = sx.camera.position.clone().add(ab.multiplyScalar(t));
      return closest.distanceTo(pPos) / parent.displayRadius;
    };
    // park the camera opposite the craft, offset by az radians around +Y
    const parkFarSide = (craftId, parentId, az) => {
      const parent = sx.bodies.get(parentId);
      const pPos = worldPos(parent.mesh);
      const away = pPos.clone().sub(worldPos(sx.craft.get(craftId).mesh))
        .normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), az);
      sx.camera.position.copy(pPos).add(away.multiplyScalar(parent.displayRadius * 4));
      sx.controls.target.copy(pPos);
    };

    const out = [];
    const cases = [
      ['iss', 'earth', 0, 'instant'], ['iss', 'earth', 0.6, 'instant'],
      ['iss', 'earth', -0.6, 'instant'], ['lro', 'moon', 0, 'instant'],
      ['iss', 'earth', 0, 'animated'], ['lro', 'moon', 0, 'animated'],
    ];
    for (const [craftId, parentId, az, mode] of cases) {
      parkFarSide(craftId, parentId, az);
      await sx.frame();
      sx.select(sx.craft.get(craftId), { instant: mode === 'instant' });
      if (mode === 'animated') {
        const t0 = performance.now();
        while (performance.now() - t0 < 2200) await sx.frame(); // flight is 1.4 s
      } else {
        await sx.frame();
      }
      out.push({ id: craftId, az, mode, clear: +clearance(craftId, parentId).toFixed(2) });
      sx.deselect();
      await sx.frame();
    }
    sx.sim.playing = wasPlaying;
    return out;
  });
  check('fly-to a craft from behind its parent arrives unoccluded (clearance ≥ 1.1 R)',
    occl.every((r) => r.clear >= 1.1), JSON.stringify(occl));

  // following a fast orbiter must not leave the parent whirling through the
  // view: the camera rides the orbit's rotating frame, keeping the
  // camera–parent–craft triangle rigid while the craft sweeps its orbit
  const rigid = await page.evaluate(async () => {
    const THREE = await import('three');
    const sx = window.__sx;
    const prev = { speed: sx.sim.speed, playing: sx.sim.playing };
    sx.sim.playing = false;
    await sx.frame(); // settle smooth clocks
    sx.select(sx.craft.get('iss'), { instant: true });
    await sx.frame();

    const worldPos = (obj) => obj.getWorldPosition(new THREE.Vector3());
    const geom = () => {
      const pPos = worldPos(sx.bodies.get('earth').mesh);
      const camOff = sx.camera.position.clone().sub(pPos);
      const craftOff = worldPos(sx.craft.get('iss').mesh).sub(pPos);
      return {
        angle: camOff.angleTo(craftOff), // parent-frame bearing cam↔craft
        camDist: craftOff.add(pPos).distanceTo(sx.camera.position),
      };
    };
    const start = geom();
    // default speed (1 day/s) laps ISS ~15×/s; the smooth clock caps the
    // sweep at 0.25 rad/frame — 30 sampled frames cover several radians
    sx.sim.speed = 1;
    sx.sim.playing = true;
    let maxAngleDrift = 0;
    let maxDistDrift = 0;
    for (let i = 0; i < 30; i++) {
      await sx.frame();
      const g = geom();
      maxAngleDrift = Math.max(maxAngleDrift, Math.abs(g.angle - start.angle));
      maxDistDrift = Math.max(maxDistDrift, Math.abs(g.camDist - start.camDist) / start.camDist);
    }
    sx.sim.speed = prev.speed;
    sx.sim.playing = prev.playing;
    sx.deselect();
    await sx.frame();
    return { maxAngleDrift: +maxAngleDrift.toFixed(3), maxDistDrift: +maxDistDrift.toFixed(3) };
  });
  check(`following ISS at speed keeps Earth fixed in frame (bearing drift ${rigid.maxAngleDrift} rad < 0.1)`,
    rigid.maxAngleDrift < 0.1, JSON.stringify(rigid));
  check(`following ISS at speed keeps viewing distance (drift ${(rigid.maxDistDrift * 100).toFixed(1)}% < 5%)`,
    rigid.maxDistDrift < 0.05, JSON.stringify(rigid));

  // selection highlights the orbit, deselection restores it
  const hl = await page.evaluate(async () => {
    const sx = window.__sx;
    sx.deselect(); // mars is still selected from the camera checks above
    await sx.frame();
    const line = sx.bodies.get('mars').orbitLine.material;
    const before = { color: line.color.getHex(), opacity: line.opacity };
    sx.select(sx.bodies.get('mars'), { instant: true });
    await sx.frame();
    const onSel = { color: line.color.getHex(), opacity: line.opacity };
    sx.deselect();
    await sx.frame();
    const after = { color: line.color.getHex(), opacity: line.opacity };
    return { before, onSel, after };
  });
  check('selected orbit glows amber and restores',
    hl.onSel.color === 0xffb347 && hl.onSel.opacity > hl.before.opacity
    && hl.after.color === hl.before.color && hl.after.opacity === hl.before.opacity,
    JSON.stringify(hl));

  // live readout: Voyager 1's light-time is famously ~23 hours
  await page.evaluate(() => window.__sx.select(window.__sx.craft.get('voyager1'), { instant: true }));
  await frames(page, 2);
  const live = await page.evaluate(() => ({
    dist: document.getElementById('live-dist')?.textContent ?? '',
    light: document.getElementById('live-light')?.textContent ?? '',
  }));
  const lightHours = parseFloat(live.light);
  check(`Voyager 1 live light-time ${live.light} (22–25 h)`,
    live.light.includes('hours') && lightHours > 22 && lightHours < 25, JSON.stringify(live));
  check('live distance readout shows AU + km', /AU \(.+km\)/.test(live.dist), live.dist);
  await page.evaluate(() => window.__sx.deselect());
  await frames(page, 1);

  // moon phase live readout
  const phase = await page.evaluate(async () => {
    const sx = window.__sx;
    sx.select(sx.bodies.get('moon'), { instant: true });
    await sx.frame();
    const txt = document.getElementById('live-extra').textContent;
    const visible = document.getElementById('live-extra-row').style.display !== 'none';
    sx.deselect();
    return { txt, visible };
  });
  const phaseNames = ['New Moon', 'Full Moon', 'First Quarter', 'Last Quarter',
    'Waxing Crescent', 'Waning Crescent', 'Waxing Gibbous', 'Waning Gibbous'];
  check(`Moon shows live phase (${phase.txt})`,
    phase.visible && phaseNames.some((n) => phase.txt.startsWith(n)) && /\d+% lit/.test(phase.txt));
  check('non-moon hides phase row', await page.evaluate(async () => {
    const sx = window.__sx;
    sx.select(sx.bodies.get('mars'), { instant: true });
    await sx.frame();
    const hidden = document.getElementById('live-extra-row').style.display === 'none';
    sx.deselect();
    return hidden;
  }));
  check('social meta tags present', await page.evaluate(
    () => !!document.querySelector('meta[property="og:title"]')
      && !!document.querySelector('meta[name="description"]'),
  ));
  check('og:image card exists and is served', await page.evaluate(async () => {
    const img = document.querySelector('meta[property="og:image"]')?.content;
    if (!img || !img.endsWith('social-preview.jpg')) return false;
    const res = await fetch('social-preview.jpg', { method: 'HEAD' });
    return res.ok;
  }));

  // click empty space deselects — probe for a point with truly nothing
  // under it (orbit lines and drifting objects made a fixed point flaky)
  const safePt = await page.evaluate(() => {
    const cands = [[720, 80], [200, 560], [980, 640], [420, 130], [1150, 220]];
    for (const [x, y] of cands) {
      const el = document.elementFromPoint(x, y);
      if (el?.id === 'scene' && window.__sx.raycastAt(x, y).length === 0) return { x, y };
    }
    return { x: 720, y: 80 };
  });
  await page.mouse.click(safePt.x, safePt.y);
  await frames(page, 2);
  check('click on empty space deselects', await page.evaluate(
    () => window.__sx.selected() === null
      && !document.getElementById('info-panel').classList.contains('open'),
  ), await page.evaluate(() => `selected=${window.__sx.selected()?.data.id}`));

  // click directly on a planet selects it
  await page.evaluate(() => window.__sx.select(window.__sx.bodies.get('earth')));
  await new Promise((r) => setTimeout(r, 1800));
  await frames(page, 2);
  await page.evaluate(() => window.__sx.deselect());
  await frames(page, 2);
  // aim at Earth's disc but avoid floating labels that may overlay the
  // exact centre (clicking a label is valid UX, but selects that object)
  const screenPos = await page.evaluate(() => {
    const sx = window.__sx;
    const v = sx.bodies.get('earth').anchor.position.clone().project(sx.camera);
    const cx = (v.x * 0.5 + 0.5) * innerWidth;
    const cy = (-v.y * 0.5 + 0.5) * innerHeight;
    for (const dy of [0, 12, 24, -12, 36]) {
      const el = document.elementFromPoint(cx, cy + dy);
      if (el && el.id === 'scene') return { x: cx, y: cy + dy };
    }
    return { x: cx, y: cy };
  });
  await page.mouse.click(screenPos.x, screenPos.y);
  await frames(page, 2);
  // the ray may legitimately hit an Earth-orbiting craft's pick proxy
  // hovering over the disc — both prove click-to-select works
  check('clicking a planet selects it (or craft in front of it)', await page.evaluate(() => {
    const sel = window.__sx.selected();
    return sel != null && (sel.data.id === 'earth' || sel.data.parent === 'earth'
      || sel.data.kind === 'lagrange'); // JWST/Gaia/SOHO ride the Sun-Earth line
  }));

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

  // Enter selects the first match
  await page.type('#nav-search', 'tit');
  await page.keyboard.press('Enter');
  await frames(page, 2);
  check('Enter in search selects first match (Titan)', await page.evaluate(
    () => window.__sx.selected()?.data.id === 'titan',
  ));
  await page.evaluate(() => {
    const sx = window.__sx;
    sx.deselect();
    const sl = document.getElementById('nav-search');
    sl.value = '';
    sl.dispatchEvent(new Event('input'));
    sl.blur();
  });
  await frames(page, 1);

  // idle drift engages with nothing selected, disengages on input
  const idle = await page.evaluate(async () => {
    const sx = window.__sx;
    sx.idleState.last = performance.now() - 30000;
    await sx.frame(); await sx.frame();
    const drifting = sx.controls.autoRotate;
    window.dispatchEvent(new PointerEvent('pointerdown'));
    await sx.frame(); await sx.frame();
    return { drifting, stopped: !sx.controls.autoRotate };
  });
  check('idle camera drift engages and stops on input', idle.drifting && idle.stopped);

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

  // Starlink renders the baked CelesTrak snapshot (tests/bake-starlink.mjs)
  console.log('\n— Starlink constellation');
  const snapPath = path.join(ROOT, 'textures', 'starlink-shells.json');
  let snap = null;
  try { snap = JSON.parse(fs.readFileSync(snapPath, 'utf8')); } catch { /* checked below */ }
  check('starlink snapshot JSON parses, is dated, under 200 KB',
    snap !== null && /^\d{4}-\d{2}-\d{2}$/.test(snap.snapshot)
      && fs.statSync(snapPath).size < 200 * 1024);
  await page.waitForFunction(
    () => window.__sx.craft.get('starlink').mesh.geometry.attributes.position.count > 0,
    { timeout: 5000 },
  );
  const baked = snap.shells.reduce((n, sh) => n + sh.sats.length, 0);
  const slLats = await page.evaluate(() => {
    // latitudes in the cloud's own orbital frame (geometry local space)
    const pos = window.__sx.craft.get('starlink').mesh.geometry.attributes.position;
    const lats = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i); const y = pos.getY(i); const z = pos.getZ(i);
      lats.push((Math.asin(Math.abs(y) / Math.hypot(x, y, z)) * 180) / Math.PI);
    }
    return lats;
  });
  check(`starlink instance count matches baked snapshot (${baked})`,
    slLats.length === baked, `got ${slLats.length}`);
  // instances fill in shell order, so JSON index ranges map 1:1 to the cloud
  let at = 0; let inBand = 0; let aboveBand = 0; let atEdge = 0; let polar = 0;
  for (const sh of snap.shells) {
    for (let i = at; i < at + sh.sats.length; i++) {
      if (sh.incDeg <= 55) {
        inBand++;
        if (slLats[i] > 55) aboveBand++;
        else if (slLats[i] > 50) atEdge++;
      } else if (slLats[i] > 70) polar++;
    }
    at += sh.sats.length;
  }
  check(`53° band stays below |lat| 55° (${inBand} sats)`, aboveBand === 0, `${aboveBand} above`);
  check('band edge populated (|lat| 50–55°)', atEdge > 0, `${atEdge} sats`);
  check('polar shells reach beyond |lat| 70°', polar > 0, `${polar} sats`);

  await page.click('#toggle-labels');
  check('label toggle hides label layer', await page.evaluate(
    () => document.getElementById('label-layer').style.display === 'none',
  ));
  await page.click('#toggle-labels');

  console.log('\n— Mars transfer window');
  await page.click('#toggle-transfer');
  await frames(page, 2);
  const tw = await page.evaluate(() => {
    const sx = window.__sx;
    const st = sx.transfer.state();
    return {
      arc: !!sx.scene.getObjectByName('transfer-arc'),
      caption: document.getElementById('transfer-caption').classList.contains('show'),
      text: document.getElementById('transfer-caption').textContent,
      dep: st.depDate,
      arr: st.arrDate,
      span: +(st.arr - st.dep).toFixed(0),
    };
  });
  check(`transfer toggle draws arc + caption (${tw.text})`,
    tw.arc && tw.caption && tw.text.includes(tw.dep) && tw.text.includes(tw.arr));
  check(`next launch window departs Nov 2026 – Jan 2027 (${tw.dep})`,
    tw.dep >= '2026-11-01' && tw.dep <= '2027-01-31');
  check(`transfer time ≈ 8.5 months (${tw.span} days in 230–290)`,
    tw.span > 230 && tw.span < 290);
  // jump mid-window: the Starship fleet must be riding the arc
  const fleet = await page.evaluate(async () => {
    const sx = window.__sx;
    const st = sx.transfer.state();
    const wasPlaying = sx.sim.playing;
    sx.sim.playing = false;
    sx.sim.days = (st.dep + st.arr) / 2;
    await sx.frame();
    const pos = sx.scene.getObjectByName('transfer-arc').geometry.attributes.position;
    const V = sx.camera.position.constructor;
    const ships = sx.transfer.ships().map((s) => {
      const w = new V();
      s.getWorldPosition(w);
      let min = 1e9;
      for (let i = 0; i < pos.count; i++) {
        min = Math.min(min, w.distanceTo(new V(pos.getX(i), pos.getY(i), pos.getZ(i))));
      }
      return { finite: Number.isFinite(w.x + w.y + w.z), offArc: +min.toFixed(2) };
    });
    document.getElementById('btn-now').click();
    sx.sim.playing = wasPlaying;
    await sx.frame();
    return ships;
  });
  check(`fleet of 3 rides the arc mid-transfer (off-arc ${fleet.map((f) => f.offArc).join(', ')})`,
    fleet.length === 3 && fleet.every((f) => f.finite && f.offArc < 1.5));
  await page.click('#toggle-transfer');
  await frames(page, 1);
  check('transfer toggle OFF removes arc and caption', await page.evaluate(
    () => !window.__sx.scene.getObjectByName('transfer-arc')
      && !document.getElementById('transfer-caption').classList.contains('show'),
  ));

  console.log('\n— Time controls');
  const t = await page.evaluate(async () => {
    const sx = window.__sx;
    document.getElementById('btn-play').click(); // pause
    const before = sx.sim.days;
    await sx.frame(); await sx.frame();
    const paused = sx.sim.days === before;
    document.getElementById('btn-play').click(); // resume
    const slider = document.getElementById('speed-slider');
    const defaultSpeed = sx.sim.speed; // untouched since load
    slider.value = 100;
    slider.dispatchEvent(new Event('input'));
    const fast = sx.sim.speed;
    slider.value = 50;
    slider.dispatchEvent(new Event('input'));
    sx.sim.days += 5000;
    document.getElementById('btn-now').click();
    const nowDelta = Math.abs(sx.sim.days - (Date.now() - Date.UTC(2000, 0, 1, 12)) / 86400000);
    return { paused, fast, defaultSpeed, nowDelta };
  });
  check('pause freezes simulation time', t.paused);
  check(`default load speed = 1 day/s (got ${t.defaultSpeed})`, approx(t.defaultSpeed, 1, 1e-9));
  check(`speed slider max = 100 days/s (got ${t.fast.toFixed(0)})`, approx(t.fast, 100, 1e-9));
  check('NOW returns to the present', t.nowDelta < 0.01);
  // P0-9: the 1× button is gone; the slider's leftmost stop IS real time
  const rt = await page.evaluate(() => {
    const slider = document.getElementById('speed-slider');
    slider.value = 0;
    slider.dispatchEvent(new Event('input'));
    const out = {
      speed: window.__sx.sim.speed,
      label: document.getElementById('speed-label').textContent,
      buttonGone: document.getElementById('btn-realtime') === null,
    };
    slider.value = 50;
    slider.dispatchEvent(new Event('input'));
    return out;
  });
  check(`leftmost slider = exact real time (${rt.label})`,
    rt.speed === 1 / 86400 && rt.label === 'real time');
  check('redundant 1x button removed', rt.buttonGone);

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

  // SPCX IPO badge: counts down before Nasdaq open (2026-06-12 13:30 UTC),
  // flips to T+ trading mode after, driven by wall-clock time (stub Date.now)
  const ipo = await page.evaluate(async () => {
    const sx = window.__sx;
    const realNow = Date.now;
    const read = () => ({
      label:      document.getElementById('ipo-label').textContent,
      days:       document.getElementById('ipo-days').textContent,
      min:        document.getElementById('ipo-min').textContent,
      price:      document.getElementById('ipo-price-val').textContent,
      cellsShown: document.getElementById('ipo-cells').style.display !== 'none',
      priceShown: document.getElementById('ipo-price').style.display !== 'none',
      live:       document.getElementById('ipo-countdown').classList.contains('live'),
    });
    Date.now = () => Date.UTC(2026, 5, 12, 13, 0); // T−30 min
    await sx.frame();
    const before = read();
    Date.now = () => Date.UTC(2026, 5, 12, 14, 0); // T+30 min
    await sx.frame();
    await new Promise((r) => setTimeout(r, 80)); // let the (stubbed) quote land
    await sx.frame();
    const after = read();
    Date.now = realNow;
    await sx.frame();
    return { before, after };
  });
  check(`IPO badge counts down pre-open (${ipo.before.days}d ${ipo.before.min}m)`,
    !ipo.before.live && ipo.before.days === '00' && ipo.before.min === '30'
    && ipo.before.label === 'Explore Space While Waiting for SPCX'
    && ipo.before.cellsShown && !ipo.before.priceShown);
  // post-open: placeholder key → cells tick T+ elapsed; real key → stubbed quote
  // swaps in the price. Either way exactly one of the two is visible.
  check('IPO badge flips to live post-open',
    ipo.after.live && ipo.after.label.includes('SPCX is Live')
    && ipo.after.cellsShown !== ipo.after.priceShown
    && (ipo.after.priceShown ? ipo.after.price === '$185.42' : ipo.after.min === '30'));

  // celebration must be asserted on a fresh page: the badge test above
  // already crossed T-0 on the main page, consuming the one-shot
  const celPage = await openPage(browser, BASE, consoleErrors);
  const cel = await celPage.evaluate(async () => {
    const sx = window.__sx;
    const realNow = Date.now;
    const badge = document.getElementById('ipo-countdown');
    Date.now = () => Date.UTC(2026, 5, 12, 13, 29, 55);
    await sx.frame();
    Date.now = () => Date.UTC(2026, 5, 12, 13, 30, 5);
    await sx.frame();
    const fired = badge.classList.contains('celebrate');
    // cross again — must stay silent, the flourish is one-shot per load
    badge.classList.remove('celebrate');
    Date.now = () => Date.UTC(2026, 5, 12, 13, 29, 55);
    await sx.frame();
    Date.now = () => Date.UTC(2026, 5, 12, 13, 30, 5);
    await sx.frame();
    const refired = badge.classList.contains('celebrate');
    Date.now = realNow;
    return { fired, refired };
  });
  await celPage.close();
  check('T-0 crossing fires one-time celebration', cel.fired && !cel.refired,
    JSON.stringify(cel));

  // ticker easter egg: searching SPCX surfaces and selects the Roadster
  const egg = await page.evaluate(async () => {
    const search = document.getElementById('nav-search');
    search.value = 'SPCX';
    search.dispatchEvent(new Event('input'));
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await window.__sx.frame();
    const sel = window.__sx.selected()?.data.id;
    search.value = '';
    search.dispatchEvent(new Event('input'));
    window.__sx.deselect();
    await window.__sx.frame();
    return sel;
  });
  check('SPCX ticker easter egg selects the Roadster', egg === 'roadster', `got ${egg}`);

  // Where is Starman: roadster-only live rows with physically plausible values
  const starman = await page.evaluate(async () => {
    const sx = window.__sx;
    sx.select(sx.craft.get('roadster'));
    await sx.frame();
    const num = (id) => parseFloat(document.getElementById(id).textContent.replace(/,/g, ''));
    const out = {
      speedKmh: num('live-extra'),
      speedKey: document.getElementById('live-extra-key').textContent,
      marsAU: num('live-extra2'),
      warranties: num('live-extra3'),
      visible: ['live-extra-row', 'live-extra2-row', 'live-extra3-row']
        .every((id) => document.getElementById(id).style.display !== 'none'),
    };
    sx.deselect();
    await sx.frame();
    // rows must hide again for other bodies
    sx.select(sx.bodies.get('mars'));
    await sx.frame();
    out.hiddenAfter = document.getElementById('live-extra3-row').style.display === 'none';
    sx.deselect();
    await sx.frame();
    return out;
  });
  check(`Starman speed plausible (${starman.speedKmh.toLocaleString('en-US')} km/h)`,
    starman.visible && starman.speedKey === 'Speed (now)'
    && starman.speedKmh > 60000 && starman.speedKmh < 140000);
  check(`Starman Mars distance finite (${starman.marsAU} AU)`,
    Number.isFinite(starman.marsAU) && starman.marsAU > 0 && starman.marsAU < 5);
  check(`Starman warranty counter sane (${starman.warranties}×)`,
    starman.warranties > 100000 && starman.warranties < 140000 && starman.hiddenAfter);

  // SpaceX Story: a time-traveling tour from Falcon 1 to the IPO
  const story = await page.evaluate(async () => {
    const sx = window.__sx;
    const wasPlaying = sx.sim.playing;
    sx.sim.playing = false;
    document.getElementById('btn-spacex-tour').click();
    await sx.frame();
    const snap = () => ({
      date: document.getElementById('date-label').textContent,
      badge: document.getElementById('tour-date')?.textContent ?? '(no element)',
      name: document.getElementById('tour-name').textContent,
      step: document.getElementById('tour-step').textContent,
      sel: sx.selected()?.data.id,
    });
    const first = snap();
    document.getElementById('tour-next').click();
    document.getElementById('tour-next').click();
    await sx.frame();
    const third = snap();
    const badges = [first.badge, third.badge];
    for (let i = 3; i < 7; i++) {
      document.getElementById('tour-next').click();
      await sx.frame();
      badges.push(document.getElementById('tour-date')?.textContent ?? '(no element)');
    }
    const last = snap();
    document.getElementById('tour-exit').click();
    const exited = !document.getElementById('tour-banner').classList.contains('open')
      && !document.getElementById('btn-spacex-tour').classList.contains('on');
    // grand tour stops carry no milestone date — the badge must clear
    sx.tour.start();
    await sx.frame();
    const grandBadge = document.getElementById('tour-date')?.textContent ?? '(no element)';
    sx.tour.stop();
    sx.sim.playing = wasPlaying;
    document.getElementById('btn-now').click();
    sx.deselect();
    await sx.frame();
    return { first, third, last, badges, grandBadge, exited };
  });
  check(`SpaceX Story opens on Falcon 1 in 2008 (${story.first.date})`,
    story.first.date.startsWith('2008-09-28') && story.first.name === 'Falcon 1 reaches orbit'
    && story.first.step === '1 / 7' && story.first.sel === 'earth');
  check(`SpaceX Story stop 3 = Starman departure (${story.third.date})`,
    story.third.date.startsWith('2018-02-06') && story.third.sel === 'roadster'
    && story.third.name === 'Starman leaves Earth');
  check(`SpaceX Story shows a date badge on every step (${JSON.stringify(story.badges)})`,
    story.badges.length === 6 && story.badges.every((b) => /\b(20\d\d)\b/.test(b))
    && story.first.badge === 'Sep 28, 2008' && story.third.badge === 'Feb 6, 2018');
  check(`SpaceX Story IPO finale focuses Earth (${story.last.sel}, ${story.last.badge})`,
    story.last.step === '7 / 7' && story.last.sel === 'earth'
    && story.last.name === 'SPCX rings the Nasdaq bell' && story.last.badge === 'Jun 12, 2026');
  check(`Grand Tour shows no date badge ("${story.grandBadge}")`, story.grandBadge === '');
  check('SpaceX Story exits cleanly', story.exited);

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

  console.log('\n— Smooth motion at max sim speed (P0-2)');
  // at 100 days/s a frame step exceeds whole orbits of short-period objects
  // (ISS: 93 min) — the displayed phase must sweep smoothly, never strobe
  const smooth = await page.evaluate(async () => {
    const sx = window.__sx;
    const slider = document.getElementById('speed-slider');
    slider.value = 100; // 100 days/s — max
    slider.dispatchEvent(new Event('input'));
    if (!sx.sim.playing) document.getElementById('btn-play').click();
    const iss = sx.craft.get('iss');
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const angleOf = (m) => Math.atan2(m.position.z, m.position.x);
    const targets = {
      iss: () => angleOf(iss.mesh),
      phobos: () => angleOf(sx.bodies.get('phobos').mesh),
      spin: () => sx.bodies.get('earth').mesh.rotation.y,
    };
    const steps = { iss: [], phobos: [], spin: [] };
    await new Promise((res) => {
      let prev = null;
      let n = 0;
      const tick = () => {
        const cur = Object.fromEntries(Object.entries(targets).map(([k, f]) => [k, f()]));
        if (prev) for (const k in cur) steps[k].push(wrap(cur[k] - prev[k]));
        prev = cur;
        if (++n < 40) requestAnimationFrame(tick); else res();
      };
      requestAnimationFrame(tick);
    });
    const stat = (a) => ({
      max: +Math.max(...a.map(Math.abs)).toFixed(3),
      flips: a.slice(1).filter((v, i) => Math.sign(v) !== Math.sign(a[i])).length,
    });
    // pausing must snap the displayed phase back to exact sim time
    document.getElementById('btn-play').click(); // pause
    await sx.frame(); await sx.frame();
    const shownA = angleOf(iss.mesh);
    iss.update(sx.sim.days); // direct call bypasses playback smoothing — exact
    const resync = Math.abs(wrap(angleOf(iss.mesh) - shownA));
    document.getElementById('btn-play').click(); // resume
    slider.value = 50;
    slider.dispatchEvent(new Event('input'));
    document.getElementById('btn-now').click();
    return {
      iss: stat(steps.iss), phobos: stat(steps.phobos), spin: stat(steps.spin),
      resync: +resync.toFixed(5),
    };
  });
  check(`ISS sweeps, never strobes, at max speed (max step ${smooth.iss.max} rad ≤ 0.3, ${smooth.iss.flips} reversals)`,
    smooth.iss.max <= 0.3 && smooth.iss.flips === 0, JSON.stringify(smooth.iss));
  check(`Phobos sweeps, never strobes, at max speed (max step ${smooth.phobos.max} rad ≤ 0.3)`,
    smooth.phobos.max <= 0.3 && smooth.phobos.flips === 0, JSON.stringify(smooth.phobos));
  check(`Earth spin stays continuous at max speed (max step ${smooth.spin.max} rad ≤ 0.3)`,
    smooth.spin.max <= 0.3 && smooth.spin.flips === 0, JSON.stringify(smooth.spin));
  check(`pause resyncs displayed phase to exact sim time (off by ${smooth.resync} rad)`,
    smooth.resync < 1e-6);

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
  await page.evaluate(() => document.getElementById('info-next').click());
  await frames(page, 2);
  check('info-panel › cycles forward (Mercury)', await page.evaluate(
    () => window.__sx.selected()?.data.id === 'mercury',
  ));
  await page.evaluate(() => document.getElementById('info-prev').click());
  await frames(page, 2);
  check('info-panel ‹ cycles back (Sun)', await page.evaluate(
    () => window.__sx.selected()?.data.id === 'sun',
  ));
  await page.keyboard.press('Escape');

  const spaceToggle = await page.evaluate(() => window.__sx.sim.playing);
  await page.keyboard.press(' ');
  await frames(page, 2);
  check('Space toggles play/pause', await page.evaluate(
    (was) => window.__sx.sim.playing === !was, spaceToggle,
  ));
  await page.keyboard.press(' ');
  await frames(page, 2);

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
  const marsOverlaps = await page.evaluate(async () => {
    const sx = window.__sx;
    sx.select(sx.bodies.get('mars'), { instant: true });
    await sx.frame(); await sx.frame();
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
    sx.deselect();
    await sx.frame();
    return { n, visible: rects.length };
  });
  check(`no overlapping labels at the crowded Mars view (${marsOverlaps.visible} visible)`,
    marsOverlaps.n === 0, `${marsOverlaps.n} collisions`);

  console.log('\n— Sound');
  const snd = await page.evaluate(async () => {
    const sx = window.__sx;
    // simulate the first user gesture that wakes the audio context
    window.dispatchEvent(new PointerEvent('pointerdown'));
    await new Promise((r) => setTimeout(r, 150));
    const stateAfterGesture = sx.sound.context?.state ?? 'none';
    document.getElementById('toggle-sound').click();
    const mutedOff = sx.sound.enabled;
    document.getElementById('toggle-sound').click();
    return { stateAfterGesture, mutedOff, enabledBack: sx.sound.enabled };
  });
  check(`audio context runs after first gesture (${snd.stateAfterGesture})`,
    snd.stateAfterGesture === 'running');
  check('sound toggle mutes and unmutes', snd.mutedOff === false && snd.enabledBack === true);

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
    && tourStart.banner && tourStart.step === '1 / 21', JSON.stringify(tourStart));
  check('tour dwell has cinematic camera drift', await page.evaluate(
    () => window.__sx.controls.autoRotate === true,
  ));

  await page.click('#tour-exit');
  await frames(page, 2);
  await page.click('#btn-random');
  await frames(page, 2);
  const rand1 = await page.evaluate(() => window.__sx.selected()?.data.id);
  await page.click('#btn-random');
  await frames(page, 2);
  const rand2 = await page.evaluate(() => window.__sx.selected()?.data.id);
  check(`Surprise me flies to random objects (${rand1} → ${rand2})`,
    !!rand1 && !!rand2 && rand1 !== rand2);
  await page.keyboard.press('Escape');
  await frames(page, 2);
  await page.click('#btn-tour');
  await frames(page, 2);

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
      && !document.getElementById('tour-banner').classList.contains('open')
      && window.__sx.controls.autoRotate === false,
  ));
  await page.keyboard.press('Escape');
  await frames(page, 2);

  console.log('\n— Texture failure resilience');
  const texPage = await browser.newPage();
  await texPage.setRequestInterception(true);
  texPage.on('request', (req) => {
    // both the base map and the progressive hi-res must fail for the
    // fallback canvas to stick
    if (req.url().includes('_jupiter')) req.abort();
    else req.continue();
  });
  await texPage.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 });
  await texPage.waitForFunction(
    () => window.__sx?.bodies?.get('jupiter')?.mesh.material.map?.isCanvasTexture === true,
    { timeout: 15000 },
  );
  check('failed planet texture falls back to tinted canvas (no white ball)',
    await texPage.evaluate(() => {
      const m = window.__sx.bodies.get('jupiter').mesh.material;
      return m.map.isCanvasTexture && m.map.source.data.width === 2;
    }));
  await texPage.close();

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
  check(`headless FPS ${fps.toFixed(0)} ≥ 30 (measured 120 on dev hardware)`, fps >= 30);

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

  console.log('\n— Mobile viewport (390×844)');
  const mob = await browser.newPage();
  await mob.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  mob.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`mobile: ${m.text()}`); });
  mob.on('pageerror', (e) => consoleErrors.push(`mobile pageerror: ${e.message}`));
  await mob.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 });
  await mob.waitForFunction('window.__sx !== undefined', { timeout: 15000 });
  await mob.evaluate(() => window.__sx.frame());

  check('mobile: app boots', await mob.evaluate(() => document.body.classList.contains('loaded')));
  check('mobile: no horizontal overflow', await mob.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  ));
  check('mobile: navigator starts collapsed', await mob.evaluate(
    () => document.getElementById('nav-panel').classList.contains('collapsed'),
  ));
  await mob.tap('#nav-toggle');
  check('mobile: nav toggle expands it', await mob.evaluate(
    () => !document.getElementById('nav-panel').classList.contains('collapsed'),
  ));
  await mob.tap('#nav-toggle');
  const closedSheet = await mob.evaluate(() => {
    const r = document.getElementById('info-panel').getBoundingClientRect();
    return { top: r.top, vh: innerHeight };
  });
  check(`mobile: closed info sheet is fully offscreen (top ${closedSheet.top.toFixed(0)}`
    + ` >= vh ${closedSheet.vh})`, closedSheet.top >= closedSheet.vh - 1);
  await mob.evaluate(async () => {
    window.__sx.select(window.__sx.bodies.get('earth'), { instant: true });
    await window.__sx.frame();
  });
  const sheet = await mob.evaluate(() => {
    const r = document.getElementById('info-panel').getBoundingClientRect();
    return { top: r.top, vh: innerHeight, width: r.width, vw: innerWidth };
  });
  check(`mobile: info panel is a bottom sheet (top ${sheet.top.toFixed(0)} > 50% vh, full width)`,
    sheet.top > sheet.vh * 0.5 && sheet.width >= sheet.vw - 2);
  check('mobile: info values stay within the viewport', await mob.evaluate(
    () => [...document.querySelectorAll('#info-panel .info-row')].every((r) => {
      const right = r.lastElementChild?.getBoundingClientRect().right ?? 0;
      return right <= innerWidth + 1;
    }),
  ));
  const mobNext = await mob.evaluate(async () => {
    const btn = document.getElementById('info-next');
    const r = btn.getBoundingClientRect();
    const fits = r.width >= 16 && r.right <= innerWidth && r.top >= 0;
    btn.click();
    await window.__sx.frame();
    return { fits, sel: window.__sx.selected()?.data.id };
  });
  check('mobile: ‹ › buttons are tappable and cycle',
    mobNext.fits && !!mobNext.sel && mobNext.sel !== 'earth', JSON.stringify(mobNext));
  await mob.evaluate(() => window.__sx.deselect());
  const tapPos = await mob.evaluate(() => {
    const sx = window.__sx;
    const v = sx.bodies.get('sun').mesh.position.clone().project(sx.camera);
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
  });
  await mob.touchscreen.tap(tapPos.x, tapPos.y);
  await mob.evaluate(() => window.__sx.frame());
  check('mobile: tap selects the Sun', await mob.evaluate(
    () => window.__sx.selected()?.data.id === 'sun',
  ));
  await mob.close();

  const badFocus = await browser.newPage();
  await badFocus.goto(`${BASE}/?focus=doesnotexist`, { waitUntil: 'networkidle0', timeout: 30000 });
  await badFocus.waitForFunction('window.__sx !== undefined', { timeout: 15000 });
  check('invalid ?focus deep link boots cleanly with nothing selected',
    await badFocus.evaluate(() => document.body.classList.contains('loaded')
      && window.__sx.selected() === null));
  await badFocus.close();

  console.log('\n— WebGL fallback');
  const noGl = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-first-run', '--disable-webgl', '--disable-webgl2', '--disable-3d-apis'],
  });
  try {
    const glPage = await noGl.newPage();
    await glPage.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 });
    const fallback = await glPage.evaluate(() => ({
      shown: document.getElementById('webgl-fallback').classList.contains('show'),
      visible: getComputedStyle(document.getElementById('webgl-fallback')).display !== 'none',
    }));
    check('WebGL-less browser sees a friendly fallback message', fallback.shown && fallback.visible,
      JSON.stringify(fallback));
  } finally {
    await noGl.close();
  }

  console.log('\n— Determinism & lunar phase');
  const beltRocks = await page.evaluate(() => {
    const rocks = [];
    window.__sx.scene.traverse((o) => {
      if (o.isInstancedMesh && o.name === 'belt-rocks') rocks.push(o);
    });
    return {
      meshes: rocks.length,
      total: rocks.reduce((s, m) => s + m.count, 0),
      lit: rocks.every((m) => m.material.isMeshStandardMaterial && !!m.geometry.attributes.normal),
      colored: rocks.every((m) => !!m.instanceColor),
    };
  });
  check(`asteroid belt is ${beltRocks.total} lit instanced rocks in ${beltRocks.meshes} draw calls (no flat dots)`,
    beltRocks.total === 2200 && beltRocks.meshes >= 2 && beltRocks.meshes <= 6
    && beltRocks.lit && beltRocks.colored, JSON.stringify(beltRocks));

  const worldFingerprint = `(() => {
    const sx = window.__sx;
    const belt = [];
    sx.scene.traverse((o) => {
      const n = o.geometry?.attributes?.position?.count;
      if (o.isPoints && (n === 2200 || n === 3000) && belt.length < 6) {
        const a = o.geometry.attributes.position.array;
        belt.push(a[0], a[1], a[2]);
      }
      if (o.isInstancedMesh && o.name === 'belt-rocks') {
        const m = o.instanceMatrix.array; // rock scatter + per-rock pose
        belt.push(m[0], m[1], m[2], m[12], m[13], m[14]);
      }
    });
    return belt.join(',');
  })()`;
  const fp1 = await page.evaluate(worldFingerprint);
  const page3 = await openPage(browser, BASE, consoleErrors);
  const fp2 = await page3.evaluate(worldFingerprint);
  await page3.close();
  check('universe scatter is deterministic across loads', fp1 === fp2 && fp1.length > 0);

  const moonPhase = await page.evaluate(() => {
    const sx = window.__sx;
    const moon = sx.bodies.get('moon');
    const v = new (moon.mesh.position.constructor)();
    moon.mesh.getWorldPosition(v);
    const e = sx.bodies.get('earth').anchor.position;
    const lambda = ((Math.atan2(-(v.z - e.z), v.x - e.x) * 180 / Math.PI) + 360) % 360;
    const days = sx.sim.days;
    const expected = ((218.316 + (360 / 27.321661) * days) % 360 + 360) % 360;
    let diff = Math.abs(lambda - expected) % 360;
    if (diff > 180) diff = 360 - diff;
    return { lambda, expected, diff };
  });
  check(`Moon at its real ecliptic longitude (off by ${moonPhase.diff.toFixed(1)}°)`,
    moonPhase.diff < 3);

  console.log('\n— True-scale mode');
  const ts = await openPage(browser, `${BASE}/?scale=true`, consoleErrors);
  const tsChecks = await ts.evaluate(() => {
    const sx = window.__sx;
    const e = sx.bodies.get('earth');
    const j = sx.bodies.get('jupiter');
    return {
      ratio: j.anchor.position.length() / e.anchor.position.length(),
      earthR: e.displayRadius,
      sunR: sx.bodies.get('sun').displayRadius,
      moonOrbit: (() => {
        const m = sx.bodies.get('moon');
        return m.mesh.position.length() / e.displayRadius;
      })(),
      toggleChecked: document.getElementById('toggle-truescale').checked,
    };
  });
  check(`true scale: Jupiter/Earth distance ratio ${tsChecks.ratio.toFixed(2)} (≈5.0–5.5)`,
    tsChecks.ratio > 4.8 && tsChecks.ratio < 5.6);
  check(`true scale: Earth is a speck (R=${tsChecks.earthR.toFixed(4)} < 0.01)`, tsChecks.earthR < 0.01);
  check(`true scale: Sun radius ${tsChecks.sunR.toFixed(3)} ≈ 0.288`, approx(tsChecks.sunR, 0.288, 0.01));
  check(`true scale: Moon at ${tsChecks.moonOrbit.toFixed(0)} Earth radii (58–63)`,
    tsChecks.moonOrbit > 58 && tsChecks.moonOrbit < 63);
  check('true scale: toggle reflects mode', tsChecks.toggleChecked);
  const tsCraft = await ts.evaluate(() => {
    const sx = window.__sx;
    const earth = sx.bodies.get('earth');
    const V3 = sx.camera.position.constructor;
    // world-space bounding radius of a craft group, ignoring helpers
    function boundR(root) {
      const rootPos = root.getWorldPosition(new V3());
      let r = 0;
      root.traverse((o) => {
        if (!o.geometry || o.name === 'pickproxy' || o.name === 'glint') return;
        o.geometry.computeBoundingSphere();
        const p = o.getWorldPosition(new V3());
        const s = o.getWorldScale(new V3());
        r = Math.max(r, p.distanceTo(rootPos)
          + o.geometry.boundingSphere.radius * Math.max(s.x, s.y, s.z));
      });
      return r;
    }
    let worstParented = { id: null, rel: 0 };
    let worstFree = { id: null, rel: 0 };
    for (const [id, c] of sx.craft) {
      if (c.isCloud) continue;
      const parent = c.data.parent ? sx.bodies.get(c.data.parent) : null;
      const rel = boundR(c.mesh) / (parent ?? earth).displayRadius;
      const worst = parent ? worstParented : worstFree;
      if (rel > worst.rel) { worst.id = id; worst.rel = rel; }
    }
    sx.select(sx.craft.get('iss'), { instant: true });
    const issPos = sx.craft.get('iss').mesh.getWorldPosition(new V3());
    return { worstParented, worstFree, issCamDist: sx.camera.position.distanceTo(issPos) };
  });
  check(`true scale: orbiters/rovers are miniatures (worst ${tsCraft.worstParented.id}`
    + ` = ${tsCraft.worstParented.rel.toFixed(2)}× its parent < 0.2)`,
  tsCraft.worstParented.rel < 0.2);
  check(`true scale: free-flying craft smaller than Earth (worst ${tsCraft.worstFree.id}`
    + ` = ${tsCraft.worstFree.rel.toFixed(2)}× < 1)`,
  tsCraft.worstFree.rel < 1);
  check(`true scale: fly-to ISS frames it (cam dist ${tsCraft.issCamDist.toFixed(3)} < 0.02)`,
    tsCraft.issCamDist < 0.02);
  await ts.close();

  console.log('\n— Onboarding');
  const ob = await browser.newPage();
  await ob.setViewport({ width: 1440, height: 900 });
  await ob.goto(BASE, { waitUntil: 'networkidle0' });
  await ob.evaluate(() => localStorage.clear());
  await ob.reload({ waitUntil: 'networkidle0' });
  await ob.waitForFunction('window.__sx !== undefined');
  await new Promise((r) => setTimeout(r, 1900));
  check('first visit shows tour invitation', await ob.evaluate(
    () => document.getElementById('onboard-toast').classList.contains('show'),
  ));
  await ob.click('#onboard-tour');
  await ob.evaluate(() => window.__sx.frame());
  check('toast button starts the tour', await ob.evaluate(
    () => window.__sx.tour.active
      && !document.getElementById('onboard-toast').classList.contains('show'),
  ));
  await ob.reload({ waitUntil: 'networkidle0' });
  await ob.waitForFunction('window.__sx !== undefined');
  await new Promise((r) => setTimeout(r, 1900));
  check('returning visitor is not nagged', await ob.evaluate(
    () => !document.getElementById('onboard-toast').classList.contains('show'),
  ));
  await ob.close();

  console.log('\n— Share links');
  const shareCtx = browser.defaultBrowserContext();
  await shareCtx.overridePermissions(BASE, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
  const sp = await openPage(browser, `${BASE}/?focus=halley&date=1986-02-09`, consoleErrors);
  const shareState = await sp.evaluate(() => ({
    sel: window.__sx.selected()?.data.id,
    date: document.getElementById('date-label').textContent.slice(0, 10),
  }));
  check('?focus+?date deep link: Halley selected in Feb 1986',
    shareState.sel === 'halley' && shareState.date === '1986-02-09', JSON.stringify(shareState));
  await sp.click('#info-share');
  await new Promise((r) => setTimeout(r, 200));
  const copied = await sp.evaluate(() => window.__lastShareUrl ?? '');
  check('share button builds focus+date URL',
    copied.includes('focus=halley') && copied.includes('date=1986-02-09'), copied);
  await sp.close();

  console.log('\n— Visual regression (deterministic scene)');
  const SNAP_DIR = path.join(ROOT, 'tests', 'snapshots');
  fs.mkdirSync(SNAP_DIR, { recursive: true });
  for (const view of ['saturn', 'earth']) {
    const vp = await browser.newPage();
    await vp.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await vp.goto(`${BASE}/?focus=${view}`, { waitUntil: 'networkidle0', timeout: 30000 });
    await vp.waitForFunction('window.__sx !== undefined', { timeout: 15000 });
    await vp.evaluate(async () => {
      const sx = window.__sx;
      sx.sim.playing = false;
      sx.sim.days = 9650; // frozen reference epoch
      sx.select(sx.selected(), { instant: true });
      for (let i = 0; i < 4; i++) await sx.frame();
    });
    const shot = PNG.sync.read(await vp.screenshot({ type: 'png' }));
    await vp.close();
    const base = path.join(SNAP_DIR, `${view}.png`);
    if (!fs.existsSync(base) || process.env.UPDATE_SNAPSHOTS) {
      fs.writeFileSync(base, PNG.sync.write(shot));
      check(`snapshot baseline written for ${view} (first run)`, true);
      continue;
    }
    const ref = PNG.sync.read(fs.readFileSync(base));
    if (ref.width !== shot.width || ref.height !== shot.height) {
      check(`snapshot ${view} size matches baseline`, false,
        `${shot.width}x${shot.height} vs ${ref.width}x${ref.height}`);
      continue;
    }
    const diffPx = pixelmatch(ref.data, shot.data, null, ref.width, ref.height, { threshold: 0.18 });
    const ratio = diffPx / (ref.width * ref.height);
    // animated sun granulation + star twinkle wiggle a few pixels — allow 3%
    check(`snapshot ${view} within 3% of baseline (${(ratio * 100).toFixed(2)}%)`, ratio < 0.03);
  }

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
