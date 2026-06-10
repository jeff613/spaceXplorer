// ─── Scaling ──────────────────────────────────────────────────────────────
// True solar-system scale is unusable on screen (Neptune would be 6 km from
// a 1 m Sun), so distances are compressed with a power law and radii with a
// gentler one. All physics (periods, eccentricity, inclination) stays real.

export const DIST_EXP = 0.55;
export const DIST_MUL = 62;

export function scaleDistance(au) {
  return Math.pow(au, DIST_EXP) * DIST_MUL;
}

export function scaleRadius(km) {
  const earthR = km / 6371;
  return Math.max(0.55, Math.pow(earthR, 0.45) * 1.7);
}

export const SUN_DISPLAY_RADIUS = 11;

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
    id: 'mercury', name: 'Mercury', type: 'Planet', texture: 'mercurymap.jpg',
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
    id: 'venus', name: 'Venus', type: 'Planet', texture: 'venusmap.jpg', atmosphere: 0xe8cf9a,
    radiusKm: 6051.8,
    elements: { a: 0.723, e: 0.0068, i: 3.39, Om: 76.68, varpi: 131.53, L0: 181.98, period: 224.7 },
    rotationHours: -5832.5, tilt: 177.4,
    info: {
      'Radius': '6,052 km', 'Mass': '4.87 × 10²⁴ kg', 'Orbital period': '225 days',
      'Day length': '243 Earth days (retrograde)', 'Distance from Sun': '0.72 AU',
      'Surface temp': '464 °C', 'Moons': '0',
    },
    fact: 'Venus spins backwards and so slowly that its day is longer than its year. Its CO₂ atmosphere makes it hotter than Mercury.',
  },
  {
    id: 'earth', name: 'Earth', type: 'Planet', texture: 'earthmap1k.jpg', clouds: 'earthcloudmap.jpg',
    nightLights: 'earthlights.jpg', atmosphere: 0x5fa8ff,
    radiusKm: 6371,
    elements: { a: 1.0, e: 0.0167, i: 0.0, Om: 0.0, varpi: 102.94, L0: 100.46, period: 365.25 },
    rotationHours: 23.93, tilt: 23.44,
    info: {
      'Radius': '6,371 km', 'Mass': '5.97 × 10²⁴ kg', 'Orbital period': '365.25 days',
      'Day length': '23.93 hours', 'Distance from Sun': '1.00 AU',
      'Surface temp': '−88 to 58 °C', 'Moons': '1',
    },
    fact: 'The only known world with liquid surface water and life. Roughly 8,000 active satellites orbit it — most of them Starlink.',
  },
  {
    id: 'mars', name: 'Mars', type: 'Planet', texture: 'marsmap1k.jpg', atmosphere: 0xd89a72,
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
    id: 'jupiter', name: 'Jupiter', type: 'Planet', texture: 'jupitermap.jpg',
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
    id: 'saturn', name: 'Saturn', type: 'Planet', texture: 'saturnmap.jpg', ring: 'saturnringcolor.jpg',
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
    id: 'uranus', name: 'Uranus', type: 'Planet', texture: 'uranusmap.jpg', ringProc: 'uranus',
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
    id: 'neptune', name: 'Neptune', type: 'Planet', texture: 'neptunemap.jpg', ringProc: 'neptune',
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
    id: 'vesta', name: 'Vesta', type: 'Asteroid', color: 0xb5a285,
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
    id: 'pluto', name: 'Pluto', type: 'Dwarf planet', texture: 'plutomap1k.jpg',
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
    id: 'haumea', name: 'Haumea', type: 'Dwarf planet', color: 0xd8d8e0,
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
  id: 'sun', name: 'Sun', type: 'G-type star', texture: 'sunmap.jpg',
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
    id: 'moon', name: 'Moon', type: 'Moon of Earth', parent: 'earth', texture: 'moonmap1k.jpg',
    ecliptic: true,
    radiusKm: 1737.4, orbitRadii: 3.2, period: 27.32,
    info: {
      'Radius': '1,737 km', 'Orbital period': '27.3 days',
      'Distance from Earth': '384,400 km', 'Surface temp': '−173 to 127 °C',
    },
    fact: 'The Moon drifts 3.8 cm farther from Earth every year. Twelve humans have walked on it — so far.',
  },
  {
    id: 'phobos', name: 'Phobos', type: 'Moon of Mars', parent: 'mars', color: 0x8d8276,
    radiusKm: 11.3, orbitRadii: 1.8, period: 0.319,
    info: { 'Radius': '11 km', 'Orbital period': '7.7 hours', 'Fate': 'Crashing into Mars in ~50 Myr' },
    fact: 'Orbits Mars faster than Mars rotates — it rises in the west, sets in the east, and is slowly spiraling inward to its doom.',
  },
  {
    id: 'deimos', name: 'Deimos', type: 'Moon of Mars', parent: 'mars', color: 0x9d9388,
    radiusKm: 6.2, orbitRadii: 2.8, period: 1.263,
    info: { 'Radius': '6 km', 'Orbital period': '30.3 hours', 'Shape': 'Lumpy captured asteroid' },
    fact: 'So small that from its surface you could reach escape velocity on a bicycle.',
  },
  {
    id: 'io', name: 'Io', type: 'Moon of Jupiter', parent: 'jupiter', color: 0xd8c95a,
    radiusKm: 1821.6, orbitRadii: 2.0, period: 1.77,
    info: { 'Radius': '1,822 km', 'Orbital period': '1.8 days', 'Volcanoes': '400+ active' },
    fact: 'The most volcanically active body in the solar system, kneaded by Jupiter\'s tides like a stress ball.',
  },
  {
    id: 'europa', name: 'Europa', type: 'Moon of Jupiter', parent: 'jupiter', color: 0xcfc4ae,
    radiusKm: 1560.8, orbitRadii: 2.7, period: 3.55,
    info: { 'Radius': '1,561 km', 'Orbital period': '3.6 days', 'Ocean depth': '~100 km under ice' },
    fact: 'Beneath its cracked ice shell lies a salty ocean with twice the water of all Earth\'s oceans — a prime candidate for life.',
  },
  {
    id: 'ganymede', name: 'Ganymede', type: 'Moon of Jupiter', parent: 'jupiter', color: 0x9b8d7d,
    radiusKm: 2634.1, orbitRadii: 3.5, period: 7.15,
    info: { 'Radius': '2,634 km', 'Orbital period': '7.2 days', 'Claim': 'Largest moon in the solar system' },
    fact: 'Bigger than the planet Mercury, and the only moon known to generate its own magnetic field.',
  },
  {
    id: 'callisto', name: 'Callisto', type: 'Moon of Jupiter', parent: 'jupiter', color: 0x6f6a60,
    radiusKm: 2410.3, orbitRadii: 4.4, period: 16.69,
    info: { 'Radius': '2,410 km', 'Orbital period': '16.7 days', 'Surface': 'Most cratered in the system' },
    fact: 'Its ancient surface has barely changed in 4 billion years — a fossil record of the early solar system.',
  },
  {
    id: 'titan', name: 'Titan', type: 'Moon of Saturn', parent: 'saturn', color: 0xc9a24b,
    radiusKm: 2574.7, orbitRadii: 3.6, period: 15.95,
    info: { 'Radius': '2,575 km', 'Orbital period': '16 days', 'Atmosphere': 'Denser than Earth\'s' },
    fact: 'The only moon with a thick atmosphere, and the only world besides Earth with rivers, lakes and rain — of liquid methane.',
  },
  {
    id: 'enceladus', name: 'Enceladus', type: 'Moon of Saturn', parent: 'saturn', color: 0xeef4f8,
    radiusKm: 252.1, orbitRadii: 2.5, period: 1.37,
    info: { 'Radius': '252 km', 'Orbital period': '1.4 days', 'Albedo': 'Most reflective body in the system' },
    fact: 'Ice geysers at its south pole jet ocean water into space, feeding Saturn\'s E ring — a free sample of an alien sea.',
  },
  {
    id: 'rhea', name: 'Rhea', type: 'Moon of Saturn', parent: 'saturn', color: 0xb0aca6,
    radiusKm: 763.8, orbitRadii: 2.95, period: 4.52,
    info: { 'Radius': '764 km', 'Orbital period': '4.5 days', 'Composition': 'Mostly water ice' },
    fact: 'Saturn\'s second-largest moon — a dirty snowball three-quarters ice, possibly with its own faint ring system.',
  },
  {
    id: 'iapetus', name: 'Iapetus', type: 'Moon of Saturn', parent: 'saturn', color: 0x7a6f5e,
    radiusKm: 734.5, orbitRadii: 5.0, period: 79.3,
    info: { 'Radius': '735 km', 'Orbital period': '79 days', 'Feature': '20 km equatorial ridge' },
    fact: 'The yin-yang moon: one hemisphere is coal-black, the other snow-white, with a mysterious mountain ridge wrapping its equator.',
  },
  {
    id: 'miranda', name: 'Miranda', type: 'Moon of Uranus', parent: 'uranus', color: 0xa8b0b8,
    radiusKm: 235.8, orbitRadii: 2.2, period: 1.41,
    info: { 'Radius': '236 km', 'Orbital period': '1.4 days', 'Feature': 'Verona Rupes, 20 km cliff' },
    fact: 'A patchwork world that looks reassembled from spare parts. Its Verona Rupes cliff is the tallest known — a 20 km sheer drop.',
  },
  {
    id: 'titania', name: 'Titania', type: 'Moon of Uranus', parent: 'uranus', color: 0x9aa0a8,
    radiusKm: 788.4, orbitRadii: 3.0, period: 8.71,
    info: { 'Radius': '788 km', 'Orbital period': '8.7 days', 'Claim': 'Largest moon of Uranus' },
    fact: 'Like all of Uranus\'s moons it is named from Shakespeare — and orbits sideways along with its rolled-over planet.',
  },
  {
    id: 'oberon', name: 'Oberon', type: 'Moon of Uranus', parent: 'uranus', color: 0x8e949c,
    radiusKm: 761.4, orbitRadii: 3.8, period: 13.46,
    info: { 'Radius': '761 km', 'Orbital period': '13.5 days', 'Surface': 'Ancient, heavily cratered' },
    fact: 'The outermost large moon of Uranus, scarred by craters with mysterious dark floors.',
  },
  {
    id: 'triton', name: 'Triton', type: 'Moon of Neptune', parent: 'neptune', color: 0xb8c4c9,
    radiusKm: 1353.4, orbitRadii: 3.0, period: -5.88,
    info: { 'Radius': '1,353 km', 'Orbital period': '5.9 days (retrograde)', 'Origin': 'Captured Kuiper Belt object' },
    fact: 'Orbits backwards — a captured Kuiper Belt world. Nitrogen geysers erupt from its −235 °C surface.',
  },
  {
    id: 'charon', name: 'Charon', type: 'Moon of Pluto', parent: 'pluto', color: 0x8d8b90,
    radiusKm: 606, orbitRadii: 2.6, period: 6.39,
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
    id: 'jwst', name: 'JWST', type: 'Space telescope', kind: 'l2',
    color: 0xffd27a,
    info: {
      'Launched': 'Dec 25, 2021', 'Location': 'Sun–Earth L2, 1.5 million km out',
      'Mirror': '6.5 m, gold-coated beryllium', 'Operating temp': '−233 °C',
    },
    fact: 'Parked at L2 where Earth shields it from the Sun, it sees infrared light from the first galaxies ever formed.',
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
    color: 0xffe9a8, distanceAU: 62, raDeg: 289, decDeg: -20.5,
    info: {
      'Launched': 'Jan 19, 2006', 'Distance': '~62 AU',
      'Pluto flyby': 'July 14, 2015', 'Arrokoth flyby': 'Jan 1, 2019',
      'Speed': '13.8 km/s',
    },
    fact: 'Gave humanity its first close look at Pluto\'s heart-shaped glacier, then flew past Arrokoth — the most distant world ever explored.',
  },
  {
    id: 'voyager1', name: 'Voyager 1', type: 'Interstellar probe', kind: 'deep',
    color: 0x9fe8ff, distanceAU: 167, raDeg: 262, decDeg: 12,
    info: {
      'Launched': 'Sep 5, 1977', 'Distance': '~167 AU (25 billion km)',
      'Speed': '17 km/s', 'Status': 'Interstellar space since 2012',
      'Signal travel time': '~23 hours one-way',
    },
    fact: 'The farthest human-made object ever. It carries the Golden Record — sounds and images of Earth for anyone who finds it.',
  },
  {
    id: 'voyager2', name: 'Voyager 2', type: 'Interstellar probe', kind: 'deep',
    color: 0x9fe8ff, distanceAU: 139, raDeg: 303, decDeg: -59,
    info: {
      'Launched': 'Aug 20, 1977', 'Distance': '~139 AU (21 billion km)',
      'Speed': '15 km/s', 'Status': 'Interstellar space since 2018',
      'Claim': 'Only spacecraft to visit all four giant planets',
    },
    fact: 'Grand-toured Jupiter, Saturn, Uranus and Neptune on a planetary alignment that occurs once every 175 years.',
  },
  {
    id: 'starlink', name: 'Starlink', type: 'Satellite constellation', kind: 'constellation',
    count: 700, orbitRadii: 1.55, periodDays: 0.0661, inclination: 53, color: 0x7fb8ff,
    info: {
      'Operator': 'SpaceX', 'Active satellites': '~7,000+', 'Altitude': '~550 km',
      'Inclination': '53°', 'Purpose': 'Global broadband internet',
    },
    fact: 'The largest satellite constellation in history — more than half of all active satellites orbiting Earth are Starlinks.',
  },
];
