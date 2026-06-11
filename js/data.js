// ─── Scaling ──────────────────────────────────────────────────────────────
// True solar-system scale is unusable on screen (Neptune would be 6 km from
// a 1 m Sun), so distances are compressed with a power law and radii with a
// gentler one. All physics (periods, eccentricity, inclination) stays real.

export const TRUE_SCALE = typeof location !== 'undefined'
  && new URLSearchParams(location.search).get('scale') === 'true';

export const DIST_EXP = 0.55;
export const DIST_MUL = 62;
const KM_PER_AU = 149597870;

export function scaleDistance(au) {
  if (TRUE_SCALE) return au * DIST_MUL;
  return Math.pow(au, DIST_EXP) * DIST_MUL;
}

// inverse: display-space length back to real AU
export function displayLenToAU(len) {
  if (TRUE_SCALE) return len / DIST_MUL;
  return Math.pow(len / DIST_MUL, 1 / DIST_EXP);
}

export function scaleRadius(km) {
  if (TRUE_SCALE) return (km / KM_PER_AU) * DIST_MUL;
  const earthR = km / 6371;
  return Math.max(0.55, Math.pow(earthR, 0.45) * 1.7);
}

export const SUN_DISPLAY_RADIUS = TRUE_SCALE ? (696340 / KM_PER_AU) * DIST_MUL : 11;

// Deterministic PRNG (mulberry32) — the universe scatter (stars, belts,
// constellations, moon phases) must be reproducible run to run
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Days since J2000 epoch (2000-01-01 12:00 UTC) for a JS Date
export const J2000 = Date.UTC(2000, 0, 1, 12);
export function daysSinceJ2000(date = new Date()) {
  return (date.getTime() - J2000) / 86400000;
}

// ─── Planets ──────────────────────────────────────────────────────────────
// Keplerian elements at J2000: a (AU), e, i (deg), Om = longitude of
// ascending node, varpi = longitude of perihelion, L0 = mean longitude.
// period in days, rotationHours sidereal (negative = retrograde), tilt deg.

