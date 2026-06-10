import * as THREE from 'three';
import { SPACECRAFT, scaleDistance, TRUE_SCALE, mulberry32 } from './data.js';
import { keplerPosition } from './bodies.js';

const DEG = Math.PI / 180;
const rand = mulberry32(48151623);

// ─── Procedural spacecraft model kit ──────────────────────────────────────
// Recognizable miniatures built from primitives with PBR materials, so they
// catch real sunlight instead of reading as flat glowing dots.

const matMetal = () => new THREE.MeshStandardMaterial({ color: 0xd2d8de, metalness: 0.9, roughness: 0.28, envMapIntensity: 1.3 });
const matWhite = () => new THREE.MeshStandardMaterial({ color: 0xe8e6e0, metalness: 0.15, roughness: 0.5, envMapIntensity: 0.9 });
const matFoil = () => new THREE.MeshStandardMaterial({ color: 0xc89a3c, metalness: 1.0, roughness: 0.32, envMapIntensity: 1.4 });
const matPanel = () => new THREE.MeshStandardMaterial({ color: 0x1d3a6e, metalness: 0.75, roughness: 0.25, envMapIntensity: 1.2 });
const matBronze = () => new THREE.MeshStandardMaterial({ color: 0x8a6d3a, metalness: 0.85, roughness: 0.38, envMapIntensity: 1.2 });

// faint sprite glint so craft stay visible from far away
let glintTex = null;
function makeGlint(color, scale = 0.9) {
  if (!glintTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.25)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    glintTex = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glintTex, color, blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, opacity: 0.28,
  }));
  s.scale.setScalar(scale);
  s.name = 'glint';
  s.raycast = () => {};
  return s;
}

let roundTex = null;
function roundPointTexture() {
  if (roundTex) return roundTex;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  roundTex = new THREE.CanvasTexture(c);
  return roundTex;
}

function makeDish(r = 0.2) {
  const g = new THREE.Group();
  const bowl = new THREE.Mesh(
    new THREE.SphereGeometry(r, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.24),
    new THREE.MeshStandardMaterial({
      color: 0xcdd4da, metalness: 0.75, roughness: 0.35,
      envMapIntensity: 1.2, side: THREE.DoubleSide,
    }),
  );
  bowl.rotation.x = Math.PI / 2; // open toward +z
  g.add(bowl);
  const rimR = r * Math.sin(Math.PI * 0.24);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(rimR, r * 0.02, 8, 48), matMetal());
  rim.position.z = r * Math.cos(Math.PI * 0.24) - r * 0.005;
  g.add(rim);
  const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.012, r * 0.85, 8), matMetal());
  feed.rotation.x = Math.PI / 2;
  feed.position.z = r * 0.4;
  g.add(feed);
  const horn = new THREE.Mesh(new THREE.SphereGeometry(r * 0.08, 12, 8), matFoil());
  horn.position.z = r * 0.82;
  g.add(horn);
  return g;
}

// Generic deep-space probe: foil bus + big dish + RTG boom
function makeProbe({ dish = 0.26, panels = 0, scale = 1 } = {}) {
  const g = new THREE.Group();
  const bus = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.16), matFoil());
  g.add(bus);
  const d = makeDish(dish);
  d.position.z = 0.08;
  g.add(d);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.4, 12), matMetal());
  boom.rotation.z = Math.PI / 2;
  boom.position.x = -0.26;
  g.add(boom);
  const rtg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 16), matBronze());
  rtg.rotation.z = Math.PI / 2;
  rtg.position.x = -0.44;
  g.add(rtg);
  for (let i = 0; i < panels; i++) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.006, 0.14), matPanel());
    const a = (i / panels) * Math.PI * 2;
    wing.position.set(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3);
    wing.rotation.y = -a;
    g.add(wing);
  }
  g.scale.setScalar(scale);
  return g;
}

function makeTelescope() { // Hubble-like: silver tube + panels
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.42, 28), matMetal());
  tube.rotation.x = Math.PI / 2;
  g.add(tube);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.04, 28), matFoil());
  cap.rotation.x = Math.PI / 2;
  cap.position.z = 0.2;
  g.add(cap);
  for (const x of [-0.22, 0.22]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.005, 0.3), matPanel());
    wing.position.x = x;
    g.add(wing);
  }
  return g;
}

