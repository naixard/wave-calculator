'use strict';

// ── Spectrum registry ─────────────────────────────────────────────────────────

const FALTINSEN_CITATION = 'Faltinsen, O.M., 1999. <em>Sea loads on ships and offshore structures</em>, 1st paperback ed., repr. transferred to digital printing. Cambridge ocean technology series. Cambridge University Press, Cambridge.';

const SPECTRA = {
  'modified-pm': {
    label: 'Modified Pearson-Moskowitz',
    params: [
      {
        id: 'h13',
        label: 'Significant wave height H₁⁄₃ (m)',
        default: 3.0,
        min: 0.001,
        step: 0.1,
        validate: v => v > 0 ? null : 'H₁/₃ must be positive',
      },
      {
        id: 't1',
        label: 'Mean wave period T₁ (s)',
        default: 10.0,
        min: 0.1,
        step: 0.5,
        validate: v => v > 0 ? null : 'T₁ must be positive',
      },
    ],
    compute(omega, { h13, t1 }) {
      const TWO_PI = 2 * Math.PI;
      return omega.map(w => {
        const x = (w * t1) / TWO_PI;
        if (x <= 0) return 0;
        return h13 * h13 * t1 * (0.11 / TWO_PI) * Math.pow(x, -5) * Math.exp(-0.44 * Math.pow(x, -4));
      });
    },
    // T₁ = 1.086 T₂,  T₀ = 1.408 T₂
    periodIndicators({ t1 }) {
      const T2 = t1 / 1.086;
      const T0 = 1.408 * T2;
      return { T0, T1: t1, T2 };
    },
    reference: {
      citation: FALTINSEN_CITATION,
      formula: String.raw`\frac{S\!\left(\omega\right)}{H_{1/3}^{2}\,T_1} = \frac{0.11}{2\pi}\left(\frac{\omega T_1}{2\pi}\right)^{\!-5}\exp\!\left[-0.44\left(\frac{\omega T_1}{2\pi}\right)^{\!-4}\right]`,
    },
  },

  'jonswap': {
    label: 'JONSWAP (γ = 3.3)',
    params: [
      {
        id: 'h13',
        label: 'Significant wave height H₁⁄₃ (m)',
        default: 3.0,
        min: 0.001,
        step: 0.1,
        validate: v => v > 0 ? null : 'H₁/₃ must be positive',
      },
      {
        id: 't1',
        label: 'Mean wave period T₁ (s)',
        default: 10.0,
        min: 0.1,
        step: 0.5,
        validate: v => v > 0 ? null : 'T₁ must be positive',
      },
    ],
    // γ = 3.3 is fixed: the 0.191 coefficient (= 1/5.24 ≈ 1/ω_p·T₁) and
    // the switch at 5.24/T₁ both embed ω_p for γ=3.3, so the formula is
    // only self-consistent at that value.
    compute(omega, { h13, t1 }) {
      const GAMMA = 3.3;
      const t1_4  = Math.pow(t1, 4);
      return omega.map(w => {
        if (w <= 0) return 0;
        const sigma = w <= 5.24 / t1 ? 0.07 : 0.09;
        const Y_arg = (0.191 * w * t1 - 1) / (Math.SQRT2 * sigma);
        const Y     = Math.exp(-(Y_arg * Y_arg));
        return 155 * h13 * h13 / (t1_4 * Math.pow(w, 5))
               * Math.exp(-944 / (t1_4 * Math.pow(w, 4)))
               * Math.pow(GAMMA, Y);
      });
    },
    // T₁ = 0.834 T₀ = 1.073 T₂  (γ = 3.3)
    periodIndicators({ t1 }) {
      const T0 = t1 / 0.834;
      const T2 = t1 / 1.073;
      return { T0, T1: t1, T2 };
    },
    reference: {
      citation: FALTINSEN_CITATION,
      // sigma on its own aligned line to avoid horizontal scroll
      formula: String.raw`\begin{aligned} S\!\left(\omega\right) &= \frac{155\,H_{1/3}^2}{T_1^4\,\omega^5}\exp\!\left(-\frac{944}{T_1^4\,\omega^4}\right)3.3^{Y} \\[4pt] Y &= \exp\!\left(-\left(\frac{0.191\,\omega T_1-1}{\sqrt{2}\,\sigma}\right)^{\!2}\right) \\[4pt] \sigma &= \begin{cases}0.07 & \omega\le\tfrac{5.24}{T_1}\\[2pt]0.09 & \omega>\tfrac{5.24}{T_1}\end{cases} \end{aligned}`,
    },
  },
};