export const PLANETS = [
  {
    id: 'mercury', name: 'Mercury', type: 'Planet', texture: '2k_mercury.jpg', textureHi: '4k_mercury.jpg',
    bump: 'mercurybump.jpg', bumpScale: 2.0,
    radiusKm: 2439.7,
    elements: { a: 0.387, e: 0.2056, i: 7.0, Om: 48.33, varpi: 77.46, L0: 252.25, period: 87.97 },
    rotationHours: 1407.6, tilt: 0.03,
    info: {
      'Radius': '2,440 km', 'Mass': '3.30 × 10²³ kg', 'Orbital period': '88 days',
      'Day length': '58.6 Earth days', 'Distance from Sun': '0.39 AU',
      'Surface temp': '−173 to 427 °C', 'Moons': '0',
    },
    fact: 'Mercury\'s day-night temperature swing of 600 °C is the most extreme in the solar system — yet ice hides in its permanently shadowed polar craters.',
  },
  {
    id: 'venus', name: 'Venus', type: 'Planet', texture: '2k_venus_atmosphere.jpg', textureHi: '4k_venus_atmosphere.jpg', atmosphere: 0xe8cf9a,
    radiusKm: 6051.8,
    elements: { a: 0.723, e: 0.0068, i: 3.39, Om: 76.68, varpi: 131.53, L0: 181.98, period: 224.7 },
    rotationHours: -5832.5, visualSpinHours: -96, tilt: 177.4,
    info: {
      'Radius': '6,052 km', 'Mass': '4.87 × 10²⁴ kg', 'Orbital period': '225 days',
      'Day length': '243 Earth days (retrograde)', 'Distance from Sun': '0.72 AU',
      'Surface temp': '464 °C', 'Moons': '0',
    },
    fact: 'Venus spins backwards and so slowly that its day is longer than its year. Its CO₂ atmosphere makes it hotter than Mercury.',
  },
  {
    id: 'earth', name: 'Earth', type: 'Planet', texture: '2k_earth_daymap.jpg', textureHi: '8k_earth_daymap.jpg', clouds: '2k_earth_clouds.jpg',
    bump: 'earth_topology.png', water: 'earth_water.png',
    nightLights: 'earthlights.jpg', atmosphere: 0x5fa8ff,
    radiusKm: 6371,
    elements: { a: 1.0, e: 0.0167, i: 0.0, Om: 0.0, varpi: 102.94, L0: 100.46, period: 365.25 },
    rotationHours: 23.93, tilt: 23.44,
    info: {
      'Radius': '6,371 km', 'Mass': '5.97 × 10²⁴ kg', 'Orbital period': '365.25 days',
      'Day length': '23.93 hours', 'Distance from Sun': '1.00 AU',
      'Surface temp': '−88 to 58 °C', 'Moons': '1',
    },
    fact: 'The only known world with liquid surface water and life. More than 10,000 satellites orbit it — most of them Starlink.',
  },
  {
    id: 'mars', name: 'Mars', type: 'Planet', texture: '2k_mars.jpg', textureHi: '4k_mars.jpg', atmosphere: 0xd89a72,
    bump: 'marsbump1k.jpg', bumpScale: 2.4,
    radiusKm: 3389.5,
    elements: { a: 1.524, e: 0.0934, i: 1.85, Om: 49.56, varpi: 336.04, L0: 355.45, period: 686.98 },
    rotationHours: 24.62, tilt: 25.19,
    info: {
      'Radius': '3,390 km', 'Mass': '6.42 × 10²³ kg', 'Orbital period': '687 days',
      'Day length': '24.6 hours', 'Distance from Sun': '1.52 AU',
      'Surface temp': '−153 to 20 °C', 'Moons': '2',
    },
    fact: 'Home to Olympus Mons, a volcano three times the height of Everest, and Valles Marineris, a canyon as long as the United States.',
  },
  {
    id: 'jupiter', name: 'Jupiter', type: 'Planet', texture: '2k_jupiter.jpg', textureHi: '4k_jupiter.jpg', bands: true, moonShadows: true,
    atmosphere: 0xd9bd92,
    radiusKm: 69911,
    elements: { a: 5.203, e: 0.0484, i: 1.30, Om: 100.56, varpi: 14.75, L0: 34.40, period: 4332.6 },
    rotationHours: 9.93, tilt: 3.13,
    info: {
      'Radius': '69,911 km', 'Mass': '1.90 × 10²⁷ kg', 'Orbital period': '11.86 years',
      'Day length': '9.93 hours', 'Distance from Sun': '5.20 AU',
      'Cloud-top temp': '−108 °C', 'Moons': '95',
    },
    fact: 'More than twice as massive as all other planets combined. The Great Red Spot is a storm larger than Earth that has raged for centuries.',
  },
  {
    id: 'saturn', name: 'Saturn', type: 'Planet', texture: '2k_saturn.jpg', textureHi: '4k_saturn.jpg', ring: '2k_saturn_ring_alpha.png', bands: true,
    moonShadows: true, atmosphere: 0xe9dcae,
    radiusKm: 58232,
    elements: { a: 9.537, e: 0.0542, i: 2.49, Om: 113.72, varpi: 92.43, L0: 49.94, period: 10759 },
    rotationHours: 10.7, tilt: 26.73,
    info: {
      'Radius': '58,232 km', 'Mass': '5.68 × 10²⁶ kg', 'Orbital period': '29.4 years',
      'Day length': '10.7 hours', 'Distance from Sun': '9.54 AU',
      'Cloud-top temp': '−139 °C', 'Moons': '146',
    },
    fact: 'Its rings span 280,000 km but are on average only about 10 metres thick — proportionally thinner than a sheet of paper.',
  },
  {
    id: 'uranus', name: 'Uranus', type: 'Planet', texture: '2k_uranus.jpg', ringProc: 'uranus', bands: true,
    atmosphere: 0xaee6ea,
    radiusKm: 25362,
    elements: { a: 19.19, e: 0.0472, i: 0.77, Om: 74.0, varpi: 170.96, L0: 313.23, period: 30688.5 },
    rotationHours: -17.24, tilt: 97.77,
    info: {
      'Radius': '25,362 km', 'Mass': '8.68 × 10²⁵ kg', 'Orbital period': '84 years',
      'Day length': '17.2 hours (retrograde)', 'Distance from Sun': '19.19 AU',
      'Cloud-top temp': '−197 °C', 'Moons': '28',
    },
    fact: 'Uranus rolls around the Sun on its side, tilted 98° — likely the scar of an ancient collision with an Earth-sized body.',
  },
  {
    id: 'neptune', name: 'Neptune', type: 'Planet', texture: '2k_neptune.jpg', ringProc: 'neptune', bands: true,
    atmosphere: 0x7aa6f5,
    radiusKm: 24622,
    elements: { a: 30.07, e: 0.0086, i: 1.77, Om: 131.78, varpi: 44.97, L0: 304.88, period: 60182 },
    rotationHours: 16.11, tilt: 28.32,
    info: {
      'Radius': '24,622 km', 'Mass': '1.02 × 10²⁶ kg', 'Orbital period': '165 years',
      'Day length': '16.1 hours', 'Distance from Sun': '30.07 AU',
      'Cloud-top temp': '−201 °C', 'Moons': '16',
    },
    fact: 'The windiest world known: supersonic gusts reach 2,100 km/h. It was discovered by mathematics before it was ever seen.',
  },
  {
    id: 'ceres', name: 'Ceres', type: 'Dwarf planet', color: 0x9a9186,
    radiusKm: 469.7,
    elements: { a: 2.767, e: 0.0758, i: 10.59, Om: 80.39, varpi: 153.99, L0: 250.0, period: 1680 },
    rotationHours: 9.07, tilt: 4.0,
    info: {
      'Radius': '470 km', 'Mass': '9.39 × 10²⁰ kg', 'Orbital period': '4.6 years',
      'Day length': '9.1 hours', 'Distance from Sun': '2.77 AU',
      'Surface temp': '−105 °C', 'Claim': 'Largest object in the asteroid belt',
    },
    fact: 'Ceres holds about a third of the asteroid belt\'s total mass, and its bright Occator crater spots are salty brine left by a buried ocean.',
  },
  {
    id: 'vesta', lumpy: true, name: 'Vesta', type: 'Asteroid', color: 0xb5a285,
    radiusKm: 262.7,
    elements: { a: 2.362, e: 0.0886, i: 7.14, Om: 103.8, varpi: 254.2, L0: 99.8, period: 1325 },
    rotationHours: 5.34, tilt: 29.0,
    info: {
      'Radius': '263 km', 'Mass': '2.59 × 10²⁰ kg', 'Orbital period': '3.6 years',
      'Day length': '5.3 hours', 'Distance from Sun': '2.36 AU',
      'Claim': 'Brightest asteroid in the sky',
    },
    fact: 'A surviving protoplanet from the dawn of the solar system. A giant impact at its south pole flung debris that still falls to Earth as meteorites.',
  },
  {
    id: 'pallas', lumpy: true, name: 'Pallas', type: 'Asteroid', color: 0x8e8a84,
    radiusKm: 256,
    elements: { a: 2.772, e: 0.230, i: 34.9, Om: 172.9, varpi: 123.8, L0: 220.0, period: 1686 },
    rotationHours: 7.81, tilt: 84,
    info: {
      'Radius': '256 km', 'Orbital period': '4.6 years',
      'Inclination': '34.9° — wildly tilted orbit', 'Discovered': '1802 (second asteroid ever)',
    },
    fact: 'Its orbit is tilted almost 35° out of the plane every planet orbits in — a cannonball cutting diagonally through the solar system.',
  },
  {
    id: 'bennu', lumpy: true, name: 'Bennu', type: 'Near-Earth asteroid', color: 0x4a4a50,
    radiusKm: 0.245,
    elements: { a: 1.126, e: 0.2037, i: 6.03, Om: 2.06, varpi: 68.3, L0: 170.0, period: 436.6 },
    rotationHours: 4.3, tilt: 178,
    info: {
      'Diameter': '490 m', 'Orbital period': '1.2 years',
      'Visited': 'OSIRIS-REx, sample returned Sept 2023',
      'Surface': 'Rubble pile that nearly swallowed the probe',
      'Impact odds': '1-in-2,700 in 2182',
    },
    fact: 'When OSIRIS-REx touched it, the surface behaved like a ball pit — the probe would have sunk in if it hadn\'t fired thrusters and fled with its sample.',
  },
  {
    id: 'apophis', lumpy: true, name: 'Apophis', type: 'Near-Earth asteroid', color: 0x6e645a,
    radiusKm: 0.185,
    elements: { a: 0.9224, e: 0.1914, i: 3.34, Om: 204.4, varpi: 330.8, L0: 243.0, period: 323.6 },
    rotationHours: 30.4, tilt: 0,
    info: {
      'Diameter': '370 m', 'Orbital period': '0.9 years',
      'April 13, 2029': 'Passes within 32,000 km of Earth',
      'That is': 'Closer than GPS and TV satellites',
      'Named for': 'The Egyptian serpent of chaos',
    },
    fact: 'On Friday, April 13, 2029, two billion people will be able to watch an asteroid cross the sky with the naked eye — and Earth\'s gravity will permanently bend its orbit.',
  },
  {
    id: 'pluto', name: 'Pluto', type: 'Dwarf planet', texture: 'plutomap1k.jpg', bump: 'plutobump1k.jpg', bumpScale: 1.2,
    radiusKm: 1188.3,
    elements: { a: 39.48, e: 0.2488, i: 17.14, Om: 110.30, varpi: 224.07, L0: 238.93, period: 90560 },
    rotationHours: -153.3, tilt: 122.5,
    info: {
      'Radius': '1,188 km', 'Mass': '1.31 × 10²² kg', 'Orbital period': '248 years',
      'Day length': '6.4 Earth days', 'Distance from Sun': '29.7 – 49.3 AU',
      'Surface temp': '−229 °C', 'Moons': '5',
    },
    fact: 'Smaller than Earth\'s Moon, with a heart-shaped nitrogen glacier the size of Texas. Its orbit sometimes brings it closer to the Sun than Neptune.',
  },
  {
    id: 'eris', name: 'Eris', type: 'Dwarf planet', color: 0xd8d4cf,
    radiusKm: 1163,
    elements: { a: 67.86, e: 0.436, i: 44.04, Om: 35.95, varpi: 187.15, L0: 15.2, period: 203830 },
    rotationHours: 25.9, tilt: 78.0,
    info: {
      'Radius': '1,163 km', 'Mass': '1.66 × 10²² kg', 'Orbital period': '558 years',
      'Distance from Sun': '38 – 97 AU', 'Surface temp': '−243 °C',
      'Moons': '1 (Dysnomia)', 'Discovered': '2005',
    },
    fact: 'More massive than Pluto. Its discovery forced astronomers to finally define "planet" — and Pluto lost the vote in 2006.',
  },
  {
    id: 'sedna', name: 'Sedna', type: 'Trans-Neptunian object', color: 0xc46a4a,
    radiusKm: 498,
    elements: { a: 506, e: 0.855, i: 11.93, Om: 144.3, varpi: 95.6, L0: 93.4, period: 4163000 },
    rotationHours: 10.3, tilt: 0,
    info: {
      'Radius': '~500 km', 'Orbital period': '~11,400 years',
      'Distance from Sun': '76 – 936 AU', 'Surface': 'One of the reddest objects known',
      'Next perihelion': '2076',
    },
    fact: 'Takes 11,400 years to orbit once — when Sedna last passed this close to the Sun, humans were inventing agriculture.',
  },
  {
    id: 'arrokoth', lumpy: true, name: 'Arrokoth', type: 'Kuiper Belt object', color: 0xb58a6a,
    radiusKm: 18,
    elements: { a: 44.58, e: 0.042, i: 2.45, Om: 159.0, varpi: 174.4, L0: 300.0, period: 107000 },
    rotationHours: 15.9, tilt: 99,
    info: {
      'Dimensions': '36 × 20 km, two-lobed', 'Orbital period': '293 years',
      'Distance from Sun': '44.6 AU', 'Visited': 'New Horizons, Jan 1, 2019',
      'Shape': 'Two gently merged lobes ("snowman")',
    },
    fact: 'The most distant and most primitive world ever visited — two lobes that gently merged 4.6 billion years ago and froze in time.',
  },
  {
    id: 'makemake', name: 'Makemake', type: 'Dwarf planet', color: 0xc4a98e,
    radiusKm: 715,
    elements: { a: 45.43, e: 0.161, i: 29.0, Om: 79.6, varpi: 14.6, L0: 179.6, period: 112897 },
    rotationHours: 22.8, tilt: 0,
    info: {
      'Radius': '715 km', 'Orbital period': '309 years', 'Distance from Sun': '38 – 53 AU',
      'Surface': 'Reddish methane ice', 'Discovered': '2005 (Easter week)',
    },
    fact: 'Named for the creator god of Rapa Nui (Easter Island), having been discovered just after Easter. Its surface is frosted with frozen methane.',
  },
  {
    id: 'haumea', stretch: [1.5, 0.75, 1], name: 'Haumea', type: 'Dwarf planet', color: 0xd8d8e0,
    radiusKm: 816,
    elements: { a: 43.1, e: 0.195, i: 28.2, Om: 122.2, varpi: 1.2, L0: 219.2, period: 103660 },
    rotationHours: 3.9, tilt: 0,
    info: {
      'Dimensions': '~2,100 × 1,100 km (egg-shaped)', 'Orbital period': '284 years',
      'Day length': '3.9 hours — fastest large body', 'Moons': '2', 'Rings': 'Yes (discovered 2017)',
    },
    fact: 'Spins so fast (one day = 3.9 hours) that it has been stretched into an egg shape — and it has its own ring.',
  },
];