function makeJWST() { // gold hex mirror over a silver kite sunshield
  const g = new THREE.Group();
  const mirror = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.015, 6),
    new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 1.0, roughness: 0.25 }),
  );
  mirror.position.y = 0.09;
  g.add(mirror);
  const shield = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.34),
    new THREE.MeshStandardMaterial({
      color: 0xcfc2e8, metalness: 0.9, roughness: 0.35, side: THREE.DoubleSide,
    }),
  );
  shield.rotation.x = -Math.PI / 2;
  g.add(shield);
  const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.1, 5), matMetal());
  strut.position.y = 0.045;
  g.add(strut);
  return g;
}

function makeParker() { // white heat shield facing a small bus
  const g = new THREE.Group();
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.035, 32), matWhite());
  shield.rotation.x = Math.PI / 2;
  shield.position.z = 0.1;
  g.add(shield);
  const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 20), matMetal());
  bus.rotation.x = Math.PI / 2;
  g.add(bus);
  for (const x of [-0.12, 0.12]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.004, 0.08), matPanel());
    wing.position.set(x, 0, -0.02);
    g.add(wing);
  }
  return g;
}

function makeRoadster() { // cherry-red car, headed for the asteroid belt
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xc41e2f, metalness: 0.7, roughness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.13), red);
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.045, 0.11),
    new THREE.MeshStandardMaterial({ color: 0x202830, metalness: 0.4, roughness: 0.2 }));
  cabin.position.set(-0.01, 0.045, 0);
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.02, 18);
  const dark = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 });
  for (const [x, z] of [[-0.1, 0.07], [0.1, 0.07], [-0.1, -0.07], [0.1, -0.07]]) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, -0.03, z);
    g.add(w);
  }
  return g;
}

function makeRover() { // boxy body, mast, six wheels
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.07), matWhite());
  g.add(body);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.06, 10), matMetal());
  mast.position.set(0.03, 0.05, 0);
  g.add(mast);
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.9 });
  for (const x of [-0.04, 0, 0.04]) {
    for (const z of [0.045, -0.045]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 14), dark);
      w.rotation.x = Math.PI / 2;
      w.position.set(x, -0.028, z);
      g.add(w);
    }
  }
  return g;
}

function makeISSMesh() { // truss, bronze-gold arrays, module stack, radiators
  const g = new THREE.Group();
  const truss = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.035, 0.035), matMetal());
  g.add(truss);
  // pressurized modules along z, with a node sphere and a docked capsule
  for (const [z, len, r] of [[0.0, 0.5, 0.05], [0.18, 0.22, 0.04]]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 24), matWhite());
    m.rotation.x = Math.PI / 2;
    m.position.z = z * 0.6;
    g.add(m);
  }
  const node = new THREE.Mesh(new THREE.SphereGeometry(0.055, 20, 14), matWhite());
  node.position.z = 0.25;
  g.add(node);
  const capsule = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.034, 0.08, 16), matFoil());
  capsule.rotation.x = Math.PI / 2;
  capsule.position.z = 0.32;
  g.add(capsule);
  // four solar array pairs, ISS-bronze
  for (const x of [-0.46, -0.3, 0.3, 0.46]) {
    for (const z of [0.16, -0.16]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.004, 0.26), matBronze());
      wing.position.set(x, 0, z);
      g.add(wing);
    }
  }
  // white radiators
  for (const x of [-0.12, 0.12]) {
    const rad = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.003, 0.1), matWhite());
    rad.position.set(x, -0.05, 0);
    rad.rotation.x = 0.5;
    g.add(rad);
  }
  return g;
}

