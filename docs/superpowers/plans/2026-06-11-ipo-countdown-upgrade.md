# IPO Countdown Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the small monospace IPO badge with a two-line amber-glowing banner: punchline "Explore Space While Waiting for SPCX" on top, segmented D/H/M/S cells below pre-IPO, and a live Finnhub price display post-IPO.

**Architecture:** All changes are confined to `index.html` (DOM structure), `css/style.css` (visual styles), and `js/ui.js` (countdown + price-polling logic). No new files. The Finnhub REST quote API is polled every 15 s client-side once T-0 is crossed; a hardcoded free API key is used. The E2E Puppeteer test suite is updated to match the new DOM IDs and text.

**Tech Stack:** Vanilla JS, CSS animations, Finnhub REST API (`/api/v1/quote`), Puppeteer E2E tests.

---

### Task 1: Update HTML structure

**Files:**
- Modify: `index.html:51-54`

The current two-span structure becomes a two-line banner. Keep `id="ipo-countdown"` on the wrapper (tests reference it). Remove `id="ipo-clock"` (replaced by individual cell spans). Keep `id="ipo-label"` but move it inside the punchline line.

- [ ] **Replace lines 51-54 in `index.html`**

Old:
```html
    <div id="ipo-countdown">
      <span id="ipo-label"></span>
      <span id="ipo-clock"></span>
    </div>
```

New:
```html
    <div id="ipo-countdown">
      <div id="ipo-punchline"><span>🚀</span><span id="ipo-label">Explore Space While Waiting for SPCX</span></div>
      <div id="ipo-cells">
        <div class="ipo-cell"><span class="ipo-cv" id="ipo-days">00</span><span class="ipo-cl">Days</span></div>
        <div class="ipo-cell"><span class="ipo-cv" id="ipo-hrs">00</span><span class="ipo-cl">Hrs</span></div>
        <div class="ipo-cell"><span class="ipo-cv" id="ipo-min">00</span><span class="ipo-cl">Min</span></div>
        <div class="ipo-cell"><span class="ipo-cv" id="ipo-sec">00</span><span class="ipo-cl">Sec</span></div>
      </div>
      <div id="ipo-price" style="display:none">
        <span id="ipo-price-val">—</span>
        <span id="ipo-price-change"></span>
        <span class="ipo-price-meta">Nasdaq · Real-time</span>
      </div>
    </div>
```

- [ ] **Open `http://localhost:8080` (or `npm start`) and confirm the header renders without errors** — the badge will look broken before CSS/JS are updated; that's expected.

---

### Task 2: Replace CSS styles

**Files:**
- Modify: `css/style.css:74-105` (the `#ipo-countdown` block)
- Modify: `css/style.css:591-592` (mobile override)

- [ ] **Replace lines 74-105 in `css/style.css`**

Old (lines 74-105):
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

#ipo-countdown.celebrate { animation: spcx-pulse 1.2s ease-in-out 5; }

@keyframes spcx-pulse {
  0%, 100% { box-shadow: none; transform: scale(1); }
  50% { box-shadow: 0 0 26px rgba(255, 179, 71, 0.65); transform: scale(1.06); }
}
```

New:
```css
#ipo-countdown {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 10px 22px;
  border: 1px solid var(--amber-dim);
  border-radius: 6px;
  background: var(--panel);
  animation: spcx-breathe 3s ease-in-out infinite;
}

@keyframes spcx-breathe {
  0%, 100% { box-shadow: 0 0 14px rgba(255, 179, 71, 0.10); }
  50%       { box-shadow: 0 0 30px rgba(255, 179, 71, 0.30); }
}

#ipo-punchline {
  display: flex;
  align-items: center;
  gap: 7px;
  font-family: var(--font-display);
  font-size: 11px;
  letter-spacing: 0.18em;
  color: var(--amber);
  text-shadow: 0 0 10px rgba(255, 179, 71, 0.4);
  text-transform: uppercase;
}

