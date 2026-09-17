# Rendering performance: Stage 1

This milestone measures the existing Canvas renderer on `v1.9-gpu`. It preserves the public API, JSON format, painter order, and export behavior. Renderer abstraction, WebGPU, WebGL2, and level-of-detail implementation remain later milestones, subject to review of these measurements.

The source audit is in [rendering-pipeline.md](rendering-pipeline.md). The benchmark consists of the [CLI runner](../../scripts/benchmark-rendering.mjs), [deterministic dataset and browser harness](../test/rendering-benchmark.js), and [development profiler](../test/rendering-profile.js). The helpers are loaded by the benchmark and are not imported into production bundles.

## Implementation plan

1. Trace drawing, visible-range lookup, geometry, Canvas submission, labels, plots, and hit testing through the current source. Identify existing caches before proposing more caches.
2. Add deterministic synthetic datasets and separate uninstrumented measurements from diagnostic profiling. Retain raw samples, visible counts, dataset fingerprints, environment details, Git state, and bundle hashes.
3. Establish the Canvas baseline across feature counts, layouts, zoom levels, and decorations. Add bounded sparse-label, plot, and shading cases to expose costs omitted by the default geometry workload.
4. Choose only a small optimization supported by the audit and measurements. Compare the same datasets and built bundles before and after, preserving rendering semantics and checking relevant pixels and behavior. An unmeasured hypothesis is not grounds for replacing an algorithm.
5. Run existing tests and browser checks, record results and limitations, then stop for Stage 1 review. Stage 2 begins only after the dominant costs and correctness constraints are understood.

## Current architecture

The principal path is `Viewer.draw` to `Layout`, then visible `Slot` instances, `Feature.draw` or `Plot.draw`, and finally `Canvas.drawElement` and the layout-specific path methods. Six stacked Canvas layers separate map data, foreground, UI, and other work. Tracks own slot membership; slots maintain NCList indexes; labels have their own queries and placement logic.

Fast drawing is synchronous and samples feature callbacks using a power-of-two step. Sampling still traverses matching NCList intervals. Full drawing includes a fast preview, full annotation work, and a progressive replacement of slots; later slots run in zero-delay timers. One large slot still runs as one long task. `drawExport` draws all slots synchronously at full quality without the fast preview.

The distinction matters when interpreting a slow frame: range traversal, repeated model access, coordinate conversion, annotation placement, Canvas command submission, and browser raster work are different costs. The [pipeline audit](rendering-pipeline.md) gives the source references, scheduling details, cache candidates, batching constraints, and coordinate precision requirements.

## Dataset and scenario methodology

The default matrix contains 20 scenarios, each with three zoom records:

| Dimension | Default |
| --- | --- |
| Features | 10,000; 50,000; 100,000; 500,000; 1,000,000 |
| Layout | Circular and linear |
| Decoration | Simple arcs and directional arrows |
| Zoom | 1, 10, 1000 |
| Canvas | 600 x 600 CSS pixels, DPR 1 |
| Sampling | 5 measured rounds after 2 warm-up rounds per zoom |
| Interaction | 12 measured navigation draws and frame intervals per zoom |
| Dataset seed | 42 |
| Feature labels / plot points | 0 / 0 |
| Shading / borders | Disabled / disabled |

The generator uses a seeded 32-bit linear congruential sequence. Features have spaced starts with small random offsets, inclusive lengths of 200 to 1799 bases, approximately equal strand allocation, and four opaque colors. The sequence length is `max(1,000,000, count * 1000)`, so increasing feature count also increases genome length. At one million features, positions extend across one billion bases. The benchmark stores genomic coordinates as JavaScript numbers and does not convert them to float32.

The same count and seed produce identical feature coordinates, strand, and style assignments across layouts, decorations, labels, and plot settings. `dataset.featureFingerprint` hashes these geometry/style inputs, permitting direct identity checks. This compact hash is an accidental-mismatch check, not a cryptographic guarantee. The generator name and version, feature count, sequence length, and other options are also saved.

