import * as THREE from 'three';
import { SPACECRAFT, scaleDistance } from './data.js';
import { keplerPosition } from './bodies.js';

const DEG = Math.PI / 180;

// Tiny stylized ISS: truss + solar wings
function makeISSMesh() {
  const g = new THREE.Group();
  const metal = new THREE.MeshPhongMaterial({ color: 0xd8d8e0 });
  const panel = new THREE.MeshPhongMaterial({ color: 0x2a4d8f, emissive: 0x12203d });
  const truss = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.07, 0.07), metal);
  g.add(truss);
  const module = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8), metal);
  module.rotation.x = Math.PI / 2;
  g.add(module);
  for (const x of [-0.38, 0.38]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.01, 0.5), panel);
    wing.position.x = x;
    g.add(wing);
  }
  return g;
}

function makeDot(color, size = 0.45) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(size, 16, 8),
    new THREE.MeshBasicMaterial({ color }),
  );
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
      const mesh = data.id === 'iss' ? makeISSMesh() : makeDot(data.color, 0.18);
      mesh.name = data.id;
      const plane = new THREE.Group();
      plane.rotation.x = data.inclination * DEG;
      plane.add(mesh);
      parent.anchor.add(plane);
      const pick = addPickProxy(mesh, 1.0);
      const phase = Math.random() * Math.PI * 2;
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
      const mesh = makeDot(data.color, 0.22);
      mesh.name = data.id;
      scene.add(mesh);
      const pick = addPickProxy(mesh, 1.2);
      craft.set(data.id, {
        data, mesh, pick, displayRadius: 0.7,
        update() {
          mesh.position.copy(earth.anchor.position).multiplyScalar(data.factor);
        },
      });
    } else if (data.kind === 'surface') {
      // rover pinned to the parent's surface at lat/lon — added as a child
      // of the spinning mesh so it rides the planet's rotation
      const parent = bodies.get(data.parent);
      const mesh = makeDot(data.color, 0.12);
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
      const mesh = makeDot(data.color, 0.3);
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
      const mesh = makeDot(data.color, 0.5);
      mesh.name = data.id;
      const dir = raDecToDir(data.raDeg, data.decDeg);
      mesh.position.copy(dir).multiplyScalar(scaleDistance(data.distanceAU));
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
    raan[i] = Math.random() * Math.PI * 2;
    phase[i] = Math.random() * Math.PI * 2;
  }
  const positions = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    color: data.color, size: 1.6, sizeAttenuation: false,
    transparent: true, opacity: 0.85, depthWrite: false,
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