#ipo-cells { display: flex; gap: 6px; }

.ipo-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(2, 5, 10, 0.8);
  border: 1px solid var(--amber-dim);
  border-radius: 3px;
  padding: 4px 12px;
  min-width: 50px;
}

.ipo-cv {
  font-family: var(--font-display);
  font-size: 20px;
  color: var(--amber);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.ipo-cl {
  font-size: 7px;
  letter-spacing: 0.16em;
  color: var(--ink-dim);
  text-transform: uppercase;
  margin-top: 2px;
}

#ipo-price {
  align-items: baseline;
  gap: 10px;
}

#ipo-price-val {
  font-family: var(--font-display);
  font-size: 26px;
  color: var(--amber);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  text-shadow: 0 0 14px rgba(255, 179, 71, 0.45);
}

#ipo-price-change {
  font-family: var(--font-display);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

#ipo-price-change.up   { color: #4dffb4; }
#ipo-price-change.down { color: #ff6b6b; }

.ipo-price-meta {
  font-size: 8px;
  letter-spacing: 0.16em;
  color: var(--ink-dim);
  text-transform: uppercase;
  align-self: center;
}

#ipo-countdown.live {
  animation: spcx-live-pulse 1.8s ease-in-out infinite;
  border-color: rgba(255, 179, 71, 0.65);
}

@keyframes spcx-live-pulse {
  0%, 100% { box-shadow: 0 0 16px rgba(255, 179, 71, 0.20); }
  50%       { box-shadow: 0 0 40px rgba(255, 179, 71, 0.50); }
}

#ipo-countdown.celebrate { animation: spcx-pulse 1.2s ease-in-out 5; }

@keyframes spcx-pulse {
  0%, 100% { box-shadow: none; transform: scale(1); }
  50% { box-shadow: 0 0 26px rgba(255, 179, 71, 0.65); transform: scale(1.06); }
}
```

Note: `#ipo-price` has no `display` set in CSS — JS controls it with `.style.display` to switch between `'none'` and `'flex'`.

- [ ] **Replace lines 591-592 (mobile override) in `css/style.css`**

Old:
```css
  #ipo-countdown { margin-top: 7px; padding: 3px 10px; font-size: 9px; }
  #ipo-countdown #ipo-clock { font-size: 10px; }
```

New:
```css
  #ipo-countdown { margin-top: 7px; padding: 6px 12px; }
  #ipo-punchline { font-size: 9px; letter-spacing: 0.12em; }
  .ipo-cv { font-size: 14px; }
  .ipo-cell { padding: 3px 8px; min-width: 38px; }
  #ipo-price-val { font-size: 18px; }
```

---

### Task 3: Rewrite JS countdown + price polling

**Files:**
- Modify: `js/ui.js:294-330`

- [ ] **Sign up for a free Finnhub API key at https://finnhub.io** (takes ~2 min, no credit card). Copy the key — you'll paste it into the code as `FINNHUB_KEY`.

- [ ] **Replace lines 294-330 in `js/ui.js`**