export const SUN = {
  id: 'sun', name: 'Sun', type: 'G-type star', texture: '2k_sun.jpg',
  radiusKm: 696340,
  info: {
    'Radius': '696,340 km (109 × Earth)', 'Mass': '1.99 × 10³⁰ kg (99.86% of system)',
    'Surface temp': '5,505 °C', 'Core temp': '15 million °C', 'Age': '4.6 billion years',
  },
  fact: 'Every second the Sun fuses 600 million tonnes of hydrogen, converting 4 million tonnes of matter directly into light.',
};

// ─── Moons ────────────────────────────────────────────────────────────────
// orbitRadii = display distance in units of the parent planet's display
// radius. period in days (negative = retrograde).

// Moons orbit their parent's equatorial plane unless `ecliptic: true`
// (Earth's Moon orbits near the ecliptic, not Earth's equator).
export const MOONS = [
  {
    id: 'moon', name: 'Moon', type: 'Moon of Earth', parent: 'earth', texture: '2k_moon.jpg', textureHi: '4k_moon.jpg',
    bump: 'moonbump1k.jpg', bumpScale: 1.8,
    ecliptic: true, meanLongitude0: 218.316, orbitInclination: 5.14,
    radiusKm: 1737.4, orbitRadii: 3.2, trueOrbitRadii: 60.3, period: 27.321661,
    info: {
      'Radius': '1,737 km', 'Orbital period': '27.3 days',
      'Distance from Earth': '384,400 km', 'Surface temp': '−173 to 127 °C',
    },
    fact: 'The Moon drifts 3.8 cm farther from Earth every year. Twelve humans have walked on it — so far.',
  },
  {
    id: 'phobos', lumpy: true, name: 'Phobos', type: 'Moon of Mars', parent: 'mars', color: 0x8d8276,
    radiusKm: 11.3, orbitRadii: 1.8, trueOrbitRadii: 2.76, period: 0.319,
    info: { 'Radius': '11 km', 'Orbital period': '7.7 hours', 'Fate': 'Crashing into Mars in ~50 Myr' },
    fact: 'Orbits Mars faster than Mars rotates — it rises in the west, sets in the east, and is slowly spiraling inward to its doom.',
  },
  {
    id: 'deimos', lumpy: true, name: 'Deimos', type: 'Moon of Mars', parent: 'mars', color: 0x9d9388,
    radiusKm: 6.2, orbitRadii: 2.8, trueOrbitRadii: 6.92, period: 1.263,
    info: { 'Radius': '6 km', 'Orbital period': '30.3 hours', 'Shape': 'Lumpy captured asteroid' },
    fact: 'So small that from its surface you could reach escape velocity on a bicycle.',
  },
  {
    id: 'io', style: 'io', name: 'Io', type: 'Moon of Jupiter', parent: 'jupiter', color: 0xd8c95a,
    radiusKm: 1821.6, orbitRadii: 2.0, trueOrbitRadii: 5.9, period: 1.77,
    info: { 'Radius': '1,822 km', 'Orbital period': '1.8 days', 'Volcanoes': '400+ active' },
    fact: 'The most volcanically active body in the solar system, kneaded by Jupiter\'s tides like a stress ball.',
  },
  {
    id: 'europa', style: 'europa', name: 'Europa', type: 'Moon of Jupiter', parent: 'jupiter', color: 0xcfc4ae,
    radiusKm: 1560.8, orbitRadii: 2.7, trueOrbitRadii: 9.4, period: 3.55,
    info: { 'Radius': '1,561 km', 'Orbital period': '3.6 days', 'Ocean depth': '~100 km under ice' },
    fact: 'Beneath its cracked ice shell lies a salty ocean with twice the water of all Earth\'s oceans — a prime candidate for life.',
  },
  {
    id: 'ganymede', style: 'ganymede', name: 'Ganymede', type: 'Moon of Jupiter', parent: 'jupiter', color: 0x9b8d7d,
    radiusKm: 2634.1, orbitRadii: 3.5, trueOrbitRadii: 15.3, period: 7.15,
    info: { 'Radius': '2,634 km', 'Orbital period': '7.2 days', 'Claim': 'Largest moon in the solar system' },
    fact: 'Bigger than the planet Mercury, and the only moon known to generate its own magnetic field.',
  },
  {
    id: 'callisto', style: 'callisto', name: 'Callisto', type: 'Moon of Jupiter', parent: 'jupiter', color: 0x6f6a60,
    radiusKm: 2410.3, orbitRadii: 4.4, trueOrbitRadii: 26.9, period: 16.69,
    info: { 'Radius': '2,410 km', 'Orbital period': '16.7 days', 'Surface': 'Most cratered in the system' },
    fact: 'Its ancient surface has barely changed in 4 billion years — a fossil record of the early solar system.',
  },
  {
    id: 'titan', style: 'titan', atmosphere: 0xd8954a, name: 'Titan', type: 'Moon of Saturn', parent: 'saturn', color: 0xc9a24b,
    radiusKm: 2574.7, orbitRadii: 3.6, trueOrbitRadii: 20.3, period: 15.95,
    info: { 'Radius': '2,575 km', 'Orbital period': '16 days', 'Atmosphere': 'Denser than Earth\'s' },
    fact: 'The only moon with a thick atmosphere, and the only world besides Earth with rivers, lakes and rain — of liquid methane.',
  },
  {
    id: 'enceladus', geysers: true, name: 'Enceladus', type: 'Moon of Saturn', parent: 'saturn', color: 0xeef4f8,
    radiusKm: 252.1, orbitRadii: 2.5, trueOrbitRadii: 4.09, period: 1.37,
    info: { 'Radius': '252 km', 'Orbital period': '1.4 days', 'Albedo': 'Most reflective body in the system' },
    fact: 'Ice geysers at its south pole jet ocean water into space, feeding Saturn\'s E ring — a free sample of an alien sea.',
  },
  {
    id: 'rhea', name: 'Rhea', type: 'Moon of Saturn', parent: 'saturn', color: 0xb0aca6,
    radiusKm: 763.8, orbitRadii: 2.95, trueOrbitRadii: 9.05, period: 4.52,
    info: { 'Radius': '764 km', 'Orbital period': '4.5 days', 'Composition': 'Mostly water ice' },
    fact: 'Saturn\'s second-largest moon — a dirty snowball three-quarters ice, possibly with its own faint ring system.',
  },
  {
    id: 'iapetus', style: 'iapetus', name: 'Iapetus', type: 'Moon of Saturn', parent: 'saturn', color: 0x7a6f5e,
    radiusKm: 734.5, orbitRadii: 5.0, trueOrbitRadii: 61.1, period: 79.3,
    info: { 'Radius': '735 km', 'Orbital period': '79 days', 'Feature': '20 km equatorial ridge' },
    fact: 'The yin-yang moon: one hemisphere is coal-black, the other snow-white, with a mysterious mountain ridge wrapping its equator.',
  },
  {
    id: 'miranda', name: 'Miranda', type: 'Moon of Uranus', parent: 'uranus', color: 0xa8b0b8,
    radiusKm: 235.8, orbitRadii: 2.2, trueOrbitRadii: 5.12, period: 1.41,
    info: { 'Radius': '236 km', 'Orbital period': '1.4 days', 'Feature': 'Verona Rupes, 20 km cliff' },
    fact: 'A patchwork world that looks reassembled from spare parts. Its Verona Rupes cliff is the tallest known — a 20 km sheer drop.',
  },
  {
    id: 'titania', name: 'Titania', type: 'Moon of Uranus', parent: 'uranus', color: 0x9aa0a8,
    radiusKm: 788.4, orbitRadii: 3.0, trueOrbitRadii: 17.2, period: 8.71,
    info: { 'Radius': '788 km', 'Orbital period': '8.7 days', 'Claim': 'Largest moon of Uranus' },
    fact: 'Like all of Uranus\'s moons it is named from Shakespeare — and orbits sideways along with its rolled-over planet.',
  },
  {
    id: 'oberon', name: 'Oberon', type: 'Moon of Uranus', parent: 'uranus', color: 0x8e949c,
    radiusKm: 761.4, orbitRadii: 3.8, trueOrbitRadii: 23.0, period: 13.46,
    info: { 'Radius': '761 km', 'Orbital period': '13.5 days', 'Surface': 'Ancient, heavily cratered' },
    fact: 'The outermost large moon of Uranus, scarred by craters with mysterious dark floors.',
  },
  {
    id: 'triton', style: 'triton', name: 'Triton', type: 'Moon of Neptune', parent: 'neptune', color: 0xb8c4c9,
    radiusKm: 1353.4, orbitRadii: 3.0, trueOrbitRadii: 14.4, period: -5.88,
    info: { 'Radius': '1,353 km', 'Orbital period': '5.9 days (retrograde)', 'Origin': 'Captured Kuiper Belt object' },
    fact: 'Orbits backwards — a captured Kuiper Belt world. Nitrogen geysers erupt from its −235 °C surface.',
  },
  {
    id: 'charon', style: 'charon', name: 'Charon', type: 'Moon of Pluto', parent: 'pluto', color: 0x8d8b90,
    radiusKm: 606, orbitRadii: 2.6, trueOrbitRadii: 16.5, period: 6.39,
    info: { 'Radius': '606 km', 'Orbital period': '6.4 days', 'Feature': 'Mordor Macula (dark red pole)' },
    fact: 'Half Pluto\'s size — the pair orbit a point in empty space between them, making Pluto–Charon the solar system\'s only true binary world.',
  },
];

