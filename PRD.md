# SPACEXPLORER — Product Requirements Document

**Status:** Living document — the improvement loop works against this.
**Owner:** Jeff
**Last updated:** 2026-06-13 (iteration 90); release doc sync 2026-06-12
**Shipped:** production @ https://spacexplorer-prod.up.railway.app — 2026-06-12
release (P0 fixes, SEO surface, SpaceX feature track); see CHANGELOG.md

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

**Natural bodies (39):** Sun · 8 planets · dwarfs Ceres, Pluto, Eris,
Makemake, Haumea, Sedna · asteroids Vesta, Pallas, Bennu, Apophis ·
Arrokoth · moons Moon, Phobos, Deimos, Io, Europa, Ganymede, Callisto,
Titan, Enceladus, Rhea, Iapetus, Miranda, Titania, Oberon, Triton, Charon ·
comets Halley, 67P, NEOWISE (dark lumpy nuclei, perihelion-driven coma +
anti-sunward tail — comet hero pass iter 43) ·
asteroid belt · Kuiper belt · starfield.

**Man-made:** all spacecraft are detailed PBR miniatures with image-based lighting and distance-faded glints — P0 orb fix iter 29 (iter 14 base); Roadster/rover close-up scale fix + speck-size test gate iter 42; one shared size curve (display = 0.382 × meters^0.244) — ISS · Tiangong ·
Hubble · JWST at L2 · Juno · Akatsuki · Europa Clipper · Gaia · SOHO ·
LRO · Danuri · Mars Express · ExoMars TGO · MRO · Perseverance ·
Curiosity · Cassini memorial · Tesla Roadster · Parker Solar Probe ·
New Horizons · Pioneers 10/11 · Voyagers 1/2 · the real Starlink
constellation (~5,800 sats baked from a CelesTrak TLE snapshot) · GPS +
geostationary rings · SpaceX fleet: Falcon 9 (real ascent geometry, RTLS
booster flyback), Crew Dragon (LC-39A → ISS rendezvous cycle), Starship
at Starbase + Mars-transfer fleet on the Hohmann arc · launch sites
Starbase, LC-39A, SLC-4E.

**Experience:** search Enter-selects, idle cinematic drift (iter 34) · selected orbit glows amber (iter 31) · shareable moments — ?focus + ?date deep links and a copy-link button (paused on arrival) (iter 25), og:image/twitter social card (iter 64) · live distance-from-Earth + light-travel-time readout on every selection (iter 21) · click/nav/search to select → camera fly-to + follow + info
panel with stats and a fun fact · floating labels with distance-based
decluttering · orbit lines · time machine (pause, reverse, slider from
exactly real time up to 100 days/s — default 10 min/s, date picker, NOW) ·
two tours: 21-stop Grand Tour + 10-stop SpaceX Story (calmed clock while
touring) · IPO banner with live SPCX quote ·
toggles (orbits, labels, belts, Starlink) · deep links · share button
(clipboard on desktop, native sheet on touch) · sitemap + JSON-LD + PWA
manifest · Esc/empty-click
deselect · hover cursor · Earth night lights + atmospheres · Saturn rings.

**Quality infrastructure:** 206-assertion E2E suite (puppeteer-core + system
Chrome): boot, data integrity of all objects, orbital accuracy vs. known
distances on the current date, sidereal-year round-trip, 1986 Halley
perihelion via date jump, selection/camera/panel behavior, search, toggles,
time controls incl. reverse, numeric stability under fast-forward, deep
links, pixel-regression baselines, launches, tours, SEO surface, mobile
viewport, zero console errors.

## 5. Quality bars (release gates)

- `npm test` green on every iteration; suite grows with every feature.
- Zero console/page errors in normal use.
- 60 fps target on a typical laptop; no jank when fast-forwarding time.
  Measured 120 fps idle AND at 100 days/s with the full 64-object scene
  (iter 82); suite gates ≥30.
- Every object: accurate stats, a memorable fact, clickable, searchable,
  labeled.
- Orbital positions within a few percent of published ephemerides for the
  current epoch (display compression aside).
- Mobile: usable with touch, readable HUD, no overlap disasters.
- Accessibility: every icon-only control carries an aria-label (iter 54);
  prefers-reduced-motion disables camera drift + FOV breathing (iter 55).
- Camera never clips inside a body: zoom floor tracks the selected
  object's radius (iter 59).
- Graceful degradation: WebGL-less browsers get a fallback message; failed
  texture loads fall back to tinted materials, never white balls (iter 51).
- Fast first paint: heavyweight textures load progressively — Earth paints
  at 2K immediately, 8K swaps in when downloaded (iter 56); Milky Way
  panorama likewise (iter 58). ~6.5MB moved off the critical path.

## 6. Roadmap (prioritized backlog)