One feature track separates forward and reverse strands into two feature slots. Each feature belongs to one of those slots. This is not a one-slot benchmark, and adding a plot produces another slot. Slot count affects the fast-feature budget, progressive scheduling, and visibility; the report saves `fastFeaturesPerSlot` and per-slot feature/range information.

Every legend item has `minArcLength: 1`. Whole-genome draws therefore retain a minimum one-pixel representation even when true feature widths are subpixel. This intentionally stresses individual-feature rendering and overlap. It is not a biologically aggregated density view and does not demonstrate a suitable final chromosome-scale presentation.

Default features are unnamed and outside annotations are disabled. This isolates a geometry-oriented workload from large populations of label candidates. Features still use CGView's normal object model, including their `Label` objects, so this is not a compact-memory model. `--labels N` names up to N features distributed across the sequence and enables outside labels. The sparse-label cases preserve the same genomic geometry; they do not cover every label policy or all features named. Inline/auto labels require separate follow-up workloads before drawing conclusions about those modes.

An optional deterministic positive/negative plot uses `--plot-points N`; the values follow fixed waves and the positions span the generated sequence. These cases exercise the active plot renderer in the target bundle. They do not replace the existing [plot comparison benchmark](../../scripts/benchmark-plots.mjs), which directly compares plot-rendering variants. `--shading` enables shading for full/export rendering; CGView's fast feature rendering suppresses shading as part of its existing behavior. Borders remain disabled in this harness.

The CLI runs serially in headless Chromium, creating a fresh browser context and viewer for each feature-count/layout/decoration combination. All zoom levels in a scenario reuse that viewer. Draw order rotates among fast, full, and export each round to reduce fixed warm-cache ordering effects. This is a warmed redraw benchmark, not a cold-start comparison. A requestAnimationFrame opportunity separates measured draws.

## What the measurements mean

| Field | Measurement and boundary |
| --- | --- |
| `setup.generationMs` | Construction of synthetic JSON objects and dataset identity. |
| `setup.viewerCreationMs` | Synchronous viewer construction before loading the generated map. |
| `setup.loadJSONSyncMs` | Synchronous `viewer.io.loadJSON` work, including model, track, and index creation. Input is an object, so this excludes parsing a JSON string or fetching a file. |
| `setup.loadJSONSettledMs` | Load call plus waiting for any already-started progressive slot draw. This does not guarantee that the load-triggered first draw has begun or completed. |
| `records[].drawFast` | Synchronous `Layout.drawFast` duration, including normal map infrastructure and sampled feature rendering. |
| `records[].drawFull` | Elapsed duration from `Layout.drawFull` until progressive slots finish, including fast preview, full redraw, and timer delays. |
| `records[].drawExport` | Synchronous full-quality draw on the normal Canvas contexts without the fast preview. This excludes PNG context creation/compositing/encoding and SVG serialization. |
| `records[].visibleFeatures` | Sum of exact feature overlaps in visible slot ranges, independently queried outside render timings. It is not a count of actual painted primitives. |
| `records[].lookupMs` | Standalone visible-count probe including slot/range access and exact NCList counts. Draw-time lookups are diagnosed separately by the profiler. |
| `records[].interaction.cpu` | Synchronous layout zoom, translation, and `drawFast` in a scripted navigation loop. |
| `records[].interaction.frameIntervals` | RAF timestamp interval following each measured navigation draw, including browser/host scheduling and possible raster pressure. |
| `records[].hitTesting` | 200 direct element queries across the first visible feature slot, including forward coordinate conversion and `_getElement`. |
| `memory` and per-record memory | Chromium JavaScript heap observations at several points, when supported. |

`IO._loadJSON` finishes by scheduling a zero-duration D3 `zoomTo` transition. Its eventual end handler starts the normal full draw. Zero-duration transitions are asynchronous, whereas the benchmark's settling check only observes `layout.fullDrawInProgress`, which tracks progressive slot timers. Consequently `loadJSONSettledMs` can be nearly the same as synchronous load and must not be presented as time to first rendered or displayed map. Later measured draws explicitly position the viewer, await transition callbacks, and settle progressive work.

