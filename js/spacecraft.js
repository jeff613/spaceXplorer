import * as THREE from 'three';
import { SPACECRAFT, scaleDistance, TRUE_SCALE, mulberry32 } from './data.js';
import { keplerPosition, makeSmoothClock } from './bodies.js';

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
  // matte ceramic gray, not pure white — a face-on bright disc plus bloom
  // reads as a glowing orb when focused
  const tps = new THREE.MeshStandardMaterial({
    color: 0xc9c4bb, roughness: 0.85, metalness: 0.05, envMapIntensity: 0.4,
  });
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.035, 32), tps);
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
  g.rotation.set(-0.35, 0.9, 0.15); // show the 3-D profile, not a face-on disc
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

function makeRover() { // Perseverance-class: chassis, rocker-bogie wheels, mast, arm, RTG
  // origin sits at ground level under the chassis (+y up, +x forward) so the
  // surface placement can drop it straight onto the sphere, wheels touching
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.9 });
  // matte ceramic gray like Parker's shield — bright white under direct sun
  // blooms into a glowing blob at close-up
  const matBody = () => new THREE.MeshStandardMaterial({
    color: 0xc6c1b6, roughness: 0.8, metalness: 0.1, envMapIntensity: 0.5,
  });
  const strut = (a, b, r = 0.005) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, va.distanceTo(vb), 8), matBody(),
    );
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), vb.sub(va).normalize(),
    );
    g.add(m);
  };
  // chassis: white deck over a gold-foil belly
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.15), matBody());
  body.position.y = 0.095;
  g.add(body);
  const belly = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.03, 0.12), matFoil());
  belly.position.y = 0.06;
  g.add(belly);
  // six cleated wheels on rocker-bogie suspension, both sides
  const wheelGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.026, 18);
  const hubGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.03, 8);
  // matte hub — a polished-metal one catches the sun and blooms into a blob
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.2, roughness: 0.7 });
  for (const s of [1, -1]) {
    const z = s * 0.1;
    for (const x of [-0.095, 0.005, 0.1]) {
      const w = new THREE.Mesh(wheelGeo, dark);
      w.rotation.x = Math.PI / 2;
      w.position.set(x, 0.028, z);
      g.add(w);
      const hub = new THREE.Mesh(hubGeo, hubMat);
      hub.rotation.x = Math.PI / 2;
      hub.position.set(x, 0.028, z);
      g.add(hub);
    }
    strut([0.035, 0.095, z], [0.1, 0.034, z]); // rocker → front wheel
    strut([0.035, 0.095, z], [-0.045, 0.062, z]); // rocker → bogie pivot
    strut([-0.045, 0.062, z], [0.005, 0.034, z]); // bogie → mid wheel
    strut([-0.045, 0.062, z], [-0.095, 0.034, z]); // bogie → rear wheel
  }
  // camera mast with stereo "head"
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.1, 10), matBody());
  mast.position.set(0.07, 0.17, 0.045);
  g.add(mast);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.042), matBody());
  head.position.set(0.07, 0.231, 0.045);
  g.add(head);
  const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, 0.034), dark);
  eyes.position.set(0.082, 0.231, 0.045);
  g.add(eyes);
  // folded robotic arm hint along the front face
  strut([0.1, 0.085, -0.04], [0.135, 0.06, 0.01], 0.006);
  strut([0.135, 0.06, 0.01], [0.105, 0.05, 0.055], 0.006);
  const turret = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 8), matMetal());
  turret.position.set(0.135, 0.06, 0.01);
  g.add(turret);
  // RTG: finned bronze cylinder angled down off the back
  const rtg = new THREE.Group();
  rtg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.08, 12), matBronze()));
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.078, 0.0025), matMetal());
    fin.rotation.y = (i / 4) * Math.PI;
    rtg.add(fin);
  }
  rtg.rotation.z = Math.PI / 2 + 0.3; // near-horizontal, drooping aft
  rtg.position.set(-0.13, 0.1, 0);
  g.add(rtg);
  // high-gain antenna + UHF whip on the deck
  const hga = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.018, 0.008, 16), matMetal());
  hga.position.set(-0.04, 0.135, -0.045);
  hga.rotation.set(0.4, 0, 0.25);
  g.add(hga);
  const uhf = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.06, 8), matBody());
  uhf.position.set(-0.075, 0.15, 0.05);
  g.add(uhf);
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
    case 'danuri': return makeProbe({ dish: 0.07, panels: 2, scale: 0.5 });
    case 'lro': return makeProbe({ dish: 0.08, panels: 1, scale: 0.55 });
    case 'hubble': return makeTelescope();
    case 'jwst': return makeJWST();
    case 'gaia': return makeProbe({ dish: 0.14, scale: 0.8 });
    case 'soho': return makeProbe({ dish: 0.1, panels: 2, scale: 0.8 });
    case 'parker': {
      // modeled at ~0.34 units — without kit scale the bloom halo around
      // the white shield reads as a glowing orb when focused
      const p = makeParker();
      p.scale.setScalar(5);
      return p;
    }
    case 'roadster': {
      // the car is modeled at ~0.3 units; bring it up to kit scale so a
      // focused close-up fills the frame like every other craft
      const r = makeRoadster();
      r.scale.setScalar(6);
      return r;
    }
    case 'perseverance':
    case 'curiosity': {
      // ~0.28 units long — a miniature against Mars's 1.28-unit radius,
      // clearly smaller than the display-mode orbiters
      const r = makeRover();
      r.scale.setScalar(0.85);
      return r;
    }
    case 'juno': return makeProbe({ dish: 0.16, panels: 3 });
    case 'cassini': return makeProbe({ dish: 0.22 });
    case 'tgo': return makeProbe({ dish: 0.13, panels: 2, scale: 0.6 });
    case 'marsexpress': return makeProbe({ dish: 0.16, panels: 2, scale: 0.65 });
    case 'mro': return makeProbe({ dish: 0.18, panels: 2, scale: 0.7 });
    case 'voyager1':
    case 'voyager2': return makeProbe({ dish: 0.22, scale: 3.2 });
    case 'pioneer10':
    case 'pioneer11': return makeProbe({ dish: 0.22, scale: 3.2 });
    case 'newhorizons': return makeProbe({ dish: 0.2, scale: 3.2 });
    default: return makeProbe({ scale: 0.8 });
  }
}