**Comprehensiveness gate (reopened iter 79):** the visuals-first mandate is
satisfied — every object class has had a hero pass and is test-gated. New
objects may now be added sparingly, with day-one kit-quality visuals
(procedural model, close-up screenshot, roster/orbit test). First: Mars
Express (iter 79); Danuri/KPLO lunar orbiter (iter 80); ExoMars TGO
(iter 83). Candidates: Lucy, Psyche, BepiColombo (heliocentric elements
need care — don't fabricate), Queqiao-2 lunar relay.

**SpaceX feature track (shipped to prod 2026-06-12, built on feature
branches outside the loop, celebrating the SPCX IPO):** Falcon 9 with
real ascent geometry + RTLS booster flyback · Crew Dragon LC-39A → ISS
rendezvous cycle (pure function of sim time — time travel lands anywhere
in the cycle correctly) · Starship at Starbase, departing for Mars on a
Hohmann arc when the transfer window opens · operational launch sites ·
real Starlink constellation baked from CelesTrak TLEs · 10-stop SpaceX
Story tour · IPO countdown banner with live SPCX quote (wall-clock-driven,
immune to time travel).

**Graphics (top priority — best-in-class realistic & fancy)**
- [x] Procedural color maps for major moons — Io volcanic mottling, Europa lineae, Titan banded haze + atmosphere shell, Triton cantaloupe + pink cap (iter 46); Charon's Mordor Macula (iter 62); Ganymede two-tone terrain + Callisto impact speckles complete the Galileans (iter 63); Enceladus south-polar geyser plume (iter 65); Iapetus yin-yang hemispheres + equatorial ridge (iter 67); crater bump relief for all textureless moons (iter 45); Phobos/Deimos potato shapes (iter 49); Pluto–Charon barycenter wobble (iter 52)
- [x] Starfield nebula/cluster accents — six seeded wispy sprites + Andromeda smudge, isolated PRNG (iter 47)
- [x] Spacecraft visual upgrade: procedural PBR miniatures for every craft
      (dishes, foil, panels, rovers, Roadster w/ wheels), distance glints,
      PBR planet/moon materials, soft round constellation points, lumpy
      comet nuclei — shipped iter 14 on user feedback ("dots look horrible");
      Parker blob fix — matte TPS shield, kit scale, profile angle (iter 48)
- [x] Post-processing pipeline: UnrealBloomPass + ACES filmic tone mapping — shipped iter 5; film-grade finishing pass (vignette + deterministic grain) — iter 41
- [x] Animated sun: surface noise shader + corona (iter 5); lens flare (iter 13); photospheric limb darkening + animated chromosphere rim (iter 39)
- [x] Higher-res planet textures: 2K set + ring alpha (iter 10); Earth hero pass — 8K daymap, topology bump, specular oceans w/ sun glint (iter 35); terrain bump relief for Mars, Mercury, Moon (iter 37), Pluto (iter 78); live band shear extended to Uranus + Neptune (iter 66); Moon, Jupiter, Saturn, Mars, Venus, Mercury 4K progressive upgrades (iters 69–77) — every tour-stop world hi-res
- [x] Atmospheric scattering upgrade (day-side rim, sunset terminator band) — shipped iter 15; limb haze extended to all four giants (iter 40); Venus cloud-deck super-rotation, ~4-day visual spin (iter 60)
- [x] Ring shadows both ways (iter 6, 32); Galilean moon transit shadows on Jupiter (iter 36); Saturn's big-four moon shadows (iter 38); moons eclipse into their planet's shadow (iter 53)
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
- [x] Named asteroids: Vesta (iter 4); Pallas, Bennu, Apophis (iter 23); small-body hero pass — irregular lumpy asteroids, seeded crater bumps on textureless dwarfs, Haumea egg shape (iter 44)
- [x] More Kuiper objects: Makemake, Haumea (iter 4); Arrokoth, Sedna (iter 9)

**UX & fun**
- [x] Guided tour mode ("Grand Tour" — autoplay through highlights) — shipped iter 7 (prev/next/exit, auto-advance 9s, exits on manual selection); cinematic camera drift during dwells (iter 50); curated to 21 stops featuring the new hero visuals — Io, Triton, Bennu (iter 61)
- [x] Label overlap avoidance (collision-aware placement) — shipped iter 8 (priority: selected > Sun > planets > craft > moons)
- [x] Time-reverse (negative speeds) and date picker (jump to any date —
      e.g., 1986 Halley apparition, 2061 return) — shipped iter 4
- [x] Object comparison cards: to-scale size discs vs Earth in info panel — shipped iter 16
- [x] Keyboard navigation (arrows cycle objects, ? help overlay) — shipped iter 8; Space toggles play/pause like a video player (iter 57)
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
- An enthusiast can answer "where is X right now?" for any of 70+ objects.
- The suite stays green; no known bugs ship and stay shipped.
- It feels alive: time moves, things orbit, the sky is the real sky of today.
