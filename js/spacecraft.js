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

function makeRoadster() { // 2008 Tesla Roadster + Starman, Feb 2018 press-photo style
  // +x = nose, +y = up, ~0.3 units long (kit footprint preserved)
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color: 0xb01225, metalness: 0.8, roughness: 0.22, envMapIntensity: 1.3,
  });
  const trim = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.85, metalness: 0.2 });
  const tubMat = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.9 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x16222e, metalness: 0.1, roughness: 0.25, envMapIntensity: 0.35,
    transparent: true, opacity: 0.3, side: THREE.DoubleSide,
  });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.8, roughness: 0.4 });
  // slightly off-white matte (see makeParker) — a pure-white suit blooms
  const suit = new THREE.MeshStandardMaterial({
    color: 0xd8d4ca, roughness: 0.8, metalness: 0.05, envMapIntensity: 0.5,
  });

  // body: extruded side profile — tapered nose, cowl, cut-down doors, rear deck
  const sp = new THREE.Shape();
  sp.moveTo(-0.135, 0.004);
  sp.quadraticCurveTo(-0.148, 0.02, -0.138, 0.04); // rounded kamm tail
  sp.quadraticCurveTo(-0.115, 0.052, -0.085, 0.046); // rear deck hump
  sp.quadraticCurveTo(-0.05, 0.036, -0.02, 0.034); // cut-down to the door line
  sp.lineTo(0.02, 0.034); // door top
  sp.quadraticCurveTo(0.05, 0.048, 0.08, 0.042); // cowl
  sp.quadraticCurveTo(0.12, 0.032, 0.142, 0.016); // hood sloping to the nose
  sp.quadraticCurveTo(0.15, 0.008, 0.142, 0.002); // nose tip
  sp.closePath();
  const bodyGeo = new THREE.ExtrudeGeometry(sp, {
    depth: 0.096, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01,
    bevelSegments: 4, curveSegments: 16,
  });
  bodyGeo.translate(0, 0, -0.048); // center the width
  g.add(new THREE.Mesh(bodyGeo, paint));

  // fender bulges over the wheels
  const fenderGeo = new THREE.SphereGeometry(1, 16, 12);
  for (const x of [0.092, -0.092]) {
    for (const z of [0.054, -0.054]) {
      const f = new THREE.Mesh(fenderGeo, paint);
      f.scale.set(0.05, 0.022, 0.016);
      f.position.set(x, 0.022, z);
      g.add(f);
    }
  }

  // wheels: visible dark-grey tire, silver rim ring + 5 spokes over a black barrel
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x282b30, roughness: 0.85 });
  const tireGeo = new THREE.CylinderGeometry(0.0305, 0.0305, 0.022, 24);
  const barrelGeo = new THREE.CylinderGeometry(0.017, 0.017, 0.018, 16);
  const hubGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.025, 8);
  const ringGeo = new THREE.TorusGeometry(0.0165, 0.0035, 8, 24);
  const spokeGeo = new THREE.BoxGeometry(0.0055, 0.026, 0.0045);
  spokeGeo.translate(0, 0.0065, 0); // radiate hub → rim
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x0c0e10, roughness: 0.9 });
  for (const [x, z] of [[0.092, 0.058], [0.092, -0.058], [-0.092, 0.058], [-0.092, -0.058]]) {
    const w = new THREE.Group();
    for (const [geo, m] of [[tireGeo, tireMat], [barrelGeo, barrelMat], [hubGeo, rimMat]]) {
      const part = new THREE.Mesh(geo, m);
      part.rotation.x = Math.PI / 2;
      w.add(part);
    }
    const face = Math.sign(z) * 0.0115;
    const ring = new THREE.Mesh(ringGeo, rimMat);
    ring.position.z = face;
    w.add(ring);
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(spokeGeo, rimMat);
      s.rotation.z = (i / 5) * Math.PI * 2;
      s.position.z = face;
      w.add(s);
    }
    w.position.set(x, -0.007, z);
    g.add(w);
  }

  // open cockpit: black interior tub, two reclined seats, dash
  const tub = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.02, 0.082), tubMat);
  tub.position.set(-0.005, 0.026, 0);
  g.add(tub);
  for (const z of [-0.028, 0.028]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.034, 0.03), tubMat);
    seat.position.set(-0.048, 0.04, z);
    seat.rotation.z = 0.28; // reclined
    g.add(seat);
  }
  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 0.08), tubMat);
  dash.position.set(0.04, 0.036, 0);
  g.add(dash);

  // raked tinted windshield + tiny side mirrors
  const ws = new THREE.Mesh(new THREE.BoxGeometry(0.0025, 0.032, 0.078), glass);
  ws.position.set(0.032, 0.052, 0);
  ws.rotation.z = 0.5;
  g.add(ws);
  for (const z of [-0.062, 0.062]) {
    const mir = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.009, 0.012), trim);
    mir.position.set(0.038, 0.048, z);
    g.add(mir);
  }

  // headlight hints on the nose
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xe2e8ec, metalness: 0.3, roughness: 0.4 });
  for (const z of [-0.037, 0.037]) {
    const hl = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), lightMat);
    hl.scale.set(0.008, 0.009, 0.017);
    hl.position.set(0.138, 0.021, z);
    g.add(hl);
  }

  // steering wheel (left-hand drive) + column
  const sw = new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.0022, 8, 20), trim);
  sw.position.set(0.012, 0.044, -0.028);
  sw.rotation.set(0, Math.PI / 2, 0);
  sw.rotateX(-0.35); // raked toward the driver
  g.add(sw);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.022, 8), tubMat);
  col.position.set(0.025, 0.042, -0.028);
  col.rotation.z = Math.PI / 2 - 0.35;
  g.add(col);

  // STARMAN — white-suited figure in the left seat, left arm on the door
  const limb = (a, b, r) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, va.distanceTo(vb), 4, 10), suit);
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.sub(va).normalize());
    g.add(m);
  };
  limb([-0.05, 0.03, -0.028], [-0.038, 0.056, -0.028], 0.012); // torso, reclined
  limb([-0.038, 0.054, -0.04], [-0.018, 0.044, -0.058], 0.005); // L upper arm
  limb([-0.018, 0.044, -0.058], [0.012, 0.042, -0.056], 0.005); // L forearm on door
  limb([-0.038, 0.054, -0.016], [-0.002, 0.046, -0.022], 0.005); // R arm to the wheel
  limb([-0.048, 0.03, -0.034], [-0.012, 0.036, -0.034], 0.0055); // L thigh
  limb([-0.048, 0.03, -0.022], [-0.012, 0.036, -0.022], 0.0055); // R thigh
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.0115, 14, 12), suit);
  head.position.set(-0.033, 0.073, -0.028);
  g.add(head);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.0095, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x0e1014, metalness: 0.5, roughness: 0.2 }));
  visor.scale.set(0.75, 0.8, 0.9);
  visor.position.set(-0.027, 0.073, -0.028);
  g.add(visor);

  g.rotation.set(-0.14, 0.55, 0.16); // rakish press-photo attitude
  return g;
}