// In TRUE_SCALE the kit models (built at ~0.3–0.8 scene units for the
// exaggerated display mode) would dwarf the now-tiny planets, while literal
// physical size (ISS ≈ 109 m ≈ 5e-8 units) would be sub-pixel and
// unframeable — so craft become proportionate miniatures instead. Returns
// the fitted bounding radius for camera-framing use.
function trueScaleFit(mesh, targetR) {
  const sphere = new THREE.Box3().setFromObject(mesh)
    .getBoundingSphere(new THREE.Sphere());
  mesh.scale.multiplyScalar(targetR / sphere.radius);
  return targetR;
}

// Invisible, oversized sphere so tiny craft are clickable
function addPickProxy(mesh, radius) {
  const proxy = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 8, 4),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  proxy.name = 'pickproxy';
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
      const displayRadius = TRUE_SCALE
        ? trueScaleFit(mesh, parent.displayRadius * 0.1) : 0.6;
      mesh.add(makeGlint(data.color, 0.3));
      mesh.name = data.id;
      const plane = new THREE.Group();
      plane.rotation.x = data.inclination * DEG;
      plane.add(mesh);
      parent.anchor.add(plane);
      const pick = addPickProxy(mesh, 1.0);
      const phase = rand() * Math.PI * 2;
      const orbitClock = makeSmoothClock(data.periodDays);
      craft.set(data.id, {
        data, mesh, pick, displayRadius,
        update(days, stepDays) {
          const a = phase + (orbitClock(days, stepDays) / data.periodDays) * Math.PI * 2;
          mesh.position.set(Math.cos(a) * orbitR, 0, Math.sin(a) * orbitR);
          mesh.rotation.y = -a;
        },
      });
    } else if (data.kind === 'lagrange') {
      // L1/L2 sit on the Sun–Earth line; factor <1 = sunward L1, >1 = L2
      // (display-exaggerated)
      const mesh = craftMesh(data);
      const displayRadius = TRUE_SCALE
        ? trueScaleFit(mesh, earth.displayRadius * 0.5) : 0.7;
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
        data, mesh, pick, displayRadius,
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
      const displayRadius = TRUE_SCALE
        ? trueScaleFit(mesh, parent.displayRadius * 0.06) : 0.25;
      mesh.add(makeGlint(data.color, 0.12));
      mesh.name = data.id;
      const lat = data.lat * DEG;
      const lon = data.lon * DEG;
      // local surface normal at lat/lon — the rover's "up"
      const normal = new THREE.Vector3(
        Math.cos(lat) * Math.cos(lon),
        Math.sin(lat),
        -Math.cos(lat) * Math.sin(lon),
      );
      // stand it on its wheels: +y along the radial, model origin is at
      // wheel-bottom level; sit a hair low so the sphere's facets (the
      // rendered surface sags below the ideal radius between vertices)
      // never leave the wheels hovering
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      mesh.rotateY(lon); // stable per-site heading so the two rovers differ
      mesh.position.copy(normal).multiplyScalar(parent.displayRadius * 0.998);
      parent.mesh.add(mesh);
      const pick = addPickProxy(mesh, 0.7);
      craft.set(data.id, { data, mesh, pick, displayRadius, update() {} });
    } else if (data.kind === 'helio') {
      const mesh = craftMesh(data);
      const displayRadius = TRUE_SCALE
        ? trueScaleFit(mesh, earth.displayRadius * 0.5) : 0.8;
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
      // eccentric orbits sweep fastest at perihelion (Parker: ~33× its mean
      // rate) — shorten the clock's period by that factor so the cap holds
      const e = data.elements.e;
      const periBoost = Math.pow(1 + e, 2) / Math.pow(1 - e * e, 1.5);
      const orbitClock = makeSmoothClock(data.elements.period / periBoost);
      craft.set(data.id, {
        data, mesh, pick, orbitLine, displayRadius,
        update(days, stepDays) {
          keplerPosition(data.elements, orbitClock(days, stepDays), mesh.position);
        },
      });
    } else if (data.kind === 'deep') {
      const mesh = craftMesh(data);
      const displayRadius = TRUE_SCALE
        ? trueScaleFit(mesh, earth.displayRadius * 0.5) : 2.5;
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
      // distances were entered for mid-2026 (J2000 + 9657 days); the real
      // probes keep receding, so they drift outward with sim time
      const trailPos = trail.geometry.attributes.position;
      craft.set(data.id, {
        data, mesh, pick, orbitLine: trail, displayRadius,
        update(days) {
          const au = Math.max(6, data.distanceAU
            + (data.speedAUyr ?? 0) * ((days - 9657) / 365.25));
          mesh.position.copy(dir).multiplyScalar(scaleDistance(au));
          trailPos.setXYZ(1, mesh.position.x, mesh.position.y, mesh.position.z);
          trailPos.needsUpdate = true;
        },
      });
    } else if (data.kind === 'constellation') {
      craft.set(data.id, buildStarlink(earth, data));
    }
  }
  return craft;
}

