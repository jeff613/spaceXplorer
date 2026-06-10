# SPACEXPLORER

An interactive 3D solar system explorer. No build step — plain ES modules with
Three.js loaded from a CDN.

## Run

```sh
python3 -m http.server 8642
# then open http://localhost:8642
```

(Any static file server works; opening index.html directly does not, because
ES modules require http.)

## What's in it

- The Sun, all 8 planets + Pluto, on real Keplerian orbits (J2000 elements:
  eccentricity, inclination, node, perihelion) with correct periods, axial
  tilts, and rotation rates. Distances/radii are power-law compressed so
  everything fits on screen.
- Major moons: the Moon, Io, Europa, Ganymede, Callisto, Titan, Triton.
- Saturn's rings, asteroid belt, textured starfield.
- Man-made objects: ISS, Hubble, JWST (at L2), the Tesla Roadster (real
  heliocentric orbit), Voyager 1 & 2, and a 700-satellite Starlink shell.
- Click anything (or use the left navigator) to fly to it and get stats +
  a fun fact. Time controls at the bottom: pause, speed (0.01–100 days/s),
  and NOW to jump to the present. Toggles for orbits, labels, belt, Starlink.

## Test

```sh
npm install   # once (puppeteer-core, drives your installed Chrome)
npm test
```

End-to-end suite in `tests/run-tests.mjs`: boot, data integrity for every
object, orbital accuracy against known distances (Earth/Mars/Pluto/Halley
on today's date, plus a sidereal-year round-trip), selection/camera/info
panel behavior, click & Esc handling, search, all toggles, time controls,
numeric stability under fast-forward, deep links, and zero console errors.

## Files

- `js/data.js` — all astronomical data, orbital elements, facts, scaling
- `js/bodies.js` — Kepler solver, Sun/planets/moons/belt/starfield builders
- `js/spacecraft.js` — ISS, telescopes, Roadster, Voyagers, Starlink cloud
- `js/ui.js` — navigator, info panel, labels, time controls
- `js/main.js` — scene, camera fly-to/follow, picking, render loop