function makeDragon() { // white gumdrop capsule, PICA-X heatshield, trunk with solar fin
  const g = new THREE.Group();
  // matte off-white — brighter and the bloom turns the capsule into an orb
  const white = new THREE.MeshStandardMaterial({ color: 0xd9d5cd, metalness: 0.15, roughness: 0.55, envMapIntensity: 0.9 });
  const pica = new THREE.MeshStandardMaterial({ color: 0x3a2e26, metalness: 0.15, roughness: 0.85 });
  // capsule hull, nose toward +z
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.095, 0.13, 28), white);
  hull.rotation.x = Math.PI / 2;
  g.add(hull);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), white);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 0.065;
  g.add(nose);
  // docking hatch under the nosecone
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 16),
    new THREE.MeshStandardMaterial({ color: 0x23262b, metalness: 0.6, roughness: 0.4 }));
  hatch.rotation.x = Math.PI / 2;
  hatch.position.z = 0.108;
  g.add(hatch);
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.096, 0.085, 0.022, 28), pica);
  shield.rotation.x = Math.PI / 2;
  shield.position.z = -0.076;
  g.add(shield);
  // unpressurized trunk aft, half wrapped in solar cells
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 28), matWhite());
  trunk.rotation.x = Math.PI / 2;
  trunk.position.z = -0.157;
  g.add(trunk);
  const array = new THREE.Mesh(
    new THREE.CylinderGeometry(0.093, 0.093, 0.13, 28, 1, true, -Math.PI / 2, Math.PI), matPanel());
  array.rotation.x = Math.PI / 2;
  array.position.z = -0.157;
  g.add(array);
  // four small trunk fins
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.005, 0.07), matWhite());
    const a = (i + 0.5) * Math.PI / 2;
    fin.position.set(Math.cos(a) * 0.11, Math.sin(a) * 0.11, -0.2);
    fin.rotation.z = a;
    g.add(fin);
  }
  return g;
}