// ── Period indicator colours ───────────────────────────────────────────────────

const PERIOD_COLORS = {
  T0: '#f59e0b',   // amber  — peak
  T1: '#34d399',   // emerald — mean (matches input)
  T2: '#f472b6',   // pink   — zero up-crossing
};

// ── State ─────────────────────────────────────────────────────────────────────

let chartInstance = null;
let lastResult    = null;
let xAxisMode     = 'omega';

// ── Dynamic parameter UI ──────────────────────────────────────────────────────

function renderParamsUI(key) {
  const container = document.getElementById('spectrum-params');

  // Preserve whatever values are currently shown
  const saved = {};
  container.querySelectorAll('input[id^="param-"]').forEach(el => {
    saved[el.id] = el.value;
  });

  container.innerHTML = '';
  SPECTRA[key].params.forEach(p => {
    const savedVal = saved[`param-${p.id}`];
    const value    = savedVal !== undefined ? savedVal : p.default;
    const group    = document.createElement('div');
    group.className = 'form-group';
    group.innerHTML = `
      <label for="param-${p.id}">${p.label}</label>
      <input type="number" id="param-${p.id}"
             value="${value}" min="${p.min}" step="${p.step}">
    `;
    container.appendChild(group);
  });
}

// ── Read parameter values from DOM ────────────────────────────────────────────

function readParams(key) {
  const params = {};
  for (const p of SPECTRA[key].params) {
    const el  = document.getElementById(`param-${p.id}`);
    const val = parseFloat(el.value);
    if (!isFinite(val)) throw new Error(`Invalid value for "${p.label}"`);
    if (p.validate) {
      const err = p.validate(val);
      if (err) throw new Error(err);
    }
    params[p.id] = val;
  }
  return params;
}

// ── Frequency configuration ───────────────────────────────────────────────────

function buildOmegaArray() {
  const oMin = parseFloat(document.getElementById('freq-min').value);
  const oMax = parseFloat(document.getElementById('freq-max').value);
  const step = parseFloat(document.getElementById('freq-step').value);

  if (!isFinite(oMin) || !isFinite(oMax)) throw new Error('Frequency limits must be valid numbers');
  if (oMin <= 0)                throw new Error('ω_min must be positive');
  if (oMax <= oMin)             throw new Error('ω_max must be greater than ω_min');
  if (!isFinite(step) || step <= 0) throw new Error('Step size must be a positive number');
  if (step >= oMax - oMin)     throw new Error('Step size must be smaller than (ω_max − ω_min)');

  const omega = [];
  for (let w = oMin; w <= oMax + 1e-10; w += step) omega.push(w);
  return omega;
}

function updateFreqCountDisplay() {
  const oMin = parseFloat(document.getElementById('freq-min').value);
  const oMax = parseFloat(document.getElementById('freq-max').value);
  const step = parseFloat(document.getElementById('freq-step').value);
  const el   = document.getElementById('freq-count-display');

  if (isFinite(oMin) && isFinite(oMax) && isFinite(step) && step > 0 && oMax > oMin && step < oMax - oMin) {
    const n = Math.floor((oMax - oMin) / step + 1e-9) + 1;
    el.textContent = `→ ${n} points`;
  } else {
    el.textContent = '';
  }
}

// ── X-axis transform ──────────────────────────────────────────────────────────

const X_AXIS = {
  omega: {
    label:   'ω (rad/s)',
    tip:     x => `ω = ${x.toFixed(4)} rad/s`,
    convert: w => w,
    fmt:     v => v.toFixed(2),
    reverse: false,
    periodToX: T => (2 * Math.PI) / T,
  },
  freq: {
    label:   'f (Hz)',
    tip:     x => `f = ${x.toFixed(4)} Hz`,
    convert: w => w / (2 * Math.PI),
    fmt:     v => v.toFixed(3),
    reverse: false,
    periodToX: T => 1 / T,
  },
  period: {
    label:   'T (s)',
    tip:     x => `T = ${x.toFixed(2)} s`,
    convert: w => (2 * Math.PI) / w,
    fmt:     v => v.toFixed(1),
    reverse: true,
    periodToX: T => T,
  },
};