Each render/navigation metric retains every sample with nearest-rank median and p90, plus minimum and maximum. Five samples make p90 the maximum observed sample and are insufficient for a stable tail-latency estimate. Increase iterations and repeat complete runs when evaluating small improvements. Do not compare a median from one scenario with a p90 from another.

The scripted interaction loop alternates a small zoom change and translation, with three unrecorded navigation draws to settle cadence and a final RAF to observe the last draw's interval. It does not dispatch wheel, pointer, or touch events and is not a measurement of input latency or displayed FPS. A native Canvas call returning does not establish raster completion or presentation. Headless browser results cannot establish a hardware GPU speedup.

Hit testing likewise excludes DOM event dispatch, initial pointer-to-genomic coordinate inversion, slot selection, highlighting, and tooltip application work. It measures a bounded query component, not end-to-end pointer latency. Hits are restricted to the first visible feature slot, so multi-track hit-testing scalability needs its own scenario.

Heap observations use `performance.memory` with `--enable-precise-memory-info`, without forced garbage collection. Releasing the generated JSON reference does not immediately collect it. `afterLoad` is therefore an observation of current heap use, not retained map size or a precise delta attributable to features. Canvas backing stores, GPU resources, browser-process RSS, and memory outside the JS heap are excluded. Fresh contexts reduce cross-scenario model retention, but the browser process and host remain shared.

## Development profiling

`--profile` adds separate diagnostic passes after uninstrumented timing has finished at every zoom. This keeps profiler-induced call-site deoptimization out of later primary samples. The profiler installs reversible wrappers on selected rendering methods and native Canvas contexts. It records calls, inclusive time, and self time, plus Canvas method/style assignment counts per layer and in total.

The main metric families are `lookup`, `feature`, `slot`, `geometry`, `layout`, `canvas`, `plot`, `labels.calculate`, `labels.annotation`, `labels.inline`, `labels.track`, `context`, `color`, and `hitTest`. Self time subtracts nested instrumented calls, so NCList iteration does not incorrectly claim all the `Feature.draw` callback work it invokes. Inclusive times overlap and must not be added together. Self time still includes uninstrumented children and wrapper overhead; diagnostic values are not substitutes for baseline timings.

Canvas counters distinguish assignments from actual observed state changes. They cover `beginPath`, line/arc construction, `stroke`, `fill`, text operations, transforms, clipping, compositing-related state, and other hooked operations. Native method timing is CPU submission time. `Color.setColor` counts initialization and explicit resets; it is not an exact allocation counter. Missing or unsupported hooks are exposed in `skippedHooks`.

Label separation is partial. Named calculation methods expose lookup, sorting, placement, and rectangle calculations. `Annotation.draw` still combines preparation, overlap filtering, connector painting, and text painting. Native `fillText`, `measureText`, and path methods also include ruler and other UI work. Inline and track labels have separate hooks, but default synthetic scenarios do not exercise every hook. Report category names and scope instead of claiming a complete exclusive split between label calculation and label paint.

Only one profiler can be installed per page. Install it after map load and layout selection with no draw in progress, then restore it in a `finally` block. Changing layout or replacing loaded objects requires reinstalling the profiler. Prototype hooks avoid adding wrapper properties to millions of individual feature instances. Profiling itself can be expensive at high counts, so use selected representative sizes first.

## Reproduction

Run from the checkout to benchmark. Use the checkout's `.nvmrc` through `cgview-run`, the existing Playwright installation, and a freshly built bundle. The benchmark does not install dependencies or rebuild automatically.