export function makeStarship() { // stainless hull, domed nose, four flaps, tiled belly
  const g = new THREE.Group();
  // mid-gray steel — brighter and the bloom turns the hull into a glowing tube
  const steel = new THREE.MeshStandardMaterial({ color: 0x8f969c, metalness: 0.9, roughness: 0.45, envMapIntensity: 0.9 });
  const tiles = new THREE.MeshStandardMaterial({ color: 0x23262b, metalness: 0.25, roughness: 0.8 });
  // hull along z, nose toward +z
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 28), steel);
  hull.rotation.x = Math.PI / 2;
  g.add(hull);
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.05, 0.14, 28), steel);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 0.28;
  g.add(nose);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.013, 12, 8), steel);
  tip.position.z = 0.35;
  g.add(tip);
  // heat-shield tiles wrap the -y belly
  const belly = new THREE.Mesh(
    new THREE.CylinderGeometry(0.053, 0.053, 0.4, 28, 1, true, -Math.PI / 2, Math.PI), tiles);
  belly.rotation.x = Math.PI / 2;
  g.add(belly);
  // two fore + two aft flaps, hinged at the belly side
  for (const x of [-1, 1]) {
    const fore = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.008, 0.1), tiles);
    fore.position.set(x * 0.075, -0.02, 0.18);
    fore.rotation.z = x * 0.35;
    g.add(fore);
    const aft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.008, 0.13), tiles);
    aft.position.set(x * 0.1, -0.02, -0.15);
    aft.rotation.z = x * 0.35;
    g.add(aft);
  }
  // aft skirt and Raptor bells
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.051, 0.051, 0.03, 28), tiles);
  skirt.rotation.x = Math.PI / 2;
  skirt.position.z = -0.2;
  g.add(skirt);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.016, 0.03, 14), matBronze());
    bell.rotation.x = Math.PI / 2;
    bell.position.set(Math.cos(a) * 0.024, Math.sin(a) * 0.024, -0.225);
    g.add(bell);
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

