# SpaceX Feature Track Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the SpaceX celebration features for the SPCX IPO (Nasdaq open 2026-06-12 13:30 UTC) — countdown badge, T-0 celebration, SPCX easter egg — then the Starman live panel and the SpaceX History Tour.

**Architecture:** All features ride existing systems: the sim-time clock (`sim.days`, epoch `J2000`), the HUD header, the navigator search, the live-stats panel, and the tour engine. No new modules; surgical extensions to `index.html`, `js/ui.js`, `js/tour.js`, `js/main.js`, `css/style.css`. Every task adds checks to the single E2E suite.

**Tech Stack:** Vanilla ES modules + three.js (CDN), puppeteer-core E2E suite (`npm test`), no build step.

**Worktree:** `~/Projects/spaceXplorer-spacex`, branch `feature/spacex` (off `develop`). Other agents work on `develop`/`main` — never touch those checkouts.

**Key facts (verified 2026-06-11):** SPCX priced at $135/share on Jun 11 2026; first trade Nasdaq Jun 12 2026 9:30 ET = **13:30 UTC**. Sim time: `simMs = J2000 + sim.days * 86400000`, `J2000 = Date.UTC(2000,0,1,12)` (exported by `js/data.js`).

---

## Phase 1 — IPO Day pack (deadline: tonight)

### Task 1: IPO countdown badge

**Files:**
- Modify: `index.html` (header, ~line 44)
- Modify: `js/ui.js` (`setupTimeControls`, ~line 288 `updateDate`)
- Modify: `css/style.css` (after `#hud-header p` block, ~line 72; mobile block ~line 516)
- Test: `tests/run-tests.mjs` (after the Halley 1986 date-jump checks, ~line 823)

- [ ] **Step 1: Add badge markup to the header**

```html
  <header id="hud-header">
    <h1>SPACE<span>XPLORER</span></h1>
    <p>Interactive Solar System — drag to orbit · scroll to zoom · click anything</p>
    <div id="ipo-countdown">
      <span id="ipo-label"></span>
      <span id="ipo-clock"></span>
    </div>
  </header>
```

- [ ] **Step 2: Drive it from sim time in `updateDate()`**

Replace the `return { updateDate() {...} }` block in `setupTimeControls` with:

```js
  // SPCX IPO: Nasdaq market open, June 12 2026, 9:30 ET (13:30 UTC).
  // Runs on sim time like everything else — time-travel moves the clock.
  const IPO_MS = Date.UTC(2026, 5, 12, 13, 30);
  const ipoBadge = document.getElementById('ipo-countdown');
  const ipoLabel = document.getElementById('ipo-label');
  const ipoClock = document.getElementById('ipo-clock');
  const pad2 = (n) => String(n).padStart(2, '0');

  return {
    updateDate() {
      const simMs = J2000 + sim.days * 86400000;
      const d = new Date(simMs);
      dateLabel.textContent = d.toISOString().slice(0, 10) + '  ' + d.toISOString().slice(11, 16) + ' UTC';

      const delta = IPO_MS - simMs;
      const s = Math.abs(delta) / 1000;
      const days = Math.floor(s / 86400);
      const clock = `${days > 0 ? days.toLocaleString('en-US') + 'd ' : ''}`
        + `${pad2(Math.floor((s % 86400) / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(Math.floor(s % 60))}`;
      const live = delta <= 0;
      ipoLabel.textContent = live ? 'SPCX ★ TRADING ON NASDAQ' : 'SPCX IPO · NASDAQ';
      ipoClock.textContent = (live ? 'T+' : 'T−') + clock;
      ipoBadge.classList.toggle('live', live);
    },
  };
```

- [ ] **Step 3: Style it (mission-control badge, amber when live)**

After the `#hud-header p` rule:

```css
#ipo-countdown {
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
  margin-top: 10px;
  padding: 4px 14px;
  border: 1px solid var(--panel-edge);
  border-radius: 4px;
  background: var(--panel);
  font-size: 11px;
  letter-spacing: 0.14em;
}

#ipo-countdown #ipo-label { color: var(--ink-dim); text-transform: uppercase; }

#ipo-countdown #ipo-clock {
  font-family: var(--font-display);
  font-size: 12px;
  color: var(--cyan);
  font-variant-numeric: tabular-nums;
}

#ipo-countdown.live { border-color: var(--amber-dim); }
#ipo-countdown.live #ipo-label { color: var(--amber); }
#ipo-countdown.live #ipo-clock { color: var(--amber); text-shadow: 0 0 14px rgba(255, 179, 71, 0.5); }
```

In the `@media (max-width: 720px)` block, after `#hud-header p { display: none; }`:

```css
  #ipo-countdown { margin-top: 7px; padding: 3px 10px; font-size: 9px; }
  #ipo-countdown #ipo-clock { font-size: 10px; }
```

- [ ] **Step 4: Add E2E checks** (after the `date label reflects the jump` check)

```js
  // SPCX IPO badge: counts down before Nasdaq open (2026-06-12 13:30 UTC),
  // flips to T+ trading mode after, driven by sim time
  const ipo = await page.evaluate(async () => {
    const sx = window.__sx;
    const J2000 = Date.UTC(2000, 0, 1, 12);
    const read = () => ({
      label: document.getElementById('ipo-label').textContent,
      clock: document.getElementById('ipo-clock').textContent,
      live: document.getElementById('ipo-countdown').classList.contains('live'),
    });
    sx.sim.days = (Date.UTC(2026, 5, 12, 13, 0) - J2000) / 86400000; // T−30 min
    await sx.frame();
    const before = read();
    sx.sim.days = (Date.UTC(2026, 5, 12, 14, 0) - J2000) / 86400000; // T+30 min
    await sx.frame();
    const after = read();
    document.getElementById('btn-now').click();
    await sx.frame();
    return { before, after };
  });
  check(`IPO badge counts down pre-open (${ipo.before.clock})`,
    !ipo.before.live && ipo.before.clock === 'T−00:30:00'
    && ipo.before.label === 'SPCX IPO · NASDAQ');
  check(`IPO badge flips to trading post-open (${ipo.after.clock})`,
    ipo.after.live && ipo.after.clock === 'T+00:30:00'
    && ipo.after.label.includes('TRADING ON NASDAQ'));
```

- [ ] **Step 5: Run `npm test` — expect 126 passed, 0 failed**
- [ ] **Step 6: Commit** — `git commit -m "SPCX IPO countdown badge: T− to Nasdaq open, T+ trading after"`

### Task 2: T-0 celebration moment

**Files:**
- Modify: `js/ui.js` (`setupTimeControls` — needs `sound` param; `updateDate`)
- Modify: `js/main.js:264` (`setupTimeControls(sim)` → `setupTimeControls(sim, sound)`)
- Modify: `css/style.css` (celebrate keyframes)
- Test: `tests/run-tests.mjs`

- [ ] **Step 1: Detect the T-0 crossing in `updateDate()`** — change signature to `setupTimeControls(sim, sound)`; add before `return`:

```js
  let prevDelta = null;
  let celebrated = false;
```

and inside `updateDate()` after `ipoBadge.classList.toggle('live', live)`:

```js
      // one-time flourish when sim time crosses T-0 while you're watching
      if (prevDelta !== null && prevDelta > 0 && delta <= 0 && !celebrated) {
        celebrated = true;
        ipoBadge.classList.add('celebrate');
        sound?.select();
        setTimeout(() => ipoBadge.classList.remove('celebrate'), 6000);
      }
      prevDelta = delta;
```

(Loading the page already post-IPO must NOT celebrate: `prevDelta` starts null.)

- [ ] **Step 2: Update the `main.js` call** — `const timeUI = setupTimeControls(sim, sound);`

- [ ] **Step 3: Celebrate animation in CSS**

```css
#ipo-countdown.celebrate { animation: spcx-pulse 1.2s ease-in-out 5; }

@keyframes spcx-pulse {
  0%, 100% { box-shadow: none; transform: scale(1); }
  50% { box-shadow: 0 0 26px rgba(255, 179, 71, 0.65); transform: scale(1.06); }
}
```

- [ ] **Step 4: E2E check** — scrub from T−5s across T-0, expect `.celebrate` present; reload-free second crossing must not re-add it:

```js
  const cel = await page.evaluate(async () => {
    const sx = window.__sx;
    const J2000 = Date.UTC(2000, 0, 1, 12);
    sx.sim.days = (Date.UTC(2026, 5, 12, 13, 29, 55) - J2000) / 86400000;
    await sx.frame();
    sx.sim.days = (Date.UTC(2026, 5, 12, 13, 30, 5) - J2000) / 86400000;
    await sx.frame();
    const fired = document.getElementById('ipo-countdown').classList.contains('celebrate');
    // cross again — must stay one-shot
    sx.sim.days = (Date.UTC(2026, 5, 12, 13, 29, 55) - J2000) / 86400000;
    await sx.frame();
    document.getElementById('ipo-countdown').classList.remove('celebrate');
    sx.sim.days = (Date.UTC(2026, 5, 12, 13, 30, 5) - J2000) / 86400000;
    await sx.frame();
    const refired = document.getElementById('ipo-countdown').classList.contains('celebrate');
    document.getElementById('btn-now').click();
    await sx.frame();
    return { fired, refired };
  });
  check('T-0 crossing fires one-time celebration', cel.fired && !cel.refired);
```

- [ ] **Step 5: Run `npm test` — expect 127 passed** · **Step 6: Commit** — `"T-0 celebration: badge pulse + chime when sim time crosses the SPCX open"`

### Task 3: SPCX ticker easter egg

**Files:**
- Modify: `js/ui.js` (`buildNavigator` search input handler, ~line 54)
- Test: `tests/run-tests.mjs`

- [ ] **Step 1: Alias `spcx` → Roadster in the search filter**

```js
  // ticker easter egg: SPCX finds the only SpaceX hardware on a permanent solar orbit
  const ALIASES = { spcx: 'tesla roadster' };
  search.addEventListener('input', () => {
    const raw = search.value.trim().toLowerCase();
    const q = ALIASES[raw] ?? raw;
    ...existing filter body unchanged, using q...
  });
```

(Enter already selects the first visible match — no further wiring needed.)

- [ ] **Step 2: E2E check**

```js
  const egg = await page.evaluate(async () => {
    const search = document.getElementById('nav-search');
    search.value = 'SPCX';
    search.dispatchEvent(new Event('input'));
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await window.__sx.frame();
    const sel = window.__sx.selected()?.data.id;
    search.value = '';
    search.dispatchEvent(new Event('input'));
    return sel;
  });
  check('SPCX ticker easter egg selects the Roadster', egg === 'roadster');
```

(`window.__sx.selected()` is the suite's selection accessor — see the existing search tests around line 687.)

- [ ] **Step 3: Run `npm test` — expect 128 passed** · **Step 4: Commit** — `"SPCX ticker easter egg: search the ticker, find Starman"`

### Task 4: IPO-day share link (verification only)

`?focus=roadster&date=2026-06-12` already works via existing deep-link machinery (covered by `?focus+?date deep link` tests). 

- [ ] **Step 1:** Manually load `http://127.0.0.1:8643/?focus=roadster&date=2026-06-12` headless, screenshot, confirm Roadster focused + badge near T-0. No code unless it's broken.

---

## Phase 2 — Starman panel & History Tour

### Task 5: "Where is Starman?" live panel

**Files:**
- Modify: `js/ui.js` (live rows template ~line 110, `updateLiveStats` ~line 325)
- Modify: `js/main.js:334` (pass mars + sim)
- Test: `tests/run-tests.mjs`

- [ ] **Step 1: Two more generic hidden rows in the live template** (`showInfo`, line 110)

```js
    <div class="info-row" id="live-extra2-row" style="display:none"><span class="info-key" id="live-extra2-key"></span><span class="info-val" id="live-extra2"></span></div>
    <div class="info-row" id="live-extra3-row" style="display:none"><span class="info-key" id="live-extra3-key"></span><span class="info-val" id="live-extra3"></span></div>
```

- [ ] **Step 2: Roadster branch in `updateLiveStats`** — signature becomes `updateLiveStats(body, earth, mars, sim)`; `main.js` call: `updateLiveStats(selected, bodies.get('earth'), bodies.get('mars'), sim)`. After the moon-phase branch:

```js
  const extra2 = document.getElementById('live-extra2-row');
  const extra3 = document.getElementById('live-extra3-row');
  if (body.data.id === 'roadster' && mars) {
    // heliocentric speed from vis-viva (a = 1.325 AU from its elements)
    const rAU = _ra.length();
    const k = 0.01720209895; // Gaussian gravitational constant, AU^1.5/day
    const vKms = k * Math.sqrt(Math.max(0, 2 / rAU - 1 / 1.325)) * 149597870.7 / 86400;
    document.getElementById('live-extra-key').textContent = 'Speed (now)';
    document.getElementById('live-extra').textContent = `${(vKms * 3600).toLocaleString('en-US', { maximumFractionDigits: 0 })} km/h`;
    extraRow.style.display = '';
    // distance from Mars, whose orbit it crosses
    realAU(mars.anchor.position, _rc);
    const dMars = _ra.distanceTo(_rc);
    document.getElementById('live-extra2-key').textContent = 'Distance from Mars (now)';
    document.getElementById('live-extra2').textContent = `${dMars.toFixed(2)} AU`;
    extra2.style.display = '';
    // odometer estimate: mean orbital speed × time since FH demo launch
    const simMs = J2000 + sim.days * 86400000;
    const days = Math.max(0, (simMs - Date.UTC(2018, 1, 6, 20, 45)) / 86400000);
    const odoKm = days * (2 * Math.PI * 1.325 * 149597870.7 / 557);
    const warranties = odoKm / 1.609344 / 36000;
    document.getElementById('live-extra3-key').textContent = 'Warranty exceeded (est.)';
    document.getElementById('live-extra3').textContent = `${Math.floor(warranties).toLocaleString('en-US')}× the 36,000-mile warranty`;
    extra3.style.display = '';
  } else {
    if (extra2) extra2.style.display = 'none';
    if (extra3) extra3.style.display = 'none';
  }
```

Add `const _rc = new THREE.Vector3();` next to `_ra`/`_rb`.

- [ ] **Step 3: E2E check** — select roadster, expect speed in a plausible band (60,000–140,000 km/h), Mars distance finite, warranty count > 40 at 2026 dates.
- [ ] **Step 4: `npm test` green** · **Step 5: Commit** — `"Where is Starman: live speed, Mars distance, warranty counter for the Roadster"`

### Task 6: SpaceX History Tour

**Files:**
- Modify: `js/tour.js` (object stops + date jumps + second tour)
- Modify: `js/main.js` (pass `sim` to `createTour`)
- Modify: `index.html` (button `btn-spacex-tour` next to `btn-tour`)
- Modify: `css/style.css` (reuse `#btn-tour` styles via shared selector)
- Test: `tests/run-tests.mjs`

- [ ] **Step 1: Generalize stops to `{id, title?, date?}`** — string entries stay valid (`norm = (s) => typeof s === 'string' ? { id: s } : s`). When a stop has `date` (ms UTC), `show()` sets `sim.days = (stop.date - J2000) / 86400000` before `select()`, and the banner name shows `stop.title ?? body.data.name`.

- [ ] **Step 2: The history stops (all dates verified, UTC)**

```js
const SPACEX_STOPS = [
  { id: 'earth', title: 'Falcon 1 reaches orbit', date: Date.UTC(2008, 8, 28, 23, 15) },
  { id: 'earth', title: 'First booster landing', date: Date.UTC(2015, 11, 22, 1, 29) },
  { id: 'roadster', title: 'Starman leaves Earth', date: Date.UTC(2018, 1, 6, 20, 45) },
  { id: 'starlink', title: 'First Starlink batch', date: Date.UTC(2019, 4, 24, 2, 30) },
  { id: 'iss', title: 'Demo-2: crew returns to US soil', date: Date.UTC(2020, 4, 30, 19, 22) },
  { id: 'earth', title: 'Starship first integrated flight', date: Date.UTC(2023, 3, 20, 13, 33) },
  { id: 'roadster', title: 'SPCX rings the Nasdaq bell', date: Date.UTC(2026, 5, 12, 13, 30) },
];
```

(`starlink` and `iss` confirmed as the craft ids in `data.js`, lines 711 and 456.)

- [ ] **Step 3: Second start button + engine support** — `tour.startHistory()` runs the same machinery over `SPACEX_STOPS`; `#btn-spacex-tour` labeled `🚀 SpaceX Story`; exiting the tour leaves sim time where it is (user has NOW).
- [ ] **Step 4: E2E checks** — start history tour → date label `2008-09-28`, banner `Falcon 1 reaches orbit`; `tour-next` ×2 → roadster selected, date `2018-02-06`; exit restores nothing (time stays), `btn-now` cleanup.
- [ ] **Step 5: `npm test` green** · **Step 6: Commit** — `"SpaceX History Tour: seven time-traveling stops from Falcon 1 to the IPO"`

---

## Phase 3+ — future separate plans (one per subsystem)

In rough priority order; each gets its own plan doc when reached:
1. **Dragon + Starship PBR miniatures** (`spacecraft.js`, must meet the visual quality bar)
2. **Launch site markers** on the night-lights Earth (Starbase, Cape, Vandenberg)
3. **Real Starlink TLEs** (CelesTrak snapshot baked to JSON; no runtime API)
4. **Mars transfer window visualizer** (animated Starship fleet on the transfer arc)
5. **Falcon 9 launch spectacle** (surface-scale animation — biggest, riskiest, last)

## Execution strategy

- **Phase 1 inline, sequentially, today** — tasks overlap in `ui.js`/`index.html`/tests, and the deadline is tomorrow 13:30 UTC. Push to `feature/spacex`; merging to `main` happens only when Jeff says release.
- **Phase 2 via subagents, one at a time** (subagent-driven) — Tasks 5 and 6 touch disjoint modules but share `tests/run-tests.mjs` and `main.js`, so parallel dispatch in one worktree would conflict. Parallelism becomes worthwhile in Phase 3 (separate worktrees per subsystem, lead merges).
- Every task: `npm test` fully green before commit; screenshot-verify visual changes (headless Chrome, no `--disable-gpu`).
- Periodically rebase `feature/spacex` on `develop` to stay current with the generic-improvement agents.
