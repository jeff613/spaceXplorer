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

const smooth = (u) => u * u * (3 - 2 * u);
const clamp01 = (u) => Math.min(1, Math.max(0, u));

// ─── Starship: staged at Starbase ─────────────────────────────────────────
// Between transfer windows real Starships stand at Boca Chica, not in orbit.
// The selectable craft becomes a static vehicle beside the pad (the Mars-bound
// fleet in transfer.js launches from the mount itself, so no overlap).

export function attachStarshipDisplay(craft, bodies) {
  const ship = craft.get('starship');
  const pad = craft.get('starbase');
  const earth = bodies.get('earth');
  if (!ship || !pad) return;

  const mesh = ship.mesh;
  const plane = mesh.parent;
  earth.mesh.add(mesh); // ride the planet's spin like the pads do
  plane?.removeFromParent();

  // stand beside the pad: nose up, engine bells on the ground
  const normal = pad.mesh.position.clone().normalize();
  const east = new THREE.Vector3(0, 1, 0).cross(normal).normalize();
  mesh.position.copy(pad.mesh.position)
    .addScaledVector(east, 0.45)
    .addScaledVector(normal, 0.58);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  ship.update = () => {}; // nothing to animate — it rides the spinning mesh
}

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

  // Falcon 9: a real selectable craft. Dragon rides it off the pad; it stages
  // mid-climb and flies tail-first back to a pad landing (RTLS), then waits,
  // restacked, for the next launch.
  const B_LEN = 0.75;
  const DRAGON_TAIL = 0.36; // capsule+trunk extent below the model origin
  const SEP_RAW = 0.5;      // staging point as a fraction of the climb
  const FLYBACK = 0.008;    // ~11 min from staging to touchdown
  const falcon = craft.get('falcon9');
  const booster = falcon.mesh;
  {
    const fPlane = booster.parent;
    earth.anchor.add(booster);
    fPlane?.removeFromParent();
    falcon.update = () => {}; // driven from the Dragon mission below
  }
  dragon.booster = booster;
  const noseDir = new THREE.Vector3();

  // the booster's own timeline: under the capsule while attached, a lofted
  // tail-first arc home after staging, then standing on the pad until restack
  const sepPos = new THREE.Vector3();
  const fb1 = new THREE.Vector3();
  const fb2 = new THREE.Vector3();
  function placeBooster(attached, t) {
    booster.visible = true;
    if (attached) {
      noseDir.set(0, 0, 1).applyQuaternion(mesh.quaternion);
      booster.position.copy(mesh.position).addScaledVector(noseDir, -(DRAGON_TAIL + B_LEN / 2));
      booster.quaternion.copy(mesh.quaternion);
      return;
    }
    const R = earth.displayRadius;
    const tSep = PAD_END + SEP_RAW * (ASC_END - PAD_END);
    booster.quaternion.setFromUnitVectors(Z, padUp); // tail-first, always
    if (t >= tSep && t < tSep + FLYBACK) {
      // boostback: loft up off the staging point, fall back to the pad
      p.copy(padPos).addScaledVector(padUp, 0.02 + B_LEN + DRAGON_TAIL);
      c1.copy(padPos).addScaledVector(padUp, R * 0.7);
      insertion(c2, R * CHASE_RADII);
      bezier(sepPos, smooth(SEP_RAW), p, c1, c2);
      fb1.copy(sepPos).addScaledVector(padUp, 0.9);
      fb2.copy(padPos).addScaledVector(padUp, 0.02 + B_LEN / 2);
      bezier(booster.position, smooth(clamp01((t - tSep) / FLYBACK)), sepPos, fb1, fb2);
    } else {
      // landed: standing beside the tower, awaiting the next stack
      booster.position.copy(padPos).addScaledVector(padUp, 0.02 + B_LEN / 2);
    }
  }

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

  // orbit-insertion point: the pad's direction projected into the ISS plane,
  // pushed 0.6 rad downrange — launches climb over their own horizon, the way
  // real ascents do, instead of chording through the planet toward the ISS
  const injDir = new THREE.Vector3();
  const issDir = new THREE.Vector3();
  const cross = new THREE.Vector3();
  function insertion(target, radius) {
    injDir.copy(padUp).addScaledVector(planeNormal, -padUp.dot(planeNormal)).normalize();
    q.setFromAxisAngle(planeNormal, -0.6); // forward along the orbit
    target.copy(injDir.applyQuaternion(q)).multiplyScalar(radius);
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
    let attached = false;
    if (t < PAD_END || t >= DESC_END) {
      // capsule rides atop the Falcon 9 stack on the pad
      mesh.position.copy(padPos).addScaledVector(padUp, 0.02 + B_LEN + DRAGON_TAIL);
      onPad = true;
      attached = true;
    } else if (t < ASC_END) {
      const raw = clamp01((t - PAD_END) / (ASC_END - PAD_END));
      const u = smooth(raw);
      attached = raw < SEP_RAW; // staging: the booster falls away mid-climb
      p.copy(padPos).addScaledVector(padUp, 0.02 + B_LEN + DRAGON_TAIL);
      c1.copy(padPos).addScaledVector(padUp, R * 0.7);
      insertion(c2, R * CHASE_RADII);
      bezier(mesh.position, u, p, c1, c2);
    } else if (t < REN_END) {
      const u = smooth(clamp01((t - ASC_END) / (REN_END - ASC_END)));
      const radius = R * (CHASE_RADII + (1.45 - CHASE_RADII) * u);
      // close the prograde gap from the insertion point to the live ISS
      localize(issPos, iss.mesh);
      issDir.copy(issPos).normalize();
      insertion(p, 1); // unit insertion direction in injDir via p
      let gap = -Math.atan2(planeNormal.dot(cross.crossVectors(p, issDir)), p.dot(issDir));
      if (gap < 0.15) gap += Math.PI * 2; // always chase forward
      q.setFromAxisAngle(planeNormal, gap * (1 - u));
      mesh.position.copy(issDir).applyQuaternion(q).multiplyScalar(radius);
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
    placeBooster(attached, t);
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