function makeLaunchPad() { // concrete apron, launch mount, tower with amber beacons
  const g = new THREE.Group();
  const concrete = new THREE.MeshStandardMaterial({ color: 0xb8b4ac, metalness: 0.05, roughness: 0.9 });
  const apron = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.008, 24), concrete);
  apron.position.y = 0.004;
  g.add(apron);
  const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.018, 6), matMetal());
  mount.position.y = 0.017;
  g.add(mount);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.085, 0.012), matMetal());
  tower.position.set(0.03, 0.05, 0);
  g.add(tower);
  // emissive amber lights so the pad still reads on the night side
  const amber = new THREE.MeshStandardMaterial({
    color: 0xffb347, emissive: 0xff9a28, emissiveIntensity: 1.6, roughness: 0.6,
  });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), amber);
  beacon.position.set(0.03, 0.096, 0);
  g.add(beacon);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 6), amber);
    lamp.position.set(Math.cos(a) * 0.044, 0.01, Math.sin(a) * 0.044);
    g.add(lamp);
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
    case 'dragon': {
      // modeled at ~0.3 units long; kit scale on an inner group so the
      // pick proxy and glint stay standard-sized in the crowded LEO band
      const d = new THREE.Group();
      const kit = makeDragon();
      // a capsule, not a station: reads just under Hubble, ~2.5× under Starship
      kit.scale.setScalar(1.6);
      d.add(kit);
      return d;
    }
    case 'starship': {
      const s = new THREE.Group();
      const kit = makeStarship();
      kit.scale.setScalar(2.4); // largest rocket ever flown — biggest Earth orbiter here
      s.add(kit);
      return s;
    }
    case 'perseverance':
    case 'curiosity': {
      // ~0.28 units long — a miniature against Mars's 1.28-unit radius,
      // clearly smaller than the display-mode orbiters
      const r = makeRover();
      r.scale.setScalar(0.85);
      return r;
    }
    case 'starbase':
    case 'lc39a':
    case 'slc4e': {
      const p = makeLaunchPad();
      p.scale.setScalar(2.5);
      return p;
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
      // inclination is measured from the parent's equator, so the orbit
      // plane rides the tilt group (moons don't have one)
      (parent.tiltGroup ?? parent.anchor).add(plane);
      const pick = addPickProxy(mesh, 1.0);
      const phase = rand() * Math.PI * 2;
      const orbitClock = makeSmoothClock(data.periodDays);
      craft.set(data.id, {
        data, mesh, pick, displayRadius,
        update(days, stepDays) {
          const a = phase + (orbitClock(days, stepDays) / data.periodDays) * Math.PI * 2;
          // -z: prograde, the same direction the parent spins
          mesh.position.set(Math.cos(a) * orbitR, 0, -Math.sin(a) * orbitR);
          mesh.rotation.y = a;
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
// one orbital-plane circle, same transform as the satellite update below
function planeRing(R, incDeg, raanDeg, color) {
  const inc = incDeg * DEG, cI = Math.cos(inc), sI = Math.sin(inc);
  const cR = Math.cos(raanDeg * DEG), sR = Math.sin(raanDeg * DEG);
  const pts = [];
  for (let k = 0; k <= 128; k++) {
    const a = (k / 128) * Math.PI * 2;
    const xo = Math.cos(a) * R, zo = -Math.sin(a) * R;
    const yi = -zo * sI, zi = zo * cI;
    pts.push(new THREE.Vector3(xo * cR - zi * sR, yi, xo * sR + zi * cR));
  }
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.16 }),
  );
  line.userData.isOrbit = true;
  return line;
}

function buildStarlink(earth, data) {
  let N = 0;
  let positions, raan, phase, orbitR, w, cosI, sinI;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    color: data.color, size: data.pointSize ?? 2.2, sizeAttenuation: false,
    map: roundPointTexture(), alphaTest: 0.25,
    transparent: true, opacity: 0.9, depthWrite: false,
  }));
  points.name = data.id;
  // inclinations are measured from the equator, so the cloud rides the tilt
  // group — the GEO ring hugs the displayed equator, polar shells cross the
  // actual poles
  earth.tiltGroup.add(points);

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
    const shellR = earth.displayRadius
      * ((TRUE_SCALE && data.trueOrbitRadii) || data.orbitRadii);
    const perPlane = Math.ceil(data.count / (data.planes ?? 1));
    fill([{
      orbitR: shellR,
      periodDays: data.periodDays,
      incDeg: data.inclination,
      // planes: the real slot architecture (GPS flies 6 planes 60° apart)
      // instead of a random swarm; phases spread evenly with a little jitter
      sats: Array.from({ length: data.count }, (_, k) => (data.planes
        ? [(k % data.planes) * (360 / data.planes),
          (Math.floor(k / data.planes) / perPlane) * 360 + rand() * 30]
        : [rand() * 360, rand() * 360])),
    }]);
    // faint ring per orbital plane so the architecture reads at a glance —
    // GPS's 6-plane birdcage vs the single equatorial GEO ring
    for (let p = 0; p < (data.planes ?? 1); p++) {
      points.add(planeRing(shellR, data.inclination, p * (360 / (data.planes ?? 1)), data.color));
    }
  }

  return {
    data, mesh: points, isCloud: true,
    // frame the whole shell when focused (Starlink has no orbitRadii — its
    // baked shells top out near 1.6 R)
    displayRadius: earth.displayRadius
      * ((TRUE_SCALE && data.trueOrbitRadii) || data.orbitRadii || 1.8),
    update(days, stepDays) {
      const t = orbitClock(days, stepDays);
      for (let i = 0; i < N; i++) {
        const a = phase[i] + t * w[i];
        const xo = Math.cos(a) * orbitR[i];
        // -z: prograde, the same direction Earth spins (GEO co-rotates)
        const zo = -Math.sin(a) * orbitR[i];
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