// Constellation: one Points cloud, each satellite on its own inclined
// circular orbit, updated on CPU. Starlink's structure is the real
// constellation's, baked from a CelesTrak snapshot (data.src →
// textures/starlink-shells.json): per-shell inclination / altitude /
// period plus a downsampled per-sat RAAN+phase list, so the dense ~53°
// band edges and the polar shells render true. GPS and the GEO ring stay
// procedural (one uniform shell from count/orbitRadii/periodDays).
function buildStarlink(earth, data) {
  let N = 0;
  let positions, raan, phase, orbitR, w, cosI, sinI;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    color: data.color, size: 2.2, sizeAttenuation: false,
    map: roundPointTexture(), alphaTest: 0.25,
    transparent: true, opacity: 0.9, depthWrite: false,
  }));
  points.name = data.id;
  earth.anchor.add(points);

  // anti-strobe clock shared by the cloud; rebuilt from the shortest shell
  // period once the baked shells arrive (procedural clouds keep data's)
  let orbitClock = makeSmoothClock(data.periodDays ?? 0.066);

  // shells: [{ orbitR, periodDays, incDeg, sats: [[raanDeg, phaseDeg], …] }]
  function fill(shells) {
    orbitClock = makeSmoothClock(Math.min(...shells.map((sh) => sh.periodDays)));
    N = shells.reduce((sum, sh) => sum + sh.sats.length, 0);
    positions = new Float32Array(N * 3);
    raan = new Float32Array(N); phase = new Float32Array(N);
    orbitR = new Float32Array(N); w = new Float32Array(N);
    cosI = new Float32Array(N); sinI = new Float32Array(N);
    let i = 0;
    for (const sh of shells) {
      const wSh = (Math.PI * 2) / sh.periodDays;
      const inc = sh.incDeg * DEG;
      for (const [raanDeg, phaseDeg] of sh.sats) {
        raan[i] = raanDeg * DEG; phase[i] = phaseDeg * DEG;
        orbitR[i] = sh.orbitR; w[i] = wSh;
        cosI[i] = Math.cos(inc); sinI[i] = Math.sin(inc);
        i++;
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  }

  if (data.src) {
    fetch(data.src).then((r) => r.json()).then((json) => {
      fill(json.shells.map((sh) => ({
        // altitude exaggerated ~11× (550 km would hug the display globe);
        // relative shell spacing is kept true
        orbitR: earth.displayRadius * (1 + sh.altKm / 1000),
        periodDays: sh.periodMin / 1440,
        incDeg: sh.incDeg,
        sats: sh.sats,
      })));
      data.info['Satellites'] = `${json.totalTracked.toLocaleString('en-US')} tracked (constellation snapshot ${json.snapshot})`;
    });
  } else {
    fill([{
      orbitR: earth.displayRadius * data.orbitRadii,
      periodDays: data.periodDays,
      incDeg: data.inclination,
      sats: Array.from({ length: data.count }, () => [rand() * 360, rand() * 360]),
    }]);
  }

  return {
    data, mesh: points, displayRadius: earth.displayRadius * 1.8, isCloud: true,
    update(days, stepDays) {
      const t = orbitClock(days, stepDays);
      for (let i = 0; i < N; i++) {
        const a = phase[i] + t * w[i];
        const xo = Math.cos(a) * orbitR[i];
        const zo = Math.sin(a) * orbitR[i];
        // incline, then rotate plane by RAAN
        const yi = -zo * sinI[i];
        const zi = zo * cosI[i];
        const cR = Math.cos(raan[i]), sR = Math.sin(raan[i]);
        positions[i * 3] = xo * cR - zi * sR;
        positions[i * 3 + 1] = yi;
        positions[i * 3 + 2] = xo * sR + zi * cR;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
