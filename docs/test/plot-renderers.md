# Plot renderer comparison

This branch starts from `v1.9` at `7d516b9`. It adapts the current
`src/PlotRenderer.js` from `/home/jason/workspace/paul-cgview-js` (reference HEAD
`ff1551c`) without importing its unrelated viewer/interaction changes.
The original `_drawPath` implementation remains unchanged for comparisons.

## Try the renderers

Open the [test page](index.html), select a map containing plots, and use **Plot
renderer** to switch between **Original** and **Contour (new)**. The **Plot
outline** checkbox enables or disables the contour's 0.65-pixel edge. The
existing Performance Testing panel times the selected configuration.

**Experimental testing setting:** `settings.plotRenderer` is not a stable API.
It may change or be removed at any time without notice. It is retained for
testing and renderer comparisons; applications should use the default renderer
without depending on this selector. Its current inclusion in saved JSON does
not guarantee that future versions will honor it.

```js
// Experimental testing switch; may change or be removed without notice.
cgv.settings.update({plotRenderer: 'legacy'});
cgv.settings.update({plotRenderer: 'contour', showPlotOutline: true});
cgv.settings.update({plotRenderer: 'contour', showPlotOutline: false});
```

The default is `contour` with the outline enabled,
including when loading old JSON. Bar plots always use the original stepped
geometry. Disabling the outline retains the contour renderer's averaging and
fill. Both settings are saved in JSON.

The new renderer averages genomic intervals in genome-anchored bins sized for
the screen. It connects those averages, splits colored regions at interpolated
baseline crossings, and adds a contrasting contour during full draws. Fast
draws use coarser bins without a contour. Narrow peaks can be averaged away at
low zoom; this changes the displayed profile without modifying stored scores.

## Reproduce the browser comparison

Use Node 20 or newer, as required by the repository's existing Playwright
dependency. No new npm packages are needed. Build before each comparison:

```sh
yarn gh-pages
yarn benchmark:plots --iterations 20 --warmups 5
yarn benchmark:plots --iterations 20 --warmups 5 --reverse --output .benchmark-results/plots-reverse.json
```

Chromium must already be installed. On this sandbox, browser launches may need
command sandbox escalation. The runner loads local assets; it does not require
a web server or publish benchmark data.

The runner compares three variants in the same bundle and viewer:

- `legacy`: the original renderer.
- `contour`: the new renderer with outline.
- `contour-no-outline`: the new renderer without outline.

Each synthetic map has one million bases and 128, 10,000, 100,000, or 1,000,000
score entries, using a deterministic signal with positive and negative values.
The real Lentzea fixture includes its existing features and sequence-generated
GC plots. All maps run in circular and linear formats, at zoom factors 1, 10,
and 1000, in a 600 by 600 CSS-pixel viewer at device pixel ratio 1. Higher zoom
levels center around the genome origin, exercising wrapped circular ranges.

Sequence extraction and initial layout finish before measurement. Every
recorded round runs all three variants, rotating their order; `--reverse`
reverses the initial order for a second run. Warm-ups follow the same procedure.
Setting changes and their redraws finish outside the timed measurements.

The report contains these metrics:

- `drawFast`: synchronous time for the complete viewer's fast redraw.
- `drawFull`: elapsed time until the complete viewer's progressive full redraw
  finishes, including its timer scheduling delays and initial fast preview.
- `plotsFast` and `plotsFull`: synchronous time spent drawing only visible plot
  slots. Canvas clearing happens before these timers start.

Raw samples, medians, p90s, browser/Node versions, Git status, and the bundle's
SHA-256 are saved under `.benchmark-results/`. A Markdown median comparison is
saved beside the JSON. Ratios above 1 mean the contour renderer took longer.

These are drawing-work and completion-latency measurements, not GPU completion
times or interaction frame rates. Full-draw timer overhead can hide differences
in plot drawing, so inspect the plot-only measurements too. Avoid concurrent
benchmark runs and repeat before drawing conclusions from small differences.
The outline has no fast-mode work; differences between the two contour variants
in fast timings indicate measurement noise or indirect runtime effects.

Sparse and very dense data can behave differently: contour drawing reduces
geometry for dense data but still scans its visible score intervals, whereas
the original fast renderer skips entries. This experiment does not claim a
performance improvement in advance.