// ─── Comets ───────────────────────────────────────────────────────────────

export const COMETS = [
  {
    id: 'halley', name: "Halley's Comet", type: 'Periodic comet', color: 0xcfe6f5,
    // perihelion Feb 1986; L0 derived from mean motion since then
    elements: { a: 17.83, e: 0.967, i: 162.26, Om: 58.42, varpi: 169.75, L0: 236.7, period: 27284 },
    info: {
      'Nucleus': '15 × 8 km', 'Orbital period': '~75 years',
      'Last perihelion': '1986', 'Next perihelion': '2061',
      'Orbit': 'Retrograde, 0.59 – 35 AU',
    },
    fact: 'The only comet visible to the naked eye that can appear twice in a human lifetime. Records of it go back to 240 BC.',
  },
  {
    id: 'churyumov', name: '67P/Churyumov–Gerasimenko', type: 'Periodic comet', color: 0xb8d0d8,
    // perihelion Nov 2, 2021
    elements: { a: 3.463, e: 0.641, i: 7.04, Om: 50.18, varpi: 62.96, L0: 347.3, period: 2484 },
    info: {
      'Nucleus': '4.3 × 4.1 km, duck-shaped', 'Orbital period': '6.8 years',
      'Last perihelion': '2021', 'Visited': 'Rosetta orbited it 2014–2016',
      'Lander': 'Philae — first soft landing on a comet',
    },
    fact: 'Rosetta chased it for ten years, orbited it for two, and dropped the Philae lander on it — the first time humanity ever landed on a comet.',
  },
  {
    id: 'neowise', name: 'Comet NEOWISE', type: 'Long-period comet', color: 0xd8e8f0,
    // perihelion July 3, 2020; won't return for ~6,800 years
    elements: { a: 358, e: 0.99921, i: 128.9, Om: 61.0, varpi: 98.3, L0: 97.2, period: 2471000 },
    info: {
      'Nucleus': '~5 km', 'Orbital period': '~6,800 years',
      'Last perihelion': 'July 3, 2020', 'Next return': 'Around the year 8800',
      'Memory': 'Best naked-eye comet since Hale-Bopp',
    },
    fact: 'For a few weeks in July 2020 it hung over the northern twilight with a golden dust tail — and no one alive will ever see it again.',
  },
];