```sh
cgview-run yarn gh-pages
cgview-run yarn benchmark:rendering --help

# Complete default geometry matrix.
cgview-run yarn benchmark:rendering --output .benchmark-results/rendering-baseline.json

# Quick smoke run before a long matrix.
cgview-run yarn benchmark:rendering --counts 10000 --formats circular,linear --decorations arc --zooms 1,10,1000 --iterations 2 --warmups 1 --frames 6 --output .benchmark-results/rendering-smoke.json

# Separate diagnostic workload, preserving the primary timing passes.
cgview-run yarn benchmark:rendering --counts 10000,100000 --profile --output .benchmark-results/rendering-profile.json

# Sparse outside labels on the same feature geometry.
cgview-run yarn benchmark:rendering --counts 10000,100000 --labels 100 --profile --output .benchmark-results/rendering-labels.json

# Plot and shading supplements; keep these separate from the geometry baseline.
cgview-run yarn benchmark:rendering --counts 10000 --plot-points 100000 --profile --output .benchmark-results/rendering-plots.json
cgview-run yarn benchmark:rendering --counts 10000 --shading --profile --output .benchmark-results/rendering-shading.json

# Optional capacity experiment. A larger timeout does not guarantee enough memory.
cgview-run yarn benchmark:rendering --counts 2000000 --formats circular --decorations arc --iterations 3 --warmups 1 --timeout 600 --output .benchmark-results/rendering-2m.json

# Measure a separately built baseline checkout with the current benchmark helpers.
cgview-run yarn benchmark:rendering --baseline-root /path/to/built-baseline --output .benchmark-results/rendering-before.json
cgview-run yarn benchmark:rendering --output .benchmark-results/rendering-after.json
```

`--baseline-root` selects the library, D3, SVG adapter, and CSS from that checkout for a single run. The benchmark/profiler helpers always come from the invoking checkout. It does not run two targets automatically or calculate regression thresholds. Use matching options, compare dataset fingerprints, inspect both target Git states, and compare recorded bundle hashes. Rebuild each checkout after relevant source changes; a Git revision alone cannot establish which ignored generated bundle was measured.

Reports are written as raw JSON and a sibling Markdown summary after each completed scenario. JSON includes samples, setup and heap observations, diagnostic profiles when enabled, seed and scenario options, Git revision/status for target and harness, script hashes, target bundle SHA-256, Node/browser versions, OS/CPU/RAM details, headless/DPR settings, and launch arguments. Failed scenarios and browser-launch failures are recorded before an unsuccessful exit; the default scenario timeout is 180 seconds. Review the report's `status`, scenario statuses, and `plannedScenarios` before calling a matrix complete.

The runner also requests Chromium's GPU devices, feature status, auxiliary renderer attributes, and driver workarounds through CDP `SystemInfo.getInfo`. These best-effort diagnostics help distinguish software rendering from enabled acceleration; unsupported or failed requests are recorded without failing the benchmark. Inspect actual renderer strings and feature statuses before characterizing the graphics environment. Device presence alone does not prove that Canvas work was hardware accelerated, and reports created before this diagnostic was added may omit `environment.gpu`.

Run benchmark processes serially on a quiet host. Do not run builds, tests, other benchmark matrices, or heavy browser jobs concurrently. Record differences in browser version, machine, operating system, and active workload before attributing a change to code. A shared server can produce scheduling outliers even with fixed code and seed.

## Results and optimization decision

### Environment and baseline

Measured September 17, 2026 on Linux x64, Intel Xeon (Sapphire Rapids), 16 logical CPUs and 31.3 GiB RAM; Node 24.21.0 and headless Chromium 151.0.7922.34. Canvas is 600 x 600 at DPR 1. Later diagnostic runs explicitly report software Canvas/rasterization and ANGLE SwiftShader; these results do not characterize hardware GPU performance or Safari/WKWebView.

Baseline revision: `f2ace3428288d997a2ce2a076aaa207dcb304243`. Baseline bundle SHA-256: `a116e4c5d9bf6dbdb84b0eb97c45b6a57fb552623cbadbc1dc7d92228bcc79b9`. The complete 20-scenario / 60-view matrix completed, with five samples after two warm-ups. [All baseline rows](rendering-results/stage1-baseline.md) and [raw baseline observations](rendering-results/stage1-baseline.json) retain the remaining decorations, zooms, p90 values, and sample variability.

Whole-genome arcs, median milliseconds:

| Features | Circular fast | Circular full | Linear fast | Linear full |
| ---: | ---: | ---: | ---: | ---: |
| 10,000 | 1.3 | 28.8 | 1.4 | 20.9 |
| 50,000 | 4.9 | 129.4 | 4.9 | 95.8 |
| 100,000 | 8.3 | 242.5 | 8.1 | 184.6 |
| 500,000 | 40.9 | 1209.2 | 38.2 | 918.8 |
| 1,000,000 | 132.7 | 2431.2 | 127.7 | 1902.7 |