Old (lines 294-330):
```js
  // SPCX IPO: Nasdaq market open, June 12 2026, 9:30 ET (13:30 UTC).
  // Runs on wall-clock time — time-travel never moves this clock.
  const IPO_MS = Date.UTC(2026, 5, 12, 13, 30);
  const ipoBadge = document.getElementById('ipo-countdown');
  const ipoLabel = document.getElementById('ipo-label');
  const ipoClock = document.getElementById('ipo-clock');
  const pad2 = (n) => String(n).padStart(2, '0');
  let prevDelta = null;
  let celebrated = false;

  return {
    updateDate() {
      const simMs = J2000 + sim.days * 86400000;
      const d = new Date(simMs);
      dateLabel.textContent = d.toISOString().slice(0, 10) + '  ' + d.toISOString().slice(11, 16) + ' UTC';

      const delta = IPO_MS - Date.now();
      const s = Math.abs(delta) / 1000;
      const days = Math.floor(s / 86400);
      const clock = `${days > 0 ? days.toLocaleString('en-US') + 'd ' : ''}`
        + `${pad2(Math.floor((s % 86400) / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(Math.floor(s % 60))}`;
      const live = delta <= 0;
      ipoLabel.textContent = live ? 'SPCX ★ TRADING ON NASDAQ' : 'SPCX IPO · NASDAQ';
      ipoClock.textContent = (live ? 'T+' : 'T−') + clock;
      ipoBadge.classList.toggle('live', live);

      // one-time flourish when the real clock crosses T-0 while you're watching
      if (prevDelta !== null && prevDelta > 0 && delta <= 0 && !celebrated) {
        celebrated = true;
        ipoBadge.classList.add('celebrate');
        sound?.celebrate();
        setTimeout(() => ipoBadge.classList.remove('celebrate'), 6000);
      }
      prevDelta = delta;
    },
  };
```

New:
```js
  // SPCX IPO: Nasdaq market open, June 12 2026, 9:30 ET (13:30 UTC).
  // Runs on wall-clock time — time-travel never moves this clock.
  const FINNHUB_KEY = 'YOUR_FINNHUB_KEY'; // replace with key from finnhub.io
  const IPO_MS = Date.UTC(2026, 5, 12, 13, 30);
  const ipoBadge    = document.getElementById('ipo-countdown');
  const ipoLabel    = document.getElementById('ipo-label');
  const ipoCells    = document.getElementById('ipo-cells');
  const ipoPrice    = document.getElementById('ipo-price');
  const ipoPriceVal = document.getElementById('ipo-price-val');
  const ipoPriceChg = document.getElementById('ipo-price-change');
  const ipoEls = {
    days: document.getElementById('ipo-days'),
    hrs:  document.getElementById('ipo-hrs'),
    min:  document.getElementById('ipo-min'),
    sec:  document.getElementById('ipo-sec'),
  };
  const pad2 = (n) => String(n).padStart(2, '0');
  let prevDelta = null;
  let celebrated = false;
  let pricePollingStarted = false;

  function startPricePolling() {
    const fetchPrice = async () => {
      try {
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=SPCX&token=${FINNHUB_KEY}`);
        const { c, d, dp } = await r.json();
        if (c) {
          ipoPriceVal.textContent = `$${c.toFixed(2)}`;
          const sign = d >= 0 ? '▲' : '▼';
          ipoPriceChg.textContent = `${sign} ${Math.abs(d).toFixed(2)} (${dp >= 0 ? '+' : ''}${dp.toFixed(2)}%)`;
          ipoPriceChg.className = d >= 0 ? 'up' : 'down';
        }
      } catch { /* keep showing — */ }
    };
    fetchPrice();
    setInterval(fetchPrice, 15000);
  }

  return {
    updateDate() {
      const simMs = J2000 + sim.days * 86400000;
      const d = new Date(simMs);
      dateLabel.textContent = d.toISOString().slice(0, 10) + '  ' + d.toISOString().slice(11, 16) + ' UTC';

      const delta = IPO_MS - Date.now();
      const s = Math.abs(delta) / 1000;
      const live = delta <= 0;

      ipoLabel.textContent = live
        ? '★ SPCX is Live · Trading on Nasdaq'
        : 'Explore Space While Waiting for SPCX';

      if (!live) {
        ipoEls.days.textContent = pad2(Math.floor(s / 86400));
        ipoEls.hrs.textContent  = pad2(Math.floor((s % 86400) / 3600));
        ipoEls.min.textContent  = pad2(Math.floor((s % 3600) / 60));
        ipoEls.sec.textContent  = pad2(Math.floor(s % 60));
      }

      ipoCells.style.display = live ? 'none' : 'flex';
      ipoPrice.style.display = live ? 'flex' : 'none';
      ipoBadge.classList.toggle('live', live);

      if (live && !pricePollingStarted) {
        pricePollingStarted = true;
        startPricePolling();
      }

      // one-time flourish when the real clock crosses T-0 while you're watching
      if (prevDelta !== null && prevDelta > 0 && delta <= 0 && !celebrated) {
        celebrated = true;
        ipoBadge.classList.add('celebrate');
        sound?.celebrate();
        setTimeout(() => ipoBadge.classList.remove('celebrate'), 6000);
      }
      prevDelta = delta;
    },
  };
