// Grand Tour: guided autoplay through the solar system's highlights.
// Each stop flies the camera to the body (via the shared select()) and
// dwells, then advances. Any manual selection or Esc exits the tour.
// Stops may carry a date (ms UTC) — the SpaceX Story uses this to
// time-travel the sim to each milestone.

import { J2000 } from './data.js';

const STOPS = [
  'sun', 'mercury', 'venus', 'earth', 'iss', 'moon', 'mars', 'perseverance',
  'jupiter', 'io', 'europa', 'saturn', 'titan', 'uranus', 'neptune', 'triton',
  'pluto', 'halley', 'bennu', 'roadster', 'voyager1',
];

// SpaceX history, Falcon 1 to the IPO — every date a real milestone (UTC)
const SPACEX_STOPS = [
  { id: 'earth', title: 'Falcon 1 reaches orbit', date: Date.UTC(2008, 8, 28, 23, 15) },
  { id: 'earth', title: 'First booster landing', date: Date.UTC(2015, 11, 22, 1, 29) },
  { id: 'roadster', title: 'Starman leaves Earth', date: Date.UTC(2018, 1, 6, 20, 45) },
  { id: 'starlink', title: 'First Starlink batch', date: Date.UTC(2019, 4, 24, 2, 30) },
  { id: 'iss', title: 'Demo-2: crew flies from US soil again', date: Date.UTC(2020, 4, 30, 19, 22) },
  { id: 'earth', title: 'Starship first integrated flight', date: Date.UTC(2023, 3, 20, 13, 33) },
  { id: 'roadster', title: 'SPCX rings the Nasdaq bell', date: Date.UTC(2026, 5, 12, 13, 30) },
];

const DWELL_MS = 9000;

export function createTour(bodies, craft, select, sim) {
  const banner = document.getElementById('tour-banner');
  const nameEl = document.getElementById('tour-name');
  const stepEl = document.getElementById('tour-step');

  let stops = STOPS;
  let idx = -1;
  let timer = null;
  let active = false;

  const get = (id) => bodies.get(id) || craft.get(id);
  const norm = (s) => (typeof s === 'string' ? { id: s } : s);

  function show(i) {
    idx = (i + stops.length) % stops.length;
    const stop = norm(stops[idx]);
    if (stop.date !== undefined) sim.days = (stop.date - J2000) / 86400000;
    const body = get(stop.id);
    select(body);
    nameEl.textContent = stop.title ?? body.data.name;
    stepEl.textContent = `${idx + 1} / ${stops.length}`;
    clearTimeout(timer);
    timer = setTimeout(() => { if (active) show(idx + 1); }, DWELL_MS);
  }

  function begin(list, btnId) {
    tour.stop();
    stops = list;
    active = true;
    banner.classList.add('open');
    document.getElementById(btnId).classList.add('on');
    show(0);
  }

  const tour = {
    get active() { return active; },
    start() { begin(STOPS, 'btn-tour'); },
    startHistory() { begin(SPACEX_STOPS, 'btn-spacex-tour'); },
    stop() {
      if (!active) return;
      active = false;
      clearTimeout(timer);
      banner.classList.remove('open');
      document.getElementById('btn-tour').classList.remove('on');
      document.getElementById('btn-spacex-tour').classList.remove('on');
    },
    next() { if (active) show(idx + 1); },
    prev() { if (active) show(idx - 1); },
  };

  document.getElementById('btn-tour').addEventListener('click', () => {
    if (active && stops === STOPS) tour.stop(); else tour.start();
  });
  document.getElementById('btn-spacex-tour').addEventListener('click', () => {
    if (active && stops === SPACEX_STOPS) tour.stop(); else tour.startHistory();
  });
  document.getElementById('tour-next').addEventListener('click', tour.next);
  document.getElementById('tour-prev').addEventListener('click', tour.prev);
  document.getElementById('tour-exit').addEventListener('click', tour.stop);

  return tour;
}