One million features, medians in milliseconds:

| Layout / decoration | Zoom | Visible features | Fast | Full | RAF interval |
| --- | ---: | ---: | ---: | ---: | ---: |
| circular / arc | 1 | 1,000,000 | 132.7 | 2431.2 | 149.9 |
| circular / arc | 10 | 92,815 | 36.6 | 321.9 | 33.4 |
| circular / arc | 1000 | 978 | 1.4 | 8.0 | 16.7 |
| circular / arrow | 1 | 1,000,000 | 122.3 | 2750.3 | 116.7 |
| circular / arrow | 10 | 92,815 | 28.3 | 338.9 | 33.3 |
| circular / arrow | 1000 | 978 | 1.7 | 8.4 | 16.7 |
| linear / arc | 1 | 1,000,000 | 127.7 | 1902.7 | 133.3 |
| linear / arc | 10 | 116,668 | 44.5 | 303.4 | 49.9 |
| linear / arc | 1000 | 1,168 | 1.0 | 5.9 | 16.7 |
| linear / arrow | 1 | 1,000,000 | 131.0 | 2604.9 | 133.3 |
| linear / arrow | 10 | 116,668 | 42.9 | 400.7 | 49.9 |
| linear / arrow | 1000 | 1,168 | 1.3 | 7.2 | 16.7 |

Whole-map full drawing is already hundreds of milliseconds at 100k features and reaches 1.90 to 2.75 seconds at 1M. Whole-map fast drawing reaches 122 to 133 ms at 1M even though feature callbacks are sampled. At 1000x, only about 978 to 1168 features intersect the slot ranges and fast drawing drops to roughly 1 to 2 ms. GPU submission alone would not remove the CPU visibility and model work.

For the 1M scenarios, synchronous model/track/index loading takes 2.37 to 2.68 seconds. Heap observed immediately after load is 472.9 to 476.1 MiB, compared with about 11.8 MiB at 10k. These include transient/uncollected data and exclude Canvas/process/GPU memory. They establish a memory investigation target, not a retained-bytes-per-feature estimate.

### Focused optimization and diagnostics

The only production change is in [Slot.draw](../../src/Slot.js): compute the exact partial-range feature count only for fast drawing or an enabled debug count panel. Full-quality rendering already visits the exact NCList matches and does not otherwise use that count. No query result caching, index replacement, batching, shading change, or renderer abstraction was introduced.

Candidate bundle SHA-256: `67d706d918f4f6bb460c9326ead88a4fe5315e76f4c8efe6b6c094ce67f1bd55`. The focused comparison uses 1M features at 10x, 15 samples after three warm-ups. [Before](rendering-results/stage1-count-before.json) and [after](rendering-results/stage1-count-after.json) are separate context/heap runs:

| Layout / decoration | Full before | Full after | Export draw before | Export draw after |
| --- | ---: | ---: | ---: | ---: |
| circular / arc | 291.9 | 290.9 | 253.5 | 245.5 |
| circular / arrow | 367.4 | 353.6 | 318.2 | 301.3 |
| linear / arc | 309.8 | 277.6 | 242.8 | 199.3 |
| linear / arrow | 390.2 | 384.1 | 345.6 | 333.2 |

Independent runs show noticeable noise: the unchanged fast path varies from about -8% to +17%. These raw differences must not all be attributed to the change. A paired experiment below alternates the actual baseline and candidate `Slot.draw` functions on the same current viewer, features, indexes, and camera to better isolate the count traversal.

The operation counts are unambiguous: at 10x, export drawing goes from two `lookup.count` calls to zero; progressive full drawing goes from four to two because its fast preview still requires counts. Fast drawing retains both count calls. Feature calls stay exactly equal: 92,815 circular or 116,668 linear full-quality features; previews add the same 725 or 911 sampled calls respectively.

The [paired count experiment](../../scripts/benchmark-rendering-counts.mjs) uses 20 measured pairs after four warm-up pairs, alternating AB/BA order with a RAF before each sample. It times synchronous full-quality drawing on ordinary Canvas contexts. These are the actual bundled slot methods; all other model/layout code and objects are the candidate viewer. It is an isolated comparison of this change, not a second whole-application baseline.

