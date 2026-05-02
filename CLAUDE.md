# Wave Spectrum Calculator

Static webpage deployed at **www.adriankosasih.com/wave-calculator** (GitHub: `adriankosasih/wave-calculator`).

## File structure

Three files, no build step — open `index.html` directly in a browser.

- `index.html` — layout skeleton, CDN links (Chart.js 4.4, KaTeX 0.16)
- `style.css` — CSS custom properties for dark/light theme, responsive grid
- `app.js` — all logic: spectrum registry, dynamic UI, Chart.js plot, CSV export

## Spectrum registry pattern

Each spectrum in the `SPECTRA` object in `app.js` is a plain object. Adding a new spectrum means adding one entry — everything else (UI, chart, CSV, references section) picks it up automatically.

```js
'key': {
  label,                              // shown in dropdown and chart legend
  params[],                           // {id, label, default, min, step, validate}
  compute(omega, params) → S[],       // omega in rad/s, returns S(ω) in m²·s
  periodIndicators(params) → {T0, T1, T2},  // periods in seconds
  reference: { citation, formula },   // formula is a KaTeX string (display math)
}
```

## Spectra implemented

| Key | Name | Inputs | Notes |
|---|---|---|---|
| `modified-pm` | Modified Pearson-Moskowitz | H₁/₃, T₁ | ITTC, fully-developed seas |
| `jonswap` | JONSWAP (γ = 3.3) | H₁/₃, T₁ | ITTC, fetch-limited seas; γ fixed — the 0.191 and 5.24/T₁ constants embed ω_p for γ=3.3 |

Both reference Faltinsen, O.M., 1999. *Sea loads on ships and offshore structures*. Cambridge University Press.

## Period indicator colours

T₀ amber `#f59e0b` · T₁ emerald `#34d399` · T₂ pink `#f472b6`

## Planned work

- Add more wave spectra (e.g. Bretschneider, ISSC)

## Key implementation notes

- X-axis mode (`omega` / `freq` / `period`) stored in `xAxisMode` state variable; `renderChart` reads it on every draw
- Period vertical lines drawn via an inline Chart.js plugin defined as a closure inside `renderChart`
- KaTeX formula strings: keep each equation on its own `aligned` line to avoid horizontal scroll in reference cards
- Theme persisted to `localStorage` key `wave-calc-theme`
