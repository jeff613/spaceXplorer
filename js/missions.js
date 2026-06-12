import * as THREE from 'three';

// ─── Crew Dragon: LC-39A → ISS rendezvous cycle ───────────────────────────
// A repeating one-sim-day mission, every phase a pure function of sim days —
// time travel lands anywhere in the cycle and the scene is already correct.
// The ISS is read live each frame (it updates first: data.js order), so the
// rendezvous tracks the real station, not a copy of its math.

const PAD_END = 0.30;   // waiting on the pad
const ASC_END = 0.312;  // ~17 min ascent — Dragon reaches orbit in ~9 real min
const REN_END = 0.41;   // chase orbit closes 0.9 rad behind the station
const DOCK_END = 0.95;  // berthed just below the ISS
const DESC_END = 0.995; // re-entry arc back toward the Cape

const CHASE_RADII = 1.40;  // phasing orbit, just under the ISS's 1.45
const BEHIND = 0.9;        // rad behind the ISS at orbit injection

const smooth = (u) => u * u * (3 - 2 * u);
const clamp01 = (u) => Math.min(1, Math.max(0, u));

export function attachDragonMission(craft, bodies) {
  const dragon = craft.get('dragon');
  const iss = craft.get('iss');
  const pad = craft.get('lc39a');
  const earth = bodies.get('earth');
  if (!dragon || !iss || !pad) return;

  // leave the free orbit: dragon lives in earth.anchor space for the mission
  const mesh = dragon.mesh;
  const plane = mesh.parent;
  earth.anchor.add(mesh);
  plane?.removeFromParent();

  // ISS orbital plane normal in anchor space (plane group: rotation.x = incl)
  const incl = iss.mesh.parent.rotation.x;
  const planeNormal = new THREE.Vector3(0, Math.cos(incl), Math.sin(incl));

  const issPos = new THREE.Vector3();
  const padPos = new THREE.Vector3();
  const padUp = new THREE.Vector3();
  const p = new THREE.Vector3();
  const c1 = new THREE.Vector3();
  const c2 = new THREE.Vector3();
  const last = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const Z = new THREE.Vector3(0, 0, 1);

  function localize(target, obj) {
    obj.getWorldPosition(target);
    earth.anchor.updateWorldMatrix(true, false);
    earth.anchor.worldToLocal(target);
  }

  // chase-orbit position: Δ rad behind the ISS at radius r (anchor space)
  function chase(target, behind, radius) {
    localize(issPos, iss.mesh);
    q.setFromAxisAngle(planeNormal, behind);
    target.copy(issPos).normalize().applyQuaternion(q).multiplyScalar(radius);
  }

  const bezier = (target, u, p0, p1, p2) => {
    const v = 1 - u;
    target.set(
      v * v * p0.x + 2 * v * u * p1.x + u * u * p2.x,
      v * v * p0.y + 2 * v * u * p1.y + u * u * p2.y,
      v * v * p0.z + 2 * v * u * p1.z + u * u * p2.z,
    );
  };

  dragon.update = function update(days) {
    const t = ((days % 1) + 1) % 1;
    const R = earth.displayRadius;
    localize(padPos, pad.mesh);
    padUp.copy(padPos).normalize();

    let onPad = false;
    if (t < PAD_END || t >= DESC_END) {
      mesh.position.copy(padPos).addScaledVector(padUp, 0.06);
      onPad = true;
    } else if (t < ASC_END) {
      const u = smooth(clamp01((t - PAD_END) / (ASC_END - PAD_END)));
      p.copy(padPos).addScaledVector(padUp, 0.06);
      c1.copy(padPos).addScaledVector(padUp, R * 0.7);
      chase(c2, BEHIND, R * CHASE_RADII);
      bezier(mesh.position, u, p, c1, c2);
    } else if (t < REN_END) {
      const u = smooth(clamp01((t - ASC_END) / (REN_END - ASC_END)));
      const radius = R * (CHASE_RADII + (1.45 - CHASE_RADII) * u);
      chase(mesh.position, BEHIND * (1 - u), radius);
    } else if (t < DOCK_END) {
      localize(issPos, iss.mesh);
      mesh.position.copy(issPos).addScaledVector(p.copy(issPos).normalize(), -0.12);
    } else {
      const u = smooth(clamp01((t - DOCK_END) / (DESC_END - DOCK_END)));
      localize(issPos, iss.mesh);
      p.copy(issPos).addScaledVector(c2.copy(issPos).normalize(), -0.12);
      c1.copy(padPos).addScaledVector(padUp, R * 0.5).multiplyScalar(0.7); // dip into the atmosphere
      c2.copy(padPos).addScaledVector(padUp, 0.06);
      bezier(mesh.position, u, p, c1, c2);
    }

    if (onPad) {
      mesh.quaternion.setFromUnitVectors(Z, padUp); // nose up on the pad
    } else if (last.distanceToSquared(mesh.position) > 1e-8) {
      aim.copy(mesh.position).multiplyScalar(2).sub(last);
      mesh.lookAt(earth.anchor.localToWorld(aim));
    }
    last.copy(mesh.position);
  };

  // mission phase for tests/UI: where in the cycle a given day falls
  dragon.missionPhase = (days) => {
    const t = ((days % 1) + 1) % 1;
    if (t < PAD_END || t >= DESC_END) return 'pad';
    if (t < ASC_END) return 'ascent';
    if (t < REN_END) return 'rendezvous';
    if (t < DOCK_END) return 'docked';
    return 'descent';
  };
}
