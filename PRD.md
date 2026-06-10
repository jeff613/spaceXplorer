# SPACEXPLORER — Product Requirements Document

**Status:** Living document — the improvement loop works against this.
**Owner:** Jeff
**Last updated:** 2026-06-13 (iteration 35 — visuals-first era)

## 1. Vision

The most easy-to-use, reliable, accurate, fun, and comprehensive solar-system
explorer on the web. A single page where anyone — a curious kid, a space nerd,
a teacher — can fly around the real solar system as it is *right now*: every
planet, the interesting moons, dwarf planets, comets, and the man-made objects
humanity has scattered from low Earth orbit to interstellar space.

## 2. Product principles (priority order — user, 2026-06-13: visual quality first, comprehensiveness last)

1. **Accurate** — Real orbital mechanics (Keplerian elements, true periods,
   eccentricity, inclination, axial tilt, rotation). Positions reflect the
   actual current date. Only display *scale* is compressed (power-law), never
   the physics. Every fact shown must be true.
2. **Easy to use** — Zero learning curve: drag, scroll, click. Everything
   clickable, everything labeled, everything searchable. Works on desktop and
   mobile.
3. **Reliable / bug-free** — Every iteration passes the full E2E suite
   (`npm test`). No console errors, no NaNs, no dead clicks, no broken states.
   New features land with new tests.
4. **Fun** — Beautiful to look at (mission-control HUD aesthetic, atmospheres,
   night lights, comet tails), delightful to fly around, and every object
   teaches you something with a memorable fact.
5. **Comprehensive** — If it's interesting and it's in the solar system,
   it belongs here: natural bodies and man-made ones.
6. **Best-in-class graphics** — Realistic *and* fancy: physically-plausible
   lighting, HDR tone mapping, bloom, animated sun, high-res textures,
   atmospheric scattering, shadows where they matter. It should look like a
   AAA space sim, not a textbook diagram — without sacrificing 60 fps.

**Priority order for iteration (2026-06-13):** 1) visual quality / graphics,
2) accuracy & realism, 3) UX & reliability, 4) comprehensiveness (new objects
last — only when the visuals are world-class).

## 3. Users

- **Casual explorer** — lands, drags around, clicks planets, reads facts.
- **Space enthusiast** — checks where things are today (Where's Voyager 1?
  Is Halley close yet?), follows spacecraft, plays with time.
- **Educator / student** — uses it to show real configurations, scale
  relationships, orbital mechanics in motion, shares deep links (`?focus=`).

## 4. Current scope (shipped)

**Natural bodies (32):** Sun · 8 planets · dwarfs Ceres, Pluto, Eris,
Makemake, Haumea · asteroid Vesta · moons Moon, Phobos, Deimos, Io, Europa,
Ganymede, Callisto, Titan, Enceladus, Rhea, Iapetus, Miranda, Titania,
Oberon, Triton, Charon · Halley's Comet (dynamic anti-sunward tail) ·
asteroid belt · Kuiper belt · starfield.

**Man-made:** all spacecraft are detailed PBR miniatures with image-based lighting and distance-faded glints — P0 orb fix iter 29 (iter 14 base) — ISS · Hubble · JWST at L2 · Starlink shell
(700 sats) · Juno (polar Jupiter orbit) · Tesla Roadster · Parker Solar
Probe · New Horizons · Voyager 1 · Voyager 2.

**Experience:** search Enter-selects, idle cinematic drift (iter 34) · selected orbit glows amber (iter 31) · shareable moments — ?focus + ?date deep links and a copy-link button (paused on arrival) (iter 25) · live distance-from-Earth + light-travel-time readout on every selection (iter 21) · click/nav/search to select → camera fly-to + follow + info
panel with stats and a fun fact · floating labels with distance-based
decluttering · orbit lines · time machine (pause, real-time 1× to 100 days/s, reverse, date picker, NOW) ·
toggles (orbits, labels, belts, Starlink) · deep links · Esc/empty-click
deselect · hover cursor · Earth night lights + atmospheres · Saturn rings.

**Quality infrastructure:** 32-assertion E2E suite (puppeteer-core + system
Chrome): boot, data integrity of all objects, orbital accuracy vs. known
distances on the current date, sidereal-year round-trip, 1986 Halley
perihelion via date jump, selection/camera/panel behavior, search, toggles,
time controls incl. reverse, numeric stability under fast-forward, deep
links, zero console errors. Experience: time bar now has reverse (⏴) and
a date picker alongside NOW.

## 5. Quality bars (release gates)

- `npm test` green on every iteration; suite grows with every feature.
- Zero console/page errors in normal use.
- 60 fps target on a typical laptop; no jank when fast-forwarding time.
- Every object: accurate stats, a memorable fact, clickable, searchable,
  labeled.
- Orbital positions within a few percent of published ephemerides for the
  current epoch (display compression aside).
- Mobile: usable with touch, readable HUD, no overlap disasters.