| Layout / decoration | Baseline median | Candidate median | Median paired saving | Count probe median | Faster pairs |
| --- | ---: | ---: | ---: | ---: | ---: |
| circular / arc | 251.3 | 234.9 | 15.6 | 13.5 | 19/20 |
| circular / arrow | 320.4 | 294.3 | 17.1 | 14.9 | 19/20 |
| linear / arc | 202.4 | 184.3 | 18.2 | 9.3 | 20/20 |
| linear / arrow | 356.7 | 337.1 | 18.3 | 19.4 | 19/20 |

All four paired cases produce byte-identical map pixels. The paired saving is consistent with removing one independent visible-count traversal per feature slot. It improves this zoomed full-quality path, while leaving the larger whole-map interaction problem unchanged. [Raw paired observations](rendering-results/stage1-count-paired.json) include every pair, order, function-source hashes, and pixel hashes.

```sh
cgview-run node scripts/benchmark-rendering-counts.mjs --baseline-root /path/to/built-baseline
```

### Diagnosed bottlenecks

- **Fast visibility traversal:** the 1M circular whole-map diagnostic paints only 978 feature callbacks, yet NCList `run` accounts for roughly 196 ms of a 208 ms instrumented fast draw. The independent baseline is about 133 ms. Stable sampling limits draw calls but still walks a million overlapping entries. This is a CPU bottleneck that a new graphics backend would inherit unless visibility/sampling preparation also changes.
- **Full-quality Canvas work:** the same map issues 1,000,107 `beginPath` calls and 1,000,106 strokes, including map infrastructure. It also performs 2,000,009 layout-specific pixels-per-base calculations. The uninstrumented export draw is around 2.3 seconds; the instrumented pass is around 8.8 seconds. Counts are useful here; the diagnostic timing split must not be interpreted as an overhead-free cost model.
- **Repeated state writes:** whole-map export makes 1,000,117 line-width assignments but only 17 observed effective changes; 1,000,116 line-cap assignments cause two observed changes. Color order varies, with roughly 750k actual stroke-color changes. Frame-local state reuse is worth a separate experiment, but persistent caching would need to handle callers, context replacement, SVG, and export correctly.
- **Shading and color conversion:** at 10k features the shaded circular arc pass makes 30,108 strokes and 20,002 `Color.setColor` calls, with 10,001 lightening and darkening operations each. The source audit ties most of these to two temporary shading colors per element. Whole-map full drawing is 96.4 ms for circular arcs and 114.9 ms for circular arrows, versus 28.8 and 32.8 ms in the unshaded baseline. A bounded cache of derived colors is a promising follow-up; no unverified cache is included here.
- **Plots:** adding one million deterministic plot samples to the 10k-feature map gives whole-map fast/full medians of 22.6/71.1 ms circular and 20.0/62.5 ms linear. The contour renderer already reduces submitted geometry, but range summarization still has CPU cost. Diagnose plots separately from feature geometry.
- **Labels:** 1,000 distributed outside-label candidates on 10k features produce fast/full medians of 2.9/31.1 ms circular and 3.2/22.4 ms linear. Diagnostic annotation work is about 2.7 to 2.8 ms with overhead, and only 71 circular or 51 linear feature labels are painted at whole-map scale. These bounded cases do not establish the cost of millions of names or inline/auto placement.
- **Layout and hit testing:** steady-view `updateLayout` returns through its existing zoom cache and is below the timer resolution in these profiles. The supplemental direct hit-test batches take about 0.2 to 1.7 ms for 200 queries. This supports retaining the point/range infrastructure; it does not measure complete pointer events or justify a new index.

The [million-feature diagnostic](rendering-results/stage1-profile.json), [outside-label results](rendering-results/stage1-labels.json), [plot results](rendering-results/stage1-plots.json), and [shading results](rendering-results/stage1-shading.json) preserve raw timings, calculation/drawing hooks, Canvas counts, and per-layer styles. The supplemental cases use three samples after one warm-up, with six navigation frames, and should be treated as directional diagnostics.