// model picker — every craft gets a real miniature
function craftMesh(data) {
  switch (data.id) {
    case 'iss': return makeISSMesh();
    case 'tiangong': {
      const t = makeISSMesh();
      t.scale.setScalar(0.55);
      return t;
    }
    case 'lro': return makeProbe({ dish: 0.08, panels: 1, scale: 0.55 });
    case 'hubble': return makeTelescope();
    case 'jwst': return makeJWST();
    case 'gaia': return makeProbe({ dish: 0.14, scale: 0.8 });
    case 'soho': return makeProbe({ dish: 0.1, panels: 2, scale: 0.8 });
    case 'parker': return makeParker();
    case 'roadster': return makeRoadster();
    case 'perseverance':
    case 'curiosity': return makeRover();
    case 'juno': return makeProbe({ dish: 0.16, panels: 3 });
    case 'cassini': return makeProbe({ dish: 0.22 });
    case 'mro': return makeProbe({ dish: 0.18, panels: 2, scale: 0.7 });
    case 'voyager1':
    case 'voyager2': return makeProbe({ dish: 0.22, scale: 3.2 });
    case 'pioneer10':
    case 'pioneer11': return makeProbe({ dish: 0.22, scale: 3.2 });
    case 'newhorizons': return makeProbe({ dish: 0.2, scale: 3.2 });
    default: return makeProbe({ scale: 0.8 });
  }
}

// Invisible, oversized sphere so tiny craft are clickable
function addPickProxy(mesh, radius) {
  const proxy = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 8, 4),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  mesh.add(proxy);
  return proxy;
}

function raDecToDir(raDeg, decDeg) {
  const ra = raDeg * DEG, dec = decDeg * DEG;
  // equatorial → rough scene direction (good enough for a map marker)
  return new THREE.Vector3(
    Math.cos(dec) * Math.cos(ra),
    Math.sin(dec),
    -Math.cos(dec) * Math.sin(ra),
  );
}

export function buildSpacecraft(scene, bodies) {
  const craft = new Map();
  const earth = bodies.get('earth');

  for (const data of SPACECRAFT) {
    if (data.kind === 'orbiter') {
      const parent = bodies.get(data.parent);
      const orbitR = parent.displayRadius * data.orbitRadii;
      const mesh = craftMesh(data);
      if (TRUE_SCALE) mesh.scale.multiplyScalar(0.02);
      mesh.add(makeGlint(data.color, 0.3));
      mesh.name = data.id;
      const plane = new THREE.Group();
      plane.rotation.x = data.inclination * DEG;
      plane.add(mesh);
      parent.anchor.add(plane);
      const pick = addPickProxy(mesh, 1.0);
      const phase = rand() * Math.PI * 2;
      craft.set(data.id, {
        data, mesh, pick, displayRadius: 0.6,
        update(days) {
          const a = phase + (days / data.periodDays) * Math.PI * 2;
          mesh.position.set(Math.cos(a) * orbitR, 0, Math.sin(a) * orbitR);
          mesh.rotation.y = -a;
        },
      });
    } else if (data.kind === 'lagrange') {
      // L1/L2 sit on the Sun–Earth line; factor <1 = sunward L1, >1 = L2
      // (display-exaggerated)
      const mesh = craftMesh(data);
      if (TRUE_SCALE) mesh.scale.multiplyScalar(0.02);
      mesh.add(makeGlint(data.color, 0.35));
      mesh.name = data.id;
      scene.add(mesh);
      const pick = addPickProxy(mesh, 1.2);
      // real L-point craft fly halo orbits around the point, not on it
      const haloPhase = rand() * Math.PI * 2;
      const haloR = TRUE_SCALE ? 0.02 : 0.45;
      const u = new THREE.Vector3();
      const w = new THREE.Vector3(0, 1, 0);
      craft.set(data.id, {
        data, mesh, pick, displayRadius: 0.7,
        update(days) {
          mesh.position.copy(earth.anchor.position).multiplyScalar(data.factor);
          const th = haloPhase + (days / 178) * Math.PI * 2; // ~6-month halo
          u.copy(earth.anchor.position).normalize().cross(w);
          mesh.position.addScaledVector(u, Math.cos(th) * haloR);
          mesh.position.y += Math.sin(th) * haloR * 0.6;
        },
      });
    } else if (data.kind === 'surface') {
      // rover pinned to the parent's surface at lat/lon — added as a child
      // of the spinning mesh so it rides the planet's rotation
      const parent = bodies.get(data.parent);
      const mesh = craftMesh(data);
      if (TRUE_SCALE) mesh.scale.multiplyScalar(0.02);
      mesh.add(makeGlint(data.color, 0.12));
      mesh.name = data.id;
      const lat = data.lat * DEG;
      const lon = data.lon * DEG;
      const r = parent.displayRadius * 1.01;
      mesh.position.set(
        r * Math.cos(lat) * Math.cos(lon),
        r * Math.sin(lat),
        -r * Math.cos(lat) * Math.sin(lon),
      );
      parent.mesh.add(mesh);
      const pick = addPickProxy(mesh, 0.7);
      craft.set(data.id, { data, mesh, pick, displayRadius: 0.45, update() {} });
    } else if (data.kind === 'helio') {
      const mesh = craftMesh(data);
      if (TRUE_SCALE) mesh.scale.multiplyScalar(0.02);
      mesh.add(makeGlint(data.color, 0.35));
      mesh.name = data.id;
      scene.add(mesh);
      const pick = addPickProxy(mesh, 1.4);
      // orbit path
      const pts = [];
      const tmp = new THREE.Vector3();
      for (let k = 0; k <= 256; k++) {
        keplerPosition(data.elements, (k / 256) * data.elements.period, tmp);
        pts.push(tmp.clone());
      }
      const orbitLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: data.color, transparent: true, opacity: 0.35 }),
      );
      orbitLine.userData.isOrbit = true;
      scene.add(orbitLine);
      craft.set(data.id, {
        data, mesh, pick, orbitLine, displayRadius: 0.8,
        update(days) { keplerPosition(data.elements, days, mesh.position); },
      });
    } else if (data.kind === 'deep') {
      const mesh = craftMesh(data);
      if (TRUE_SCALE) mesh.scale.multiplyScalar(0.02);
      mesh.add(makeGlint(data.color, 0.4));
      mesh.name = data.id;
      const dir = raDecToDir(data.raDeg, data.decDeg);
      mesh.position.copy(dir).multiplyScalar(scaleDistance(data.distanceAU));
      mesh.lookAt(0, 0, 0); // the real ones aim their dishes at Earth
      mesh.rotateY(0.65); // ... shown at a slight angle so the dish reads as a dish
      mesh.rotateX(-0.15);
      scene.add(mesh);
      const pick = addPickProxy(mesh, 6);
      // trajectory hint: faint line from the inner system outward
      const trail = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          dir.clone().multiplyScalar(scaleDistance(5)), mesh.position.clone(),
        ]),
        new THREE.LineBasicMaterial({ color: data.color, transparent: true, opacity: 0.18 }),
      );
      trail.userData.isOrbit = true;
      scene.add(trail);
      craft.set(data.id, {
        data, mesh, pick, orbitLine: trail, displayRadius: 2.5,
        update() {},
      });
    } else if (data.kind === 'constellation') {
      craft.set(data.id, buildStarlink(earth, data));
    }
  }
  return craft;
}

