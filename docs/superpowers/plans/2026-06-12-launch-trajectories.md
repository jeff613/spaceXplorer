# Launch Trajectories: Pads → Missions

**Goal:** The launch sites become operational. Starship fleet launches from Starbase
onto the Mars transfer arc; Crew Dragon flies a repeating LC-39A → ISS rendezvous cycle.

**Architecture:** Everything stays a pure function of sim days (time-travel-safe, same
idiom as orbits). Dragon's free-orbit update is replaced by a mission cycle in a new
`js/missions.js` (spacecraft.js is at 913 lines — new behavior gets its own module).
Starship's pre-departure parking in `transfer.js` becomes: queue on Starbase ground →
bezier ascent (gravity-turn silhouette) → handoff onto the existing Hohmann arc at the
first point clear of Earth.

## Dragon cycle (period 1 sim-day)

| t (frac of day) | phase |
|---|---|
| 0.00–0.30 | on LC-39A pad, nose up |
| 0.30–0.312 | ascent bezier: pad → injection on chase orbit (~9 min, real Dragon ascent) |
| 0.312–0.41 | rendezvous: chase orbit in ISS plane, 1.40→1.45 radii, closes 0.9 rad behind ISS |
| 0.41–0.95 | docked: rides 0.12 units below ISS |
| 0.95–0.995 | descent bezier: ISS vicinity → pad |
| 0.995–1.0 | back on pad |

ISS position read live each frame (ISS updates before Dragon — data order). Dragon mesh
re-parented to `earth.anchor`; pad position via `getWorldPosition` → `worldToLocal`.

## Starship launches (transfer.js)

Per ship i, departure D_i = dep + i·STAGGER, launch L_i = D_i − 1.5 days:
- t < L_i: queued upright on Starbase ground, spaced along the surface tangent
- L_i–D_i: ascent bezier: pad → pts[h], control point 2.5 Earth-radii above pad
  (h = first arc index > 3 Earth-radii from Earth — never emerge from the planet's core)
- D_i–arr: existing smoothstep arc pacing, remapped to start at h
- ≥ arr: existing Mars parking

`createTransfer` gains a `craft` param for the Starbase pad lookup.

## Tests

- Transfer on, t = dep−5: all ships within 3 units of Starbase pad
- t = D_0 − 0.75: ship 0 mid-ascent, 2–12 units from Earth center
- Dragon at cycle t=0.1: within 0.5 of LC-39A; at t=0.6: within 0.3 of ISS
- Full suite stays green

**Out of scope:** Mars landing, booster catch, plumes, default-on transfer toggle.