// ── Chart ─────────────────────────────────────────────────────────────────────

function cssVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

function renderChart(omega, S, label, indicators) {
  const ctx = document.getElementById('spectrum-chart').getContext('2d');
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

  const text    = cssVar('--color-text');
  const muted   = cssVar('--color-text-muted');
  const primary = cssVar('--color-primary');
  const grid    = muted + '44';

  const ax = X_AXIS[xAxisMode];
  let xs = omega.map(ax.convert);
  let ys = [...S];
  if (ax.reverse) { xs = xs.slice().reverse(); ys = ys.slice().reverse(); }

  // Build period indicator lines (sorted by xVal for staggered labels)
  const lines = indicators ? [
    { T: indicators.T0, symbol: 'T₀', color: PERIOD_COLORS.T0 },
    { T: indicators.T1, symbol: 'T₁', color: PERIOD_COLORS.T1 },
    { T: indicators.T2, symbol: 'T₂', color: PERIOD_COLORS.T2 },
  ]
    .map(l => ({ ...l, xVal: ax.periodToX(l.T) }))
    .sort((a, b) => a.xVal - b.xVal)   // left-to-right order for staggered y
  : [];

  // Inline plugin — drawn via closure over `lines`
  const periodLinesPlugin = {
    id: 'periodLines',
    afterDraw(chart) {
      if (!lines.length) return;
      const { ctx: c, scales: { x, y }, chartArea: ca } = chart;
      lines.forEach(({ xVal, color, symbol }, i) => {
        const px = x.getPixelForValue(xVal);
        if (px < ca.left || px > ca.right) return;
        c.save();
        c.beginPath();
        c.moveTo(px, ca.top);
        c.lineTo(px, ca.bottom);
        c.strokeStyle = color;
        c.lineWidth = 1.5;
        c.setLineDash([5, 4]);
        c.stroke();
        c.setLineDash([]);
        c.font = 'bold 10px -apple-system, BlinkMacSystemFont, sans-serif';
        c.fillStyle = color;
        c.textAlign = 'center';
        c.fillText(symbol, px, ca.top + 12 + i * 13);
        c.restore();
      });
    },
  };

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label: `${label} — S(ω)`,
        data: xs.map((x, i) => ({ x, y: ys[i] })),
        borderColor: primary,
        backgroundColor: primary + '22',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: text, font: { size: 13 }, boxWidth: 18 } },
        tooltip: {
          callbacks: {
            title: items => ax.tip(items[0].raw.x),
            label: item  => `S(ω) = ${item.raw.y.toExponential(4)} m²·s`,
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: ax.label, color: text, font: { size: 13, weight: '500' } },
          ticks: { color: muted, maxTicksLimit: 12, callback: ax.fmt },
          grid: { color: grid },
        },
        y: {
          title: { display: true, text: 'S(ω) (m²·s)', color: text, font: { size: 13, weight: '500' } },
          ticks: { color: muted, callback: v => v.toExponential(1) },
          grid: { color: grid },
        },
      },
    },
    plugins: [periodLinesPlugin],
  });
}

// ── Period indicator table ────────────────────────────────────────────────────

function updatePeriodTable(indicators) {
  const el = document.getElementById('period-table');
  if (!indicators) { el.hidden = true; return; }

  const { T0, T1, T2 } = indicators;
  const cards = [
    { symbol: 'T₀', name: 'Peak wave period',           T: T0, color: PERIOD_COLORS.T0 },
    { symbol: 'T₁', name: 'Mean wave period',            T: T1, color: PERIOD_COLORS.T1 },
    { symbol: 'T₂', name: 'Zero up-crossing period',     T: T2, color: PERIOD_COLORS.T2 },
  ];

  el.innerHTML = cards.map(({ symbol, name, T, color }) => {
    const omega = (2 * Math.PI) / T;
    const freq  = 1 / T;
    return `
      <div class="period-card" style="border-left-color:${color}">
        <div class="period-card-symbol" style="color:${color}">${symbol}</div>
        <div class="period-card-name">${name}</div>
        <div class="period-card-value">${T.toFixed(3)} s</div>
        <div class="period-card-sub">${omega.toFixed(4)} rad/s &nbsp;&middot;&nbsp; ${freq.toFixed(4)} Hz</div>
      </div>
    `;
  }).join('');

  el.hidden = false;
}