// Starlink: one Points cloud, each satellite on its own inclined circular
// orbit (shared 53° inclination, random RAAN + phase), updated on CPU.
function buildStarlink(earth, data) {
  const N = data.count;
  const orbitR = earth.displayRadius * data.orbitRadii;
  const raan = new Float32Array(N);
  const phase = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    raan[i] = rand() * Math.PI * 2;
    phase[i] = rand() * Math.PI * 2;
  }
  const positions = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    color: data.color, size: 2.2, sizeAttenuation: false,
    map: roundPointTexture(), alphaTest: 0.25,
    transparent: true, opacity: 0.9, depthWrite: false,
  }));
  points.name = data.id;
  earth.anchor.add(points);

  const inc = data.inclination * DEG;
  const cosI = Math.cos(inc), sinI = Math.sin(inc);
  const w = (Math.PI * 2) / data.periodDays;

  return {
    data, mesh: points, displayRadius: earth.displayRadius * 1.8, isCloud: true,
    update(days) {
      for (let i = 0; i < N; i++) {
        const a = phase[i] + days * w;
        const xo = Math.cos(a) * orbitR;
        const zo = Math.sin(a) * orbitR;
        // incline, then rotate plane by RAAN
        const yi = -zo * sinI;
        const zi = zo * cosI;
        const cR = Math.cos(raan[i]), sR = Math.sin(raan[i]);
        positions[i * 3] = xo * cR - zi * sR;
        positions[i * 3 + 1] = yi;
        positions[i * 3 + 2] = xo * sR + zi * cR;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
