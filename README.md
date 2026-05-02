# Wave Spectrum Calculator

A static web application for generating, visualising, and exporting ocean wave energy spectra. Runs entirely in the browser — no server or build step required.

**[Live demo →](https://www.adriankosasih.com/wave-calculator)**

---

## Features

- **Two standard ITTC spectra** — Modified Pierson-Moskowitz and JONSWAP (γ = 3.3)
- **Interactive plot** with switchable x-axis: angular frequency ω (rad/s), frequency f (Hz), or period T (s)
- **Period indicators** — vertical lines and a summary table for T₀ (peak), T₁ (mean), and T₂ (zero up-crossing) wave periods
- **CSV export** of the computed spectrum
- **Dark / light theme** with preference stored in localStorage
- Fully client-side — works offline after first load

## Spectra

### Modified Pierson-Moskowitz
Two-parameter ITTC spectrum for fully-developed, open-ocean sea states.

**Inputs:** significant wave height H₁/₃ (m), mean wave period T₁ (s)

**Period relations:** T₁ = 1.086 T₂, T₀ = 1.408 T₂

### JONSWAP (γ = 3.3)
Two-parameter ITTC spectrum for fetch-limited (developing) sea states, e.g. the North Sea.

**Inputs:** significant wave height H₁/₃ (m), mean wave period T₁ (s)

**Period relations:** T₁ = 0.834 T₀ = 1.073 T₂

## Reference

Faltinsen, O.M., 1999. *Sea loads on ships and offshore structures*, 1st paperback ed. Cambridge ocean technology series. Cambridge University Press, Cambridge.

## Usage

Open `index.html` directly in any modern browser, or serve the folder with any static file server:

```bash
npx serve .
# → http://localhost:3000
```

No dependencies to install. Chart.js and KaTeX are loaded from CDN.

## Tech stack

| Concern | Library |
|---|---|
| Plotting | [Chart.js 4.4](https://www.chartjs.org/) |
| Formula rendering | [KaTeX 0.16](https://katex.org/) |
| Styling | Plain CSS with custom properties |
