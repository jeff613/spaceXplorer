import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { daysSinceJ2000 } from './data.js';
import { buildSolarSystem } from './bodies.js';
import { buildSpacecraft } from './spacecraft.js';
import { createTour } from './tour.js';
import {
  buildNavigator, showInfo, hideInfo, createLabels, setupTimeControls, setupToggles,
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
const camera = new THREE.PerspectiveCamera(
  55, window.innerWidth / window.innerHeight, 0.1, 20000,
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

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 2;
controls.maxDistance = 3500;

// ─── World ────────────────────────────────────────────────────────────────

const { bodies, belt } = buildSolarSystem(scene);
const craft = buildSpacecraft(scene, bodies);

// ─── Simulation clock ─────────────────────────────────────────────────────

const sim = { days: daysSinceJ2000(), speed: 1, dir: 1, playing: true };

// ─── Selection & camera follow ────────────────────────────────────────────

let selected = null;
let flight = null; // { t, fromPos, fromTarget }
const followPos = new THREE.Vector3();
const prevFollowPos = new THREE.Vector3();

// manual selection anywhere exits an active tour
const userSelect = (body) => { tour.stop(); select(body); };
const navigator = buildNavigator(bodies, craft, userSelect);
const labels = createLabels(bodies, craft, userSelect);
const tour = createTour(bodies, craft, select);

function select(body, { instant = false } = {}) {
  selected = body;
  navigator.setActive(body.data.id);
  showInfo(body);
  body.mesh.getWorldPosition(followPos);
  prevFollowPos.copy(followPos);
  if (instant) {
    const viewDist = Math.max(4, body.displayRadius * 5.5);
    const dir = camera.position.clone().sub(followPos).normalize();
    if (dir.lengthSq() < 0.5) dir.set(0.4, 0.35, 1).normalize();
    camera.position.copy(followPos).add(dir.multiplyScalar(viewDist));
    controls.target.copy(followPos);
    flight = null;
  } else {
    flight = { t: 0, fromPos: camera.position.clone(), fromTarget: controls.target.clone() };
  }
}

function deselect() {
  selected = null;
  flight = null;
  navigator.setActive(null);
  hideInfo();
}

document.getElementById('info-close').addEventListener('click', deselect);

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

  // walk up to the named object, then find its body
  let obj = hits[0].object;
  while (obj && !obj.name) obj = obj.parent;
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

  if (flight) {
    // fly-to: ease camera toward a viewing spot near the body
    flight.t = Math.min(1, flight.t + dt / 1.4);
    const k = 1 - Math.pow(1 - flight.t, 3); // easeOutCubic
    const viewDist = Math.max(4, selected.displayRadius * 5.5);
    const dir = flight.fromPos.clone().sub(followPos).normalize();
    if (dir.lengthSq() < 0.5) dir.set(0.4, 0.35, 1).normalize();
    const destPos = followPos.clone().add(dir.multiplyScalar(viewDist));
    camera.position.lerpVectors(flight.fromPos, destPos, k);
    controls.target.lerpVectors(flight.fromTarget, followPos, k);
    // gentle FOV breath mid-flight for a cinematic dolly feel
    camera.fov = 55 + 6 * Math.sin(Math.PI * k);
    camera.updateProjectionMatrix();
    if (flight.t >= 1) {
      flight = null;
      camera.fov = 55;
      camera.updateProjectionMatrix();
    }
  } else {
    // follow: ride along with the body as it moves
    const delta = followPos.clone().sub(prevFollowPos);
    camera.position.add(delta);
    controls.target.copy(followPos);
  }
  prevFollowPos.copy(followPos);
}

// ─── UI wiring ────────────────────────────────────────────────────────────

const timeUI = setupTimeControls(sim);

setupToggles({
  'toggle-orbits': (on) => {
    scene.traverse((o) => { if (o.userData.isOrbit) o.visible = on; });
  },
  'toggle-labels': (on) => labels.setVisible(on),
  'toggle-belt': (on) => belt.setVisible(on),
  'toggle-starlink': (on) => {
    for (const c of craft.values()) if (c.isCloud) c.mesh.visible = on;
  },
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

document.getElementById('nav-toggle').addEventListener('click', () => {
  document.getElementById('nav-panel').classList.toggle('collapsed');
});

// ─── Render loop ──────────────────────────────────────────────────────────

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);

  if (sim.playing) sim.days += sim.speed * sim.dir * dt;

  for (const body of bodies.values()) body.update(sim.days);
  for (const c of craft.values()) c.update(sim.days);
  belt.update(sim.days);

  updateCamera(dt);
  controls.update();
  timeUI.updateDate();
  labels.update(camera, window.innerWidth, window.innerHeight, selected?.data.id);

  composer.render();
}

animate();

// shareable deep link: ?focus=earth jumps straight to a body
const focusId = new URLSearchParams(location.search).get('focus');
if (focusId) {
  const target = bodies.get(focusId) || craft.get(focusId);
  if (target) select(target, { instant: true });
}

// start focused on the whole system; fade in the HUD
document.body.classList.add('loaded');

// programmatic handle for the test suite (and console tinkering)
window.__sx = {
  bodies, craft, sim, camera, controls, scene, belt, tour,
  select, deselect, raycastAt,
  selected: () => selected,
  frame: () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
};
