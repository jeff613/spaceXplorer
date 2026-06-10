// Grand Tour: guided autoplay through the solar system's highlights.
// Each stop flies the camera to the body (via the shared select()) and
// dwells, then advances. Any manual selection or Esc exits the tour.

const STOPS = [
  'sun', 'mercury', 'venus', 'earth', 'iss', 'moon', 'mars', 'perseverance',
  'jupiter', 'europa', 'saturn', 'titan', 'uranus', 'neptune', 'pluto',
  'halley', 'apophis', 'roadster', 'voyager1',
];

const DWELL_MS = 9000;

export function createTour(bodies, craft, select) {
  const banner = document.getElementById('tour-banner');
  const nameEl = document.getElementById('tour-name');
  const stepEl = document.getElementById('tour-step');

  let idx = -1;
  let timer = null;
  let active = false;

  const get = (id) => bodies.get(id) || craft.get(id);

  function show(i) {
    idx = (i + STOPS.length) % STOPS.length;
    const body = get(STOPS[idx]);
    select(body);
    nameEl.textContent = body.data.name;
    stepEl.textContent = `${idx + 1} / ${STOPS.length}`;
    clearTimeout(timer);
    timer = setTimeout(() => { if (active) show(idx + 1); }, DWELL_MS);
  }

  const tour = {
    get active() { return active; },
    start() {
      active = true;
      banner.classList.add('open');
      document.getElementById('btn-tour').classList.add('on');
      show(0);
    },
    stop() {
      if (!active) return;
      active = false;
      clearTimeout(timer);
      banner.classList.remove('open');
      document.getElementById('btn-tour').classList.remove('on');
    },
    next() { if (active) show(idx + 1); },
    prev() { if (active) show(idx - 1); },
  };

  document.getElementById('btn-tour').addEventListener('click', () => {
    if (active) tour.stop(); else tour.start();
  });
  document.getElementById('tour-next').addEventListener('click', tour.next);
  document.getElementById('tour-prev').addEventListener('click', tour.prev);
  document.getElementById('tour-exit').addEventListener('click', tour.stop);

  return tour;
}