// ── References ────────────────────────────────────────────────────────────────

function renderReferences() {
  const container = document.getElementById('references-list');
  Object.values(SPECTRA).forEach(spec => {
    const card = document.createElement('div');
    card.className = 'reference-card';
    card.innerHTML = `
      <h3>${spec.label}</h3>
      <div class="formula">\\[${spec.reference.formula}\\]</div>
      <p class="citation">${spec.reference.citation}</p>
    `;
    container.appendChild(card);
  });

  if (typeof renderMathInElement === 'function') {
    renderMathInElement(container, {
      delimiters: [
        { left: '\\[', right: '\\]', display: true  },
        { left: '\\(', right: '\\)', display: false },
      ],
      throwOnError: false,
    });
  }
}

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCSV() {
  if (!lastResult) return;
  const { omega, S, key } = lastResult;
  const rows = ['omega_rad_s,S_omega_m2s'];
  for (let i = 0; i < omega.length; i++) {
    rows.push(`${omega[i].toFixed(6)},${S[i].toExponential(6)}`);
  }
  const blob = new Blob([rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `wave_spectrum_${key}_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Error display ─────────────────────────────────────────────────────────────

function showError(msg) {
  const el = document.getElementById('error-msg');
  if (msg) { el.textContent = msg; el.hidden = false; }
  else      { el.hidden = true; }
}

// ── Theme ─────────────────────────────────────────────────────────────────────

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  document.getElementById('theme-toggle').textContent =
    theme === 'dark' ? '☀ Light' : '☽ Dark';
}

function initTheme() {
  applyTheme(localStorage.getItem('wave-calc-theme') ?? 'dark');
}

// ── Populate spectrum dropdown ────────────────────────────────────────────────

function populateSpectrumSelect() {
  const sel = document.getElementById('spectrum-type');
  Object.entries(SPECTRA).forEach(([key, spec]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = spec.label;
    sel.appendChild(opt);
  });
}

// ── Helpers for re-render ─────────────────────────────────────────────────────

function rerender() {
  if (!lastResult) return;
  renderChart(lastResult.omega, lastResult.S, SPECTRA[lastResult.key].label, lastResult.indicators);
}

// ── Event wiring ──────────────────────────────────────────────────────────────

document.getElementById('spectrum-type').addEventListener('change', e => {
  renderParamsUI(e.target.value);
  showError(null);
});

['freq-step', 'freq-min', 'freq-max'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateFreqCountDisplay);
});

document.getElementById('btn-generate').addEventListener('click', () => {
  try {
    const key    = document.getElementById('spectrum-type').value;
    const spec   = SPECTRA[key];
    const params = readParams(key);
    const omega  = buildOmegaArray();
    const S      = spec.compute(omega, params);

    if (S.some(v => !isFinite(v))) {
      throw new Error('Computed spectrum contains invalid values. Check parameter ranges.');
    }

    const indicators = spec.periodIndicators(params);
    lastResult = { omega, S, key, indicators };

    renderChart(omega, S, spec.label, indicators);
    updatePeriodTable(indicators);

    document.getElementById('chart-container').hidden = false;
    document.getElementById('chart-controls').hidden  = false;
    document.getElementById('chart-placeholder').hidden = true;
    document.getElementById('btn-export').disabled = false;
    showError(null);
  } catch (e) {
    showError(e.message);
  }
});

document.getElementById('btn-export').addEventListener('click', exportCSV);

document.getElementById('theme-toggle').addEventListener('click', () => {
  const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem('wave-calc-theme', next);
  rerender();
});

document.querySelectorAll('input[name="x-axis-mode"]').forEach(radio => {
  radio.addEventListener('change', e => {
    xAxisMode = e.target.value;
    rerender();
  });
});

// ── Initialise ────────────────────────────────────────────────────────────────

initTheme();
populateSpectrumSelect();
renderParamsUI(document.getElementById('spectrum-type').value);
updateFreqCountDisplay();
renderReferences();
