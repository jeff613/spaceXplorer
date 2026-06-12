import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { daysSinceJ2000, TRUE_SCALE } from './data.js';
import { buildSolarSystem } from './bodies.js';
import { buildSpacecraft } from './spacecraft.js';
import { attachDragonMission, attachStarshipDisplay } from './missions.js';
import { createTransfer } from './transfer.js';
import { createTour } from './tour.js';
import { createSound } from './sound.js';
import {
  buildNavigator, showInfo, hideInfo, createLabels, setupTimeControls, setupToggles, updateLiveStats,
} from './ui.js';

// ─── Renderer / scene / camera ────────────────────────────────────────────

const canvas = document.getElementById('scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (err) {
  document.getElementById('webgl-fallback').classList.add('show');
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
// image-based lighting: gives PBR metals real reflections (craft especially)
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
}
const camera = new THREE.PerspectiveCamera(
  55, window.innerWidth / window.innerHeight, TRUE_SCALE ? 0.001 : 0.1, 20000,
);
camera.position.set(0, 150, 320);

// HDR post-processing: render → bloom → tone-mapped output
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.45, 0.4, 0.85,
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// film-grade finishing: gentle corner vignette + fine grain. The grain clock
// follows sim time, not wall time, so a paused scene renders pixel-identical
// frames (the visual-regression suite depends on that).
const finishing = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uGrainTime: { value: 0 } },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uGrainTime;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 q = vUv - 0.5;
      float vig = 1.0 - 0.26 * smoothstep(0.12, 0.5, dot(q, q));
      float g = hash(vUv * 1024.0 + fract(uGrainTime) * 64.0) - 0.5;
      gl_FragColor = vec4(c.rgb * vig + g * 0.012, c.a);
    }`,
});
composer.addPass(finishing);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = TRUE_SCALE ? 0.002 : 2;
controls.maxDistance = 3500;

// ─── World ────────────────────────────────────────────────────────────────

const { bodies, belt } = buildSolarSystem(scene);
const craft = buildSpacecraft(scene, bodies);
attachDragonMission(craft, bodies); // Crew Dragon flies LC-39A → ISS cycles
attachStarshipDisplay(craft, bodies); // Starship stands at Starbase between windows

// ─── Simulation clock ─────────────────────────────────────────────────────

const sim = { days: daysSinceJ2000(), speed: 1, dir: 1, playing: true };

// ─── Selection & camera follow ────────────────────────────────────────────

let selected = null;
let flight = null; // { t, fromPos, fromTarget }
const followPos = new THREE.Vector3();
const glintTmp = new THREE.Vector3();
const prevFollowPos = new THREE.Vector3();
const prevParentPos = new THREE.Vector3(); // selected orbiter's parent, last frame

const sound = createSound();

// manual selection anywhere exits an active tour
const userSelect = (body) => { tour.stop(); select(body); };
const navigator = buildNavigator(bodies, craft, userSelect);
document.getElementById('btn-random').addEventListener('click', () => {
  const order = navigator.order.filter((b) => b !== selected);
  userSelect(order[Math.floor(Math.random() * order.length)]);
});
const labels = createLabels(bodies, craft, userSelect);
const tour = createTour(bodies, craft, select, sim);
const transfer = createTransfer(scene, bodies, sim, craft);

// fly-to viewing distance: surface rovers are tiny miniatures pinned to a
// planet, so they get a much closer floor than free-flying bodies
const flyToDist = (body) => Math.max(
  TRUE_SCALE ? 0.01 : (body.data.kind === 'surface' ? 1.4 : 4),
  body.displayRadius * 5.5,
);

// fly-to approach direction: free craft keep the current viewing angle;
// surface rovers are approached from their local sky so they land framed
// against their planet instead of silhouetted against empty space
function flyToDir(body, fromPos, target) {
  const dir = fromPos.clone().sub(target).normalize();
  if (dir.lengthSq() < 0.5) dir.set(0.4, 0.35, 1).normalize();
  if (!TRUE_SCALE && body.data.kind === 'surface') {
    const radial = target.clone()
      .sub(bodies.get(body.data.parent).anchor.position).normalize();
    dir.add(radial.multiplyScalar(2)).normalize();
  } else if (body.data.kind === 'orbiter') {
    clearParentDir(dir, body, target);
  }
  return dir;
}

// arriving on a planet orbiter while keeping the current bearing can leave
// the parent planet between camera and craft — or even put the camera inside
// it (P0-10). Blend the bearing toward the craft's radial-out direction (the
// rovers' surface-approach idea) just enough that the final camera→craft
// segment clears the parent sphere. Margins are relative to the parent's
// radius, so this holds in TRUE_SCALE too.
function clearParentDir(dir, body, target) {
  const parent = bodies.get(body.data.parent);
  const pPos = parent.mesh.getWorldPosition(new THREE.Vector3());
  const radial = target.clone().sub(pPos).normalize();
  const viewDist = flyToDist(body);
  const need = parent.displayRadius * 1.15;
  const mix = new THREE.Vector3();
  // does the camera→craft segment stay `need` away from the parent's center
  // when arriving along blend weight w between current bearing and radial-out?
  const clears = (w) => {
    mix.copy(dir).lerp(radial, w);
    if (mix.lengthSq() < 1e-6) return false; // degenerate anti-parallel blend
    mix.normalize();
    const cam = target.clone().add(mix.clone().multiplyScalar(viewDist));
    const seg = target.clone().sub(cam);
    const t = THREE.MathUtils.clamp(
      pPos.clone().sub(cam).dot(seg) / seg.lengthSq(), 0, 1);
    return cam.add(seg.multiplyScalar(t)).distanceTo(pPos) >= need;
  };
  if (clears(0)) return;
  if (!clears(1)) { dir.copy(radial); return; } // best achievable: planet dead astern
  // bisect to the smallest clearing blend so the bearing shifts no more than
  // necessary, and stays continuous frame-to-frame during an animated flight
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 10; i++) {
    const mid = (lo + hi) / 2;
    if (clears(mid)) hi = mid; else lo = mid;
  }
  clears(hi); // leaves `mix` holding the chosen bearing
  dir.copy(mix);
}

// the selected body's orbit glows amber so its path stands out
function setOrbitHighlight(body, on) {
  const line = body?.orbitLine;
  if (!line) return;
  const m = line.material;
  if (on) {
    m.userData.prev = { color: m.color.getHex(), opacity: m.opacity };
    m.color.setHex(0xffb347);
    m.opacity = Math.min(1, m.opacity * 2 + 0.25);
  } else if (m.userData.prev) {
    m.color.setHex(m.userData.prev.color);
    m.opacity = m.userData.prev.opacity;
    delete m.userData.prev;
  }
}

function select(body, { instant = false } = {}) {
  if (selected !== body) sound.select();
  setOrbitHighlight(selected, false);
  setOrbitHighlight(body, true);
  selected = body;
  navigator.setActive(body.data.id);
  showInfo(body);
  body.mesh.getWorldPosition(followPos);
  prevFollowPos.copy(followPos);
  if (body.data.kind === 'orbiter') {
    bodies.get(body.data.parent).mesh.getWorldPosition(prevParentPos);
  }
  if (instant) {
    const viewDist = flyToDist(body);
    const dir = flyToDir(body, camera.position, followPos);
    camera.position.copy(followPos).add(dir.multiplyScalar(viewDist));
    controls.target.copy(followPos);
    flight = null;
  } else {
    flight = { t: 0, fromPos: camera.position.clone(), fromTarget: controls.target.clone() };
  }
}

function deselect() {
  if (selected) sound.deselect();
  setOrbitHighlight(selected, false);
  selected = null;
  flight = null;
  navigator.setActive(null);
  hideInfo();
}

document.getElementById('info-close').addEventListener('click', deselect);
for (const [btnId, step] of [['info-prev', -1], ['info-next', 1]]) {
  document.getElementById(btnId).addEventListener('click', () => {
    const order = navigator.order;
    const i = selected ? order.indexOf(selected) : -1;
    userSelect(order[(i + step + order.length) % order.length]);
  });
}

const helpOverlay = () => document.getElementById('help-overlay');
document.getElementById('btn-help').addEventListener('click', () => {
  helpOverlay().classList.toggle('open');
});

window.addEventListener('keydown', (e) => {
  // block shortcuts only while a text-entry control has focus — checkboxes
  // and buttons keep keyboard navigation alive
  const a = document.activeElement;
  const typing = !!a && (a.tagName === 'TEXTAREA'
    || (a.tagName === 'INPUT' && !['checkbox', 'radio', 'button'].includes(a.type)));
  if (e.key === 'Escape') {
    if (helpOverlay().classList.contains('open')) { helpOverlay().classList.remove('open'); return; }
    tour.stop();
    deselect();
    return;
  }
  if (typing) return;
  if (e.key === '?') helpOverlay().classList.toggle('open');
  if (e.key === ' ') {
    e.preventDefault(); // don't scroll — toggle time like a video player
    document.getElementById('btn-play').click();
  }
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault();
    const order = navigator.order;
    const i = selected ? order.indexOf(selected) : -1;
    const step = e.key === 'ArrowRight' ? 1 : -1;
    userSelect(order[(i + step + order.length) % order.length]);
  }
});

// click-to-pick (ignore drags)
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const pickables = [];
for (const body of bodies.values()) pickables.push(body.mesh);
for (const c of craft.values()) if (!c.isCloud) pickables.push(c.mesh);

function raycastAt(clientX, clientY) {
  pointer.set(
    (clientX / window.innerWidth) * 2 - 1,
    -(clientY / window.innerHeight) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(pickables, true);
}

let downXY = null;
canvas.addEventListener('pointerdown', (e) => { downXY = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', (e) => {
  if (!downXY) return;
  const moved = Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]);
  downXY = null;
  if (moved > 5) return;

  const hits = raycastAt(e.clientX, e.clientY);
  if (hits.length === 0) { deselect(); return; }

  // walk up to a known object id (skipping helpers like the pick proxy)
  let obj = hits[0].object;
  while (obj && !bodies.get(obj.name) && !craft.get(obj.name)) obj = obj.parent;
  const found = obj && (bodies.get(obj.name) || craft.get(obj.name));
  if (found) userSelect(found); else { tour.stop(); deselect(); }
});

// pointer feedback when hovering a clickable object (throttled raycast)
let lastHover = 0;
canvas.addEventListener('pointermove', (e) => {
  const now = performance.now();
  if (now - lastHover < 80 || downXY) return;
  lastHover = now;
  canvas.style.cursor = raycastAt(e.clientX, e.clientY).length ? 'pointer' : '';
});

function updateCamera(dt) {
  if (!selected) return;
  selected.mesh.getWorldPosition(followPos);
  const parent = selected.data.kind === 'orbiter' ? bodies.get(selected.data.parent) : null;
  const parentPos = parent ? parent.mesh.getWorldPosition(new THREE.Vector3()) : null;

  if (flight) {
    // fly-to: ease camera toward a viewing spot near the body
    flight.t = Math.min(1, flight.t + dt / 1.4);
    const k = 1 - Math.pow(1 - flight.t, 3); // easeOutCubic
    const viewDist = flyToDist(selected);
    const dir = flyToDir(selected, flight.fromPos, followPos);
    const destPos = followPos.clone().add(dir.multiplyScalar(viewDist));
    camera.position.lerpVectors(flight.fromPos, destPos, k);
    controls.target.lerpVectors(flight.fromTarget, followPos, k);
    // gentle FOV breath mid-flight for a cinematic dolly feel
    camera.fov = 55 + (reducedMotion ? 0 : 6 * Math.sin(Math.PI * k));
    camera.updateProjectionMatrix();
    if (flight.t >= 1) {
      flight = null;
      camera.fov = 55;
      camera.updateProjectionMatrix();
    }
  } else if (parent) {
    // follow an orbiter in its parent's rotating frame: spin the camera
    // around the parent by the arc the craft swept this frame, so the parent
    // stays pinned in view instead of whirling at high sim speed
    const prevOff = prevFollowPos.clone().sub(prevParentPos);
    const curOff = followPos.clone().sub(parentPos);
    if (prevOff.lengthSq() > 1e-12 && curOff.lengthSq() > 1e-12) {
      const q = new THREE.Quaternion()
        .setFromUnitVectors(prevOff.normalize(), curOff.normalize());
      camera.position.sub(prevParentPos).applyQuaternion(q).add(parentPos);
    } else {
      camera.position.add(followPos.clone().sub(prevFollowPos));
    }
    controls.target.copy(followPos);
  } else {
    // follow: ride along with the body as it moves
    const delta = followPos.clone().sub(prevFollowPos);
    camera.position.add(delta);
    controls.target.copy(followPos);
  }
  prevFollowPos.copy(followPos);
  if (parentPos) prevParentPos.copy(parentPos);
}

// ─── UI wiring ────────────────────────────────────────────────────────────

const timeUI = setupTimeControls(sim, sound);

setupToggles({
  'toggle-orbits': (on) => {
    scene.traverse((o) => { if (o.userData.isOrbit) o.visible = on; });
  },
  'toggle-labels': (on) => labels.setVisible(on),
  'toggle-belt': (on) => belt.setVisible(on),
  'toggle-starlink': (on) => {
    for (const c of craft.values()) if (c.isCloud) c.mesh.visible = on;
  },
  'toggle-transfer': (on) => transfer.setEnabled(on),
  'toggle-sound': (on) => sound.setEnabled(on),
  'toggle-truescale': (on) => {
    const u = new URL(location.href);
    if (on) u.searchParams.set('scale', 'true'); else u.searchParams.delete('scale');
    location.href = u.toString(); // scale is baked into geometry — rebuild world
  },
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// phones start with the navigator tucked away — the scene is the hero
if (window.innerWidth < 720) document.getElementById('nav-panel').classList.add('collapsed');

document.getElementById('nav-toggle').addEventListener('click', () => {
  document.getElementById('nav-panel').classList.toggle('collapsed');
});

// ─── Render loop ──────────────────────────────────────────────────────────

// after ~25s of no input with nothing selected, drift cinematically
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const idleState = { last: performance.now() };
const pokeIdle = () => { idleState.last = performance.now(); };
for (const ev of ['pointerdown', 'wheel', 'keydown', 'touchstart']) {
  window.addEventListener(ev, pokeIdle, { passive: true });
}
controls.autoRotateSpeed = 0.18;

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);

  // stepDays tells updates how far playback moved this frame, so fast
  // short-period motion can be smoothed without ever desyncing a paused
  // scene, a date jump, or a direct update(days) call
  const stepDays = sim.playing ? sim.speed * sim.dir * dt : 0;
  if (sim.playing) sim.days += stepDays;

  for (const body of bodies.values()) body.update(sim.days, stepDays);
  for (const c of craft.values()) c.update(sim.days, stepDays);
  belt.update(sim.days);
  transfer.update(sim.days);

  // cinematic drift while the tour dwells; otherwise only after long idle —
  // suppressed entirely for prefers-reduced-motion users
  controls.autoRotate = !reducedMotion && (tour.active
    || (!selected && performance.now() - idleState.last > 25000));
  controls.autoRotateSpeed = tour.active ? 0.4 : 0.18;

  // never let the camera zoom inside the selected body
  controls.minDistance = TRUE_SCALE
    ? 0.002
    : (selected
      ? Math.max(selected.data.kind === 'surface' ? 0.6 : 2, selected.displayRadius * 1.25)
      : 2);

  updateCamera(dt);
  controls.update();
  timeUI.updateDate();
  if (selected) updateLiveStats(selected, bodies.get('earth'), bodies.get('mars'), sim);

  // glints are far-visibility beacons — fade them out up close so the
  // actual spacecraft model is what you see
  for (const c of craft.values()) {
    if (c.isCloud) continue;
    if (c._glint === undefined) c._glint = c.mesh.getObjectByName('glint') ?? null;
    if (c._glint) {
      c.mesh.getWorldPosition(glintTmp);
      const d = camera.position.distanceTo(glintTmp);
      const near = Math.max(TRUE_SCALE ? 0.003 : 6, c.displayRadius * 9);
      c._glint.material.opacity = Math.min(0.45, Math.max(0, (d - near) / (near * 3)));
    }
  }
  labels.update(camera, window.innerWidth, window.innerHeight, selected?.data.id);

  finishing.uniforms.uGrainTime.value = sim.days % 1.0;
  composer.render();
}

animate();

document.getElementById('toggle-truescale').checked = TRUE_SCALE;

// shareable deep links: ?focus=earth jumps to a body, ?date=1986-02-09
// time-travels there
const params = new URLSearchParams(location.search);
const dateParam = params.get('date');
if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
  const [y, m, d] = dateParam.split('-').map(Number);
  sim.days = (Date.UTC(y, m - 1, d, 12) - Date.UTC(2000, 0, 1, 12)) / 86400000;
  // a shared moment should hold still until the visitor presses play
  sim.playing = false;
  const playBtn = document.getElementById('btn-play');
  playBtn.textContent = '▶';
  playBtn.title = 'Play';
}
const focusId = params.get('focus');
if (focusId) {
  const target = bodies.get(focusId) || craft.get(focusId);
  if (target) select(target, { instant: true });
}

// copy a link to the current view (object + sim date + scale mode)
document.getElementById('info-share').addEventListener('click', async () => {
  if (!selected) return;
  const u = new URL(location.origin + location.pathname);
  u.searchParams.set('focus', selected.data.id);
  const d = new Date(Date.UTC(2000, 0, 1, 12) + sim.days * 86400000);
  u.searchParams.set('date', d.toISOString().slice(0, 10));
  if (TRUE_SCALE) u.searchParams.set('scale', 'true');
  window.__lastShareUrl = u.toString(); // exposed for the test suite
  try {
    await navigator.clipboard.writeText(u.toString());
    const btn = document.getElementById('info-share');
    btn.textContent = '✓';
    setTimeout(() => { btn.textContent = '⧉'; }, 1200);
  } catch { /* clipboard unavailable (permissions) — silently skip */ }
});

// first visit? offer the tour (skipped when a deep link brought them here)
const toast = document.getElementById('onboard-toast');
const dismissToast = () => toast.classList.remove('show');
if (!localStorage.getItem('sx-visited') && !focusId) {
  setTimeout(() => {
    if (!selected && !tour.active) toast.classList.add('show');
  }, 1500);
}
localStorage.setItem('sx-visited', '1');
document.getElementById('onboard-tour').addEventListener('click', () => {
  dismissToast();
  tour.start();
});
document.getElementById('onboard-close').addEventListener('click', dismissToast);
canvas.addEventListener('pointerdown', dismissToast, { once: false });
// the toast overlaps the tour banner — starting a tour must clear it
document.getElementById('btn-tour').addEventListener('click', dismissToast);
document.getElementById('btn-spacex-tour').addEventListener('click', dismissToast);

// start focused on the whole system; fade in the HUD
document.body.classList.add('loaded');

// programmatic handle for the test suite (and console tinkering)
window.__sx = {
  bodies, craft, sim, camera, controls, scene, belt, tour, transfer, sound, idleState, finishing,
  select, deselect, raycastAt,
  selected: () => selected,
  frame: () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
};