```

---

### Task 4: Update E2E tests

**Files:**
- Modify: `tests/run-tests.mjs:1014-1037`

The tests stub `Date.now` and read the badge DOM. The `ipo-clock` and `ipo-label` IDs changed — update the `read()` helper and assertions.

- [ ] **Replace the `read` helper and assertions in `tests/run-tests.mjs` (lines 1014-1037)**

Old (lines 1014-1037):
```js
  const ipo = await page.evaluate(async () => {
    const sx = window.__sx;
    const realNow = Date.now;
    const read = () => ({
      label: document.getElementById('ipo-label').textContent,
      clock: document.getElementById('ipo-clock').textContent,
      live: document.getElementById('ipo-countdown').classList.contains('live'),
    });
    Date.now = () => Date.UTC(2026, 5, 12, 13, 0); // T−30 min
    await sx.frame();
    const before = read();
    Date.now = () => Date.UTC(2026, 5, 12, 14, 0); // T+30 min
    await sx.frame();
    const after = read();
    Date.now = realNow;
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

New:
```js
  const ipo = await page.evaluate(async () => {
    const sx = window.__sx;
    const realNow = Date.now;
    const read = () => ({
      label:      document.getElementById('ipo-label').textContent,
      days:       document.getElementById('ipo-days').textContent,
      min:        document.getElementById('ipo-min').textContent,
      cellsShown: document.getElementById('ipo-cells').style.display !== 'none',
      priceShown: document.getElementById('ipo-price').style.display !== 'none',
      live:       document.getElementById('ipo-countdown').classList.contains('live'),
    });
    Date.now = () => Date.UTC(2026, 5, 12, 13, 0); // T−30 min
    await sx.frame();
    const before = read();
    Date.now = () => Date.UTC(2026, 5, 12, 14, 0); // T+30 min
    await sx.frame();
    const after = read();
    Date.now = realNow;
    await sx.frame();
    return { before, after };
  });
  check(`IPO badge counts down pre-open (${ipo.before.days}d ${ipo.before.min}m)`,
    !ipo.before.live && ipo.before.days === '00' && ipo.before.min === '30'
    && ipo.before.label === 'Explore Space While Waiting for SPCX'
    && ipo.before.cellsShown && !ipo.before.priceShown);
  check('IPO badge flips to live post-open',
    ipo.after.live && ipo.after.priceShown && !ipo.after.cellsShown
    && ipo.after.label.includes('SPCX is Live'));
```

---

### Task 5: Run tests and verify

- [ ] **Run the test suite**

```bash
cd /Users/jeff613/Projects/spaceXplorer-spacex && npm test
```

Expected: all existing tests pass including the two updated IPO badge assertions. The celebrate test (lines 1039-1062) is unchanged and should still pass — it only checks `badge.classList.contains('celebrate')`, which the new code still sets.

If any IPO test fails, re-read the DOM IDs in `index.html` and the logic in `js/ui.js` and reconcile.

---

### Task 6: Commit

- [ ] **Commit all changes**

```bash
cd /Users/jeff613/Projects/spaceXplorer-spacex
git add index.html css/style.css js/ui.js tests/run-tests.mjs
git commit -m "feat: upgrade IPO countdown to animated two-line banner with live Finnhub price"
```

> **Note on the Finnhub key:** `FINNHUB_KEY` is left as `'YOUR_FINNHUB_KEY'` until the IPO is live and a real SPCX quote is available. The price display gracefully shows `—` on fetch failure, so the pre-IPO build is fully functional without a key. Swap the placeholder once you have the key from finnhub.io.