### Capacity and verification

The optional 2M-feature circular-arc capacity run used the unchanged baseline bundle, a two-billion-base sequence, three samples after one warm-up, and six navigation frames. [Raw capacity results](rendering-results/stage1-2m.json) and [all capacity rows](rendering-results/stage1-2m.md):

| Zoom | Visible features | Fast median | Full median | RAF interval median |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 2,000,000 | 256.1 | 5068.0 | 250.0 |
| 10 | 185,637 | 47.6 | 597.1 | 49.9 |
| 1000 | 1,945 | 1.8 | 10.5 | 16.7 |

Synchronous load took 6.38 seconds; heap observed after load was 1066.5 MiB. This demonstrates capacity, not smooth whole-genome navigation. Progressive drawing yields between slots, but each full-quality slot still blocks for substantial time. A fast renderer alone cannot make millions of overlapping minimum-width glyphs biologically interpretable.

Validation:

- `cgview-run yarn docs:check`: 116 documentation pages and 85,294 local links/assets passed, plus the existing API, Markdown, navigation, and theme browser checks.
- `cgview-run yarn gh-pages` rebuilt the normal and standalone browser bundles; the existing published worktree symlink points to these docs assets.
- `cgview-run yarn gh-test --runInBand`: 27 suites, 336 tests passed, including wrapped/nested interval order, score order, shaded reverse traversal, stable fast samples, exact debug counts, deterministic inputs, progressive readiness, and profiler restoration.
- [Browser equivalence checker](../../scripts/check-rendering-performance.mjs): 12 circular/linear, arc/arrow, 1x/10x/1000x cases have identical pixels across every Canvas layer. Shading, borders, a selected feature, sparse labels, a plot, and score ordering are included. Profiling also preserves pixels and restores method/accessor descriptors.
- Four SVG structure comparisons, including group hierarchy, and four 1200 x 1200 PNG pixel/byte comparisons pass. [Raw visual/export results](rendering-results/stage1-visual-check.json) record asset and pixel hashes.

```sh
cgview-run node scripts/check-rendering-performance.mjs --baseline-root /path/to/built-baseline
```

No dependency changes, API/JSON changes, renderer refactor, GPU backend, LOD implementation, or index replacement are part of this milestone. Stage 1 is ready for review before Stage 2.

## Candidates and Stage 2 recommendations

The bounded candidates from the audit are avoiding unused full-quality NCList counts, reusing derived shading colors, avoiding temporary range allocations, and reusing values within one draw. They have different invalidation and correctness risks. Slot geometry, base RGBA strings, and several label measurements already have caches. Measure actual remaining work before adding persistent caches.

Batching is an experiment, not a default optimization. Sorting by style changes painter order; combining paths changes overlap compositing and antialiasing; adjacent arcs can accidentally acquire connecting segments. A candidate must preserve clipping, winding, borders, shading, selection, circular/linear behavior, and SVG/PNG export. Restrict an initial experiment to a demonstrably equivalent subset and compare pixels and speed before considering a guarded implementation.

A later renderer boundary can start near the genomic arguments already passed to `Canvas.drawElement`: start/stop, slot offset and width, color/style, decoration, direction, and selection state. Layout and visibility should retain responsibility for genomic interpretation and hit-test identity. Canvas should remain the reference for geometry and the existing text/UI/export paths. Avoid allocating a new object for every feature on every frame merely to create this boundary.

Typed-array experiments should measure construction, updates, retained memory, and precision separately from draw speed. JavaScript objects are currently shared across model collections rather than copied wholesale, although NCList wrappers and slot memberships add memory. Float32 cannot represent every integer above 16,777,216; uint32 is limited to 4,294,967,295. Preserve exact supported coordinates in CPU data and evaluate local-origin or split-coordinate schemes before choosing GPU formats.

Stage 2 acceptance should require equivalent Canvas output in both layouts, unchanged public API and JSON, preserved hit testing and export, and an interface small enough to justify with the measured hot paths. The current benchmark provides a reproducible Canvas reference; it does not by itself justify WebGPU, replacing NCList, a global scene graph, or a new level-of-detail policy.