// ─── Spacecraft & man-made objects ────────────────────────────────────────

export const SPACECRAFT = [
  {
    id: 'iss', name: 'ISS', type: 'Space station', kind: 'orbiter', parent: 'earth',
    orbitRadii: 1.45, periodDays: 0.0645, inclination: 51.6, color: 0xfafafa,
    info: {
      'Launched': '1998 (first module)', 'Altitude': '~408 km', 'Speed': '7.66 km/s',
      'Orbital period': '92.9 min', 'Mass': '~420 tonnes', 'Crew': 'Continuously occupied since 2000',
    },
    fact: 'The largest structure humans have ever put in space, assembled over 40+ flights. It circles Earth 16 times a day.',
  },
  {
    id: 'hubble', name: 'Hubble', type: 'Space telescope', kind: 'orbiter', parent: 'earth',
    orbitRadii: 1.62, periodDays: 0.0661, inclination: 28.5, color: 0xc8d8ff,
    info: {
      'Launched': '1990', 'Altitude': '~535 km', 'Mirror': '2.4 m',
      'Orbital period': '95 min', 'Observations': '1.5+ million',
    },
    fact: 'Has stared so deep into the cosmos it photographed galaxies whose light left them 13 billion years ago.',
  },
  {
    id: 'juno', name: 'Juno', type: 'Jupiter orbiter', kind: 'orbiter', parent: 'jupiter',
    orbitRadii: 2.6, periodDays: 53, inclination: 90, color: 0xc8e4ff,
    info: {
      'Launched': 'Aug 5, 2011', 'Arrived at Jupiter': 'July 4, 2016',
      'Orbit': 'Polar, 53-day ellipse', 'Power': 'Solar — farthest solar-powered craft',
      'Findings': 'Jupiter\'s core is "fuzzy", dissolved into the planet',
    },
    fact: 'Carries three LEGO figurines (Jupiter, Juno and Galileo) and skims 4,200 km above Jupiter\'s clouds through lethal radiation belts.',
  },
  {
    id: 'akatsuki', name: 'Akatsuki', type: 'Venus orbiter', kind: 'orbiter', parent: 'venus',
    orbitRadii: 3.2, periodDays: 10.8, inclination: 3, color: 0xffd0b8,
    info: {
      'Operator': 'JAXA (Japan)', 'Launched': 'May 20, 2010',
      'First try': 'Engine failed — missed Venus entirely (2010)',
      'Second try': 'Captured using tiny thrusters (2015)',
      'Studies': 'Venus\'s super-rotating atmosphere',
    },
    fact: 'Missed Venus in 2010 when its engine died, orbited the Sun alone for five years, then threaded itself into Venus orbit using only its attitude thrusters.',
  },
  {
    id: 'tiangong', name: 'Tiangong', type: 'Space station', kind: 'orbiter', parent: 'earth',
    orbitRadii: 1.41, periodDays: 0.0636, inclination: 41.5, color: 0xffd8d8,
    info: {
      'Operator': 'CMSA (China)', 'Completed': '2022',
      'Altitude': '~390 km', 'Orbital period': '91.5 min',
      'Crew': '3 taikonauts, rotating missions', 'Mass': '~100 tonnes',
    },
    fact: 'The second permanently crewed outpost in orbit — its name means "Heavenly Palace", and it hosts experiments from 17 nations.',
  },
  {
    id: 'dragon', name: 'Crew Dragon', type: 'Crew capsule (SpaceX)', kind: 'orbiter', parent: 'earth',
    orbitRadii: 1.48, periodDays: 0.0648, inclination: 51.6, color: 0xf0f4f8,
    info: {
      'First crewed flight': 'Demo-2 — May 30, 2020',
      'First': 'First commercial spacecraft to carry humans to orbit',
      'Crew': '4 on NASA missions (designed for up to 7)',
      'Heat shield': 'PICA-X ablative', 'Docks with': 'The ISS, autonomously',
    },
    fact: 'Ended America\'s nine-year human-launch gap after the Shuttle retired — the first crewed orbital spacecraft ever built and flown by a private company.',
  },
  {
    id: 'starship', name: 'Starship', type: 'Super heavy-lift rocket (SpaceX)', kind: 'orbiter', parent: 'earth',
    orbitRadii: 1.52, periodDays: 0.0655, inclination: 26.5, color: 0xd8dde2,
    info: {
      'Height': '~121 m full stack — largest rocket ever flown',
      'First integrated flight': 'Apr 20, 2023, from Starbase, Texas',
      'Booster': 'Super Heavy — 33 Raptor engines',
      'Skin': 'Stainless steel, dark heat-shield tiles on the belly',
      'Design goal': 'Full and rapid reusability',
    },
    fact: 'Twice the thrust of the Saturn V — and in 2024 its Super Heavy booster flew home and was caught in mid-air by the launch tower\'s "chopstick" arms.',
  },
  {
    id: 'danuri', name: 'Danuri (KPLO)', type: 'Lunar orbiter (KARI)', kind: 'orbiter', parent: 'moon',
    orbitRadii: 1.85, periodDays: 0.082, inclination: 90, color: 0xb8e0c8,
    info: {
      'Launched': 'Aug 4, 2022', 'Orbit': 'Polar, ~100 km above the Moon',
      'Agency': 'KARI - South Korea\'s first deep-space mission',
      'Instrument': 'ShadowCam peers into permanently dark craters',
    },
    fact: 'South Korea\'s first voyage beyond Earth orbit. Its ShadowCam sees into the Moon\'s permanently shadowed craters by starlight and earthshine alone.',
  },
  {
    id: 'lro', name: 'LRO', type: 'Lunar orbiter', kind: 'orbiter', parent: 'moon',
    orbitRadii: 1.6, periodDays: 0.0786, inclination: 86, color: 0xc8c8d8,
    info: {
      'Launched': 'June 18, 2009', 'Orbit': 'Polar, ~50 km above the Moon',
      'Maps': 'Sharpest global lunar maps ever made',
      'Spotted': 'Every Apollo landing site, flags and footprints',
    },
    fact: 'Photographed the Apollo landing sites clearly enough to see the astronauts\' foot trails — still there, half a century later.',
  },
  {
    id: 'tgo', name: 'ExoMars TGO', type: 'Mars orbiter (ESA/Roscosmos)', kind: 'orbiter', parent: 'mars',
    orbitRadii: 1.35, periodDays: 0.083, inclination: 74, color: 0xd8c8f0,
    info: {
      'Launched': 'Mar 14, 2016', 'Orbit': 'Circular, ~400 km',
      'Mission': 'Sniffs the atmosphere for trace gases like methane',
      'Bonus job': 'Relays most rover data back to Earth',
    },
    fact: 'The solar system\'s methane detective - and the data courier that carries Perseverance\'s and Curiosity\'s discoveries home.',
  },
  {
    id: 'marsexpress', name: 'Mars Express', type: 'Mars orbiter (ESA)', kind: 'orbiter', parent: 'mars',
    orbitRadii: 2.4, periodDays: 0.31, inclination: 86, color: 0xa8d8ff,
    info: {
      'Launched': 'Jun 2, 2003', 'Orbit': 'Elliptical polar, 298 x 10,107 km',
      'Agency': 'ESA - its first planetary mission', 'Status': 'Still operating after 20+ years',
    },
    fact: 'Europe\'s first trip to another planet found buried water ice and a hidden lake under Mars\'s south pole - and it is still working two decades on.',
  },
  {
    id: 'mro', name: 'MRO', type: 'Mars orbiter', kind: 'orbiter', parent: 'mars',
    orbitRadii: 1.55, periodDays: 0.0786, inclination: 93, color: 0xffc8a8,
    info: {
      'Launched': 'Aug 12, 2005', 'Orbit': 'Sun-synchronous polar, 255 × 320 km',
      'Camera': 'HiRISE — reads Mars at 30 cm/pixel', 'Data returned': 'More than all other deep-space missions combined',
    },
    fact: 'Its HiRISE camera is so sharp it has photographed rovers, landers, crashed probes — and avalanches in the act of falling.',
  },
  {
    id: 'perseverance', name: 'Perseverance', type: 'Mars rover', kind: 'surface',
    parent: 'mars', lat: 18.4, lon: 77.7, color: 0xe8f0f8,
    info: {
      'Landed': 'Feb 18, 2021 — Jezero Crater', 'Mission': 'Caching samples for return to Earth',
      'Sidekick': 'Ingenuity, the first Mars helicopter', 'Power': 'Nuclear (MMRTG)',
    },
    fact: 'Carries 43 sample tubes and brought a helicopter to another planet. Its microphones recorded the first sounds ever heard from Mars.',
  },
  {
    id: 'curiosity', name: 'Curiosity', type: 'Mars rover', kind: 'surface',
    parent: 'mars', lat: -5.4, lon: 137.8, color: 0xd8d0c0,
    info: {
      'Landed': 'Aug 6, 2012 — Gale Crater', 'Landing': 'Sky-crane rocket hover',
      'Distance driven': '> 30 km', 'Status': 'Still climbing Mount Sharp',
    },
    fact: 'Sings "Happy Birthday" to itself every August 6th by vibrating its sample-analysis unit — alone, on another planet.',
  },
  {
    id: 'starbase', name: 'Starbase', type: 'Launch site', kind: 'surface',
    parent: 'earth', lat: 25.997, lon: -97.155, color: 0xffb347,
    info: {
      'Location': 'Boca Chica, Texas — 25.997° N, 97.155° W',
      'Role': 'Starship build, test and launch site',
      'First flight': 'Starhopper\'s 150 m hop, Aug 27, 2019',
      'First orbital attempt': 'Starship IFT-1, Apr 20, 2023',
      'Milestone': 'First Super Heavy caught by the tower arms, Oct 13, 2024',
    },
    fact: 'Its launch tower\'s "chopstick" arms catch returning Super Heavy boosters out of mid-air — a falling 20-story building, plucked from the sky.',
  },
  {
    id: 'lc39a', name: 'Kennedy LC-39A', type: 'Launch site', kind: 'surface',
    parent: 'earth', lat: 28.608, lon: -80.604, color: 0xffb347,
    info: {
      'Location': 'Kennedy Space Center, Florida — 28.608° N, 80.604° W',
      'Heritage': 'Apollo 11 left for the Moon from here, Jul 16, 1969',
      'SpaceX era': 'Leased 2014; first Falcon 9 flight Feb 19, 2017 (CRS-10)',
      'Firsts': 'Falcon Heavy debut Feb 6, 2018; Crew Dragon Demo-2 May 30, 2020',
    },
    fact: 'The pad that sent Apollo 11 to the Moon now flies Falcon crews — Demo-2 in 2020 was the first astronaut launch from US soil since the Shuttle retired.',
  },
  {
    id: 'slc4e', name: 'Vandenberg SLC-4E', type: 'Launch site', kind: 'surface',
    parent: 'earth', lat: 34.632, lon: -120.611, color: 0xffb347,
    info: {
      'Location': 'Vandenberg SFB, California — 34.632° N, 120.611° W',
      'Specialty': 'Polar and sun-synchronous orbits, launched south over the Pacific',
      'Heritage': 'Former Titan pad, rebuilt by SpaceX after a 2011 lease',
      'First SpaceX launch': 'Falcon 9 v1.1 with CASSIOPE, Sep 29, 2013',
    },
    fact: 'Florida can\'t launch south without overflying land, so polar-orbit Falcons fly from this Pacific-coast pad — landing back at the old Titan pad next door.',
  },
  {
    id: 'jwst', name: 'JWST', type: 'Space telescope', kind: 'lagrange', factor: 1.06,
    color: 0xffd27a,
    info: {
      'Launched': 'Dec 25, 2021', 'Location': 'Sun–Earth L2, 1.5 million km out',
      'Mirror': '6.5 m, gold-coated beryllium', 'Operating temp': '−233 °C',
    },
    fact: 'Parked at L2 where Earth shields it from the Sun, it sees infrared light from the first galaxies ever formed.',
  },
  {
    id: 'clipper', name: 'Europa Clipper', type: 'Jupiter-bound (in transit)', kind: 'helio',
    color: 0x9fd8e8,
    elements: { a: 3.1, e: 0.68, i: 3.0, Om: 0, varpi: 60.0, L0: 82.5, period: 1994 },
    info: {
      'Launched': 'Oct 14, 2024 (Falcon Heavy)', 'Arrives at Jupiter': 'April 2030',
      'Status': 'Cruising — Earth gravity assist Dec 2026',
      'Size': 'Largest NASA planetary spacecraft ever',
      'Mission': '~50 flybys of Europa\'s hidden ocean',
    },
    fact: 'Carries a plate engraved with the word "water" in 103 languages, sailing toward an ocean moon that may harbor life.',
  },
  {
    id: 'gaia', name: 'Gaia', type: 'Astrometry observatory', kind: 'lagrange', factor: 1.045,
    color: 0xc8b8ff,
    info: {
      'Launched': 'Dec 19, 2013', 'Location': 'Sun–Earth L2',
      'Mission': 'Mapped 1.8 billion stars in 3D', 'Precision': 'Could spot a coin on the Moon',
    },
    fact: 'Built the largest, most precise 3D map of our galaxy ever made — charting the positions and motions of nearly two billion stars.',
  },
  {
    id: 'soho', name: 'SOHO', type: 'Solar observatory', kind: 'lagrange', factor: 0.94,
    color: 0xffe08a,
    info: {
      'Launched': 'Dec 2, 1995', 'Location': 'Sun–Earth L1, 1.5 million km sunward',
      'Mission': 'Staring at the Sun nonstop for 30 years', 'Bonus': 'Greatest comet hunter ever: 5,000+ found',
    },
    fact: 'Meant to last two years, it has watched the Sun for three decades — and accidentally became history\'s greatest comet discoverer.',
  },
  {
    id: 'roadster', name: 'Tesla Roadster', type: 'Electric car (yes, really)', kind: 'helio',
    color: 0xff3b30,
    elements: { a: 1.325, e: 0.256, i: 1.08, Om: 317.3, varpi: 53.7, L0: 75.0, period: 557 },
    info: {
      'Launched': 'Feb 6, 2018 (Falcon Heavy demo)', 'Driver': 'Starman, in a SpaceX suit',
      'Orbit': 'Heliocentric, crosses Mars\'s orbit', 'Odometer': '> 4 billion km',
      'Soundtrack': '"Space Oddity", on loop',
    },
    fact: 'Elon Musk\'s personal Roadster became the first production car in deep space, with "DON\'T PANIC!" on the dashboard screen.',
  },
  {
    id: 'parker', name: 'Parker Solar Probe', type: 'Solar probe', kind: 'helio',
    color: 0xffa64d,
    elements: { a: 0.388, e: 0.88, i: 3.4, Om: 0, varpi: 0, L0: 120, period: 88.4 },
    info: {
      'Launched': 'Aug 12, 2018', 'Closest approach': '6.1 million km from the Sun',
      'Top speed': '192 km/s — fastest human object ever', 'Heat shield': 'Faces 1,400 °C',
      'Orbital period': '88 days',
    },
    fact: 'In 2021 it became the first spacecraft to fly through the Sun\'s corona — it has officially "touched the Sun".',
  },
  {
    id: 'newhorizons', name: 'New Horizons', type: 'Deep space probe', kind: 'deep',
    color: 0xffe9a8, distanceAU: 62, speedAUyr: 2.95, raDeg: 289, decDeg: -20.5,
    info: {
      'Launched': 'Jan 19, 2006', 'Distance': '~62 AU',
      'Pluto flyby': 'July 14, 2015', 'Arrokoth flyby': 'Jan 1, 2019',
      'Speed': '13.8 km/s',
    },
    fact: 'Gave humanity its first close look at Pluto\'s heart-shaped glacier, then flew past Arrokoth — the most distant world ever explored.',
  },
  {
    id: 'cassini', name: 'Cassini (memorial)', type: 'Saturn orbiter, 2004–2017', kind: 'orbiter',
    parent: 'saturn', orbitRadii: 2.9, periodDays: 16, inclination: 62, color: 0xd8c9a8,
    info: {
      'Launched': 'Oct 15, 1997', 'At Saturn': '2004 – 2017 (294 orbits)',
      'Grand Finale': 'Burned up in Saturn, Sept 15, 2017',
      'Legacy': 'Discovered Enceladus\'s geysers, landed Huygens on Titan',
    },
    fact: 'Deliberately plunged into Saturn so it could never contaminate Enceladus\'s ocean — sending science until its final breath. This marker honors where it flew.',
  },
  {
    id: 'gps', name: 'GPS constellation', type: 'Navigation satellites', kind: 'constellation',
    count: 31, orbitRadii: 2.7, periodDays: 0.4988, inclination: 55, color: 0xa8ffc8,
    info: {
      'Satellites': '31 active', 'Altitude': '20,200 km', 'Orbital period': '11 h 58 min',
      'Inclination': '55°', 'Operator': 'US Space Force',
    },
    fact: 'GPS clocks run 38 microseconds fast per day from relativity — uncorrected, your map position would drift 10 km every day.',
  },
  {
    id: 'geo', name: 'Geostationary ring', type: 'Communications satellites', kind: 'constellation',
    count: 28, orbitRadii: 3.5, periodDays: 0.9973, inclination: 0.5, color: 0xffd0a0,
    info: {
      'Altitude': '35,786 km', 'Orbital period': '23 h 56 min — one sidereal day',
      'Result': 'Each satellite hangs over one fixed spot on the equator',
      'Idea credited to': 'Arthur C. Clarke, 1945',
    },
    fact: 'Orbiting exactly as fast as Earth turns, these satellites appear nailed to the sky — which is why TV dishes never have to move.',
  },
  {
    id: 'pioneer10', name: 'Pioneer 10', type: 'Deep space probe', kind: 'deep',
    color: 0xc8b8ff, distanceAU: 137, speedAUyr: 2.52, raDeg: 75, decDeg: 26,
    info: {
      'Launched': 'Mar 2, 1972', 'Distance': '~137 AU',
      'Firsts': 'First through the asteroid belt, first past Jupiter',
      'Last contact': 'Jan 23, 2003', 'Plaque': 'Carries a map to Earth',
    },
    fact: 'Carries a gold plaque showing a man, a woman, and directions to Earth — humanity\'s first message bottled into interstellar space.',
  },
  {
    id: 'pioneer11', name: 'Pioneer 11', type: 'Deep space probe', kind: 'deep',
    color: 0xc8b8ff, distanceAU: 117, speedAUyr: 2.37, raDeg: 282, decDeg: -8,
    info: {
      'Launched': 'Apr 5, 1973', 'Distance': '~117 AU',
      'First': 'First spacecraft to fly past Saturn (1979)',
      'Last contact': 'Nov 24, 1995', 'Plaque': 'Same map to Earth as Pioneer 10',
    },
    fact: 'Its 1979 Saturn flyby scouted the path that Voyager 2 would follow — and it discovered Saturn\'s F ring on the way through.',
  },
  {
    id: 'voyager1', name: 'Voyager 1', type: 'Interstellar probe', kind: 'deep',
    color: 0x9fe8ff, distanceAU: 167, speedAUyr: 3.58, raDeg: 262, decDeg: 12,
    info: {
      'Launched': 'Sep 5, 1977', 'Distance': '~167 AU (25 billion km)',
      'Speed': '17 km/s', 'Status': 'Interstellar space since 2012',
      'Signal travel time': '~23 hours one-way',
    },
    fact: 'The farthest human-made object ever. It carries the Golden Record — sounds and images of Earth for anyone who finds it.',
  },
  {
    id: 'voyager2', name: 'Voyager 2', type: 'Interstellar probe', kind: 'deep',
    color: 0x9fe8ff, distanceAU: 139, speedAUyr: 3.16, raDeg: 303, decDeg: -59,
    info: {
      'Launched': 'Aug 20, 1977', 'Distance': '~139 AU (21 billion km)',
      'Speed': '15 km/s', 'Status': 'Interstellar space since 2018',
      'Claim': 'Only spacecraft to visit all four giant planets',
    },
    fact: 'Grand-toured Jupiter, Saturn, Uranus and Neptune on a planetary alignment that occurs once every 175 years.',
  },
  {
    id: 'starlink', name: 'Starlink', type: 'Satellite constellation', kind: 'constellation',
    src: 'textures/starlink-shells.json', color: 0x7fb8ff,
    info: {
      'Operator': 'SpaceX',
      'Satellites': '10,545 tracked (constellation snapshot 2026-06-10)',
      'Shells': '43°, 53° (densest band), 70°, and 97° polar',
      'Altitude': '~460–570 km for the main shells',
      'Purpose': 'Global broadband internet',
    },
    fact: 'The largest satellite constellation in history — more than half of all active satellites orbiting Earth are Starlinks.',
  },
];