## 6. Roadmap (prioritized backlog)

**Graphics (top priority — best-in-class realistic & fancy)**
- [x] Spacecraft visual upgrade: procedural PBR miniatures for every craft
      (dishes, foil, panels, rovers, Roadster w/ wheels), distance glints,
      PBR planet/moon materials, soft round constellation points, lumpy
      comet nuclei — shipped iter 14 on user feedback ("dots look horrible")
- [x] Post-processing pipeline: UnrealBloomPass + ACES filmic tone mapping — shipped iter 5
- [x] Animated sun: surface noise shader + corona (iter 5); lens flare (iter 13)
- [x] Higher-res planet textures: 2K set + ring alpha (iter 10); Earth hero pass — 8K daymap, topology bump, specular oceans w/ sun glint (iter 35). Other planets' bump maps remain
- [x] Atmospheric scattering upgrade (day-side rim, sunset terminator band) — shipped iter 15
- [x] Ring shadows both ways: planet→rings (iter 6) and rings→planet sampling real ring alpha (iter 32)
- [x] Milky way skybox upgrade (2K pano) — shipped iter 10
- [x] Camera motion polish: FOV breathing on fly-to — shipped iter 12

**Fidelity & realism**
- [x] More comets: 67P (iter 11), NEOWISE (iter 16, drove a Kepler solver upgrade to Newton-Raphson for near-parabolic orbits)
- [x] Uranus rings (ε + faint bands), Neptune rings (Adams, Le Verrier) — shipped iter 6 (arcs approximated as faint full rings)
- [x] Gas giant differential rotation: Jupiter/Saturn bands shear with sim time (System I vs III, textureGrad-correct mips) — shipped iter 27; GRS drifts with the equatorial current
- [x] True-scale mode (?scale=true + toggle): linear distances, real radii, real moon orbits; craft become micro-markers — shipped iter 18
- [x] Real lunar phase: J2000 mean longitude + sidereal month (iter 19); eclipse shadows + 5.14° inclination (iter 29); live phase-name readout, verified against the real lunar calendar (iter 33)

**Comprehensiveness**
- [x] More spacecraft: Juno (iter 4); Pioneers, Cassini memorial (iter 9);
      MRO, Perseverance, Curiosity, Gaia, SOHO (iter 11). Tiangong + LRO (iter 24); Akatsuki at Venus + L-point halo orbits (iter 28); Europa Clipper in transit (iter 30); Artemis Gateway awaits its real launch
- [x] GPS + geostationary satellite rings around Earth — shipped iter 9
- [x] Named asteroids: Vesta (iter 4); Pallas, Bennu, Apophis (iter 23)
- [x] More Kuiper objects: Makemake, Haumea (iter 4); Arrokoth, Sedna (iter 9)

**UX & fun**
- [x] Guided tour mode ("Grand Tour" — autoplay through highlights) — shipped iter 7 (17 stops, prev/next/exit, auto-advance 9s, exits on manual selection)
- [x] Label overlap avoidance (collision-aware placement) — shipped iter 8 (priority: selected > Sun > planets > craft > moons)
- [x] Time-reverse (negative speeds) and date picker (jump to any date —
      e.g., 1986 Halley apparition, 2061 return) — shipped iter 4
- [x] Object comparison cards: to-scale size discs vs Earth in info panel — shipped iter 16
- [x] Keyboard navigation (arrows cycle objects, ? help overlay) — shipped iter 8
- [x] Sound design: procedural ambient drone + soft select/deselect/tour blips, gesture-gated, mute toggle — shipped iter 17
- [x] Mobile polish pass: bottom-sheet info panel, nav starts collapsed, bigger touch targets, slimmer time bar — shipped iter 22

**Reliability & performance**
- [x] FPS budget test in suite; perf regression gate — shipped iter 5
- [x] Visual regression snapshots: Saturn + Earth views pixel-compared vs committed baselines (frozen epoch, 3% gate, UPDATE_SNAPSHOTS=1 to refresh) — shipped iter 20
- [x] Mobile-viewport E2E tests (boot, overflow, nav collapse, touch select) — shipped iter 12
- [x] Graceful degradation when WebGL is unavailable — shipped iter 13 (tested with a WebGL-disabled browser)

## 7. Non-goals

- Not an ephemeris-grade tool (no arcsecond precision, no n-body integration).
- No accounts, no backend, no build step — stays a static site.
- No exoplanets / deep-sky catalog — this is the *solar system*.
- No VR/AR for now.

**Onboarding:** first-visit toast invites the Grand Tour (localStorage-gated,
suppressed for deep links); tour refreshed to 19 stops incl. Perseverance
and Apophis (iter 26).

## 8. Success criteria

- A first-time visitor finds and learns something surprising within 60 seconds.
- An enthusiast can answer "where is X right now?" for any of 40+ objects.
- The suite stays green; no known bugs ship and stay shipped.
- It feels alive: time moves, things orbit, the sky is the real sky of today.
