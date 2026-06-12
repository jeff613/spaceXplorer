# Changelog

Maintained by the improvement loop. Newest first. "Iter" numbers refer to
loop iterations (see PRD.md).

## Unreleased (develop, iters 42–90)

### P0 fixes (pre-launch)
- True-scale mode: spacecraft are now proportionate miniatures (ISS was
  rendering at ~4.8× Earth's radius); fly-to framing and glint fade-out
  made scale-aware so craft are visible and frameable
- Fast playback no longer strobes: per-motion smooth clocks cap displayed
  sweep at 0.25 rad/frame (temporal aliasing of short-period objects),
  snapping back to exact sim time when in range
- Mars rovers: real rocker-bogie miniatures, surface-normal aligned and
  ground-level (were unrotated half-buried boxes), sized to Mars, fly-to
  framed against the planet
- Asteroid belt: 2200 lit instanced rocks (4 draw calls) + far dust layer,
  replacing flat square sprites; deterministic, FPS unchanged
- Earth: ocean roughness floored at 0.35 — mirror seas were reflecting the
  IBL room's rectangular light panels as white squares
- Comet tails: curved dust fan + straight blue ion tail as soft shader
  sprites with tip falloff, replacing the fixed-pixel square "beam"
- Tesla Roadster rebuilt as the real thing: curved cherry-red body, spoked
  wheels, cockpit, and Starman in the left seat (~60 meshes, was a brick)
- "Surprise me" button integrated into the HUD language (cyan sibling of
  Grand Tour; it previously had no styling at all)
- Time bar: slider's leftmost is now exactly real time and the redundant
  1× button is gone; default stays 1 day/s
- Fly-to on orbiters can no longer arrive with the parent planet blocking
  the view: arrival bearing blends radially out until the sightline clears
  the parent by 1.15× its radius (ISS was occluded on 5/16 bearings)
- Following an orbiter now rides its orbit's rotating frame: the camera
  spins around the parent with the craft, so Earth stays pinned in view
  behind ISS at any sim speed instead of whirling through the frame

### Visual quality
- Comet hero pass: coal-dark lumpy nuclei, perihelion-driven coma (43)
- Small bodies: irregular asteroids (Bennu, Vesta…), seeded crater bumps on
  textureless dwarfs, Haumea's egg shape (44–45)
- Moon color identities: Io volcanic, Europa lineae, Ganymede two-tone,
  Callisto speckles, Titan haze + atmosphere, Iapetus yin-yang + ridge,
  Triton cantaloupe, Charon's Mordor Macula (46, 62, 63, 67)
- Enceladus south-polar geyser plume (65)
- Phobos/Deimos potato shapes (49); Pluto bump relief (78)
- Hi-res progressive textures: Earth 8K; Moon/Jupiter/Saturn/Mars/Venus/
  Mercury 4K, Earth clouds 4K — first paint stays lightweight (56, 58, 69–71, 77, 86)
- Live band shear on Uranus + Neptune (66); starfield nebulae + Andromeda (47)
- Craft fixes: Roadster ×6 speck fix, rover scale, Parker matte-shield orb
  fix (42, 48)

### Accuracy & realism
- Moons go dark in their planet's shadow — Rømer's eclipses (53)
- Pluto–Charon barycenter wobble (52); Venus cloud-deck super-rotation (60)
- Deep-space probes recede at real AU/yr rates with sim time (81)

### UX, reliability, accessibility
- Cinematic camera drift during Grand Tour dwells (50); tour curated to 21
  stops (61)
- Surprise me: fly to a random object (87); info-panel ‹ › cycling for touch users (88, mobile-gated 89); CSS boot splash for slow connections (90); Space bar play/pause (57); zoom floor prevents clipping inside bodies (59)
- aria-labels on all controls (54); prefers-reduced-motion support (55)
- Texture-failure fallback (51); asset-integrity deploy gate (73);
  invalid-deep-link and mobile value-bounds gates (76)
- Social preview card (64); README refresh (68); texture housekeeping +
  .railwayignore fix (72)

### New objects (gate reopened at 79)
- Mars Express (79), Danuri/KPLO (80), ExoMars TGO (83)

### Quality infrastructure
- Suite grew 91 → 124 assertions; pixel baselines refreshed (74); FPS gate
  raised to 30 — measured 120 idle and at 100 days/s (82)

## Released — production @ f7e0927 (iters ≤ 41)

- Earth hero pass: 8K daymap, topology bump, specular oceans (35)
- Galilean transit shadows on Jupiter (36); Saturn's big-four shadows (38)
- Terrain bumps for Mars/Mercury/Moon (37); Sun limb darkening +
  chromosphere rim (39)
- Atmosphere limb haze on all four giants (40); film grain + vignette (41)
- Everything earlier: orbits, tour, time machine, search, mobile, sound,
  true scale, deep links, 92-assertion suite.
