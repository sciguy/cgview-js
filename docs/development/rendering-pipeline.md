# Rendering pipeline audit

Stage 1 source audit for `v1.9-gpu`, September 17, 2026. This describes the Canvas reference renderer before any Stage 2 abstraction. Timing results and the decision about production optimizations belong in [rendering-performance.md](rendering-performance.md). The performance opportunities below are hypotheses unless that report supplies measurements.

## Draw path and ownership

```text
Viewer.draw(fast)
  Layout.draw(fast)
    drawFast() or drawFull()
      drawMapWithoutSlots(fast)
        clear transient layers
        Backbone.draw -> Canvas.drawElement
        updateLayout -> slot widths and offsets
        Dividers.draw
        Annotation.draw -> label lookup, placement, connectors, text
        drawProgress
      drawAllSlots(true)
        visible Track -> visible Slot.draw
          layout-specific visible range
          NCList count/run/find
          Feature.draw -> drawRange -> Canvas.drawElement
            Layout.path -> LayoutCircular.path or LayoutLinear.path
              context moveTo/lineTo/arc -> stroke/fill
          or Plot.draw -> plot geometry and Canvas paths
          optional inline feature labels
      full only: clear and redraw slots at full quality
      Sequence.draw
      drawForeground -> track labels, ruler, centerline, map captions/legend
```

`Viewer` forwards draw methods to `Layout` ([Viewer.js:1288](../../src/Viewer.js#L1288), [Viewer.js:1305](../../src/Viewer.js#L1305)). `Canvas` owns six stacked 2D contexts: background, map, foreground, canvas, debug, and UI ([Canvas.js:54](../../src/Canvas.js#L54)). Its width/height and device pixel ratio control raster resolution; benchmarks need to record all three.

`Layout.drawMapWithoutSlots` clears map, foreground, and UI; draws backbone; updates slot geometry; then draws dividers, outside annotations, and loading progress. It also cancels an unfinished slot redraw ([Layout.js:877](../../src/Layout.js#L877)). Foreground is redrawn separately after map data, protecting track identifiers, ruler text, centerline, captions, and legend ([Layout.js:976](../../src/Layout.js#L976)). Canvas-positioned captions and legend use their own layer and are not all redrawn by this path.

Tracks select feature references from the viewer by source/type/tag and split references into slots by strand, reading frame, type, or legend ([Track.js:507](../../src/Track.js#L507), [Track.js:546](../../src/Track.js#L546)). Each slot builds its own NCList using `mapStart`/`mapStop` on refresh ([Slot.js:227](../../src/Slot.js#L227)). Track filtering, splitting, and index construction are load/update costs rather than normal per-frame work. They still affect startup time and memory with many overlapping track memberships.

## Visibility and feature iteration

`Slot.draw` computes a range for its center offset with a margin equal to slot thickness ([Slot.js:292](../../src/Slot.js#L292)). Circular visibility intersects a radius with the viewport rectangle, converts angles to base positions, and uses radius bounds to distinguish a full circle from no visible range ([LayoutCircular.js:124](../../src/LayoutCircular.js#L124), [LayoutCircular.js:391](../../src/LayoutCircular.js#L391)). Linear visibility inverts the horizontal scales with the margin and clamps to the sequence; it does not currently reject the range based on vertical slot position ([LayoutLinear.js:112](../../src/LayoutLinear.js#L112)).

NCList normalizes origin-crossing intervals into two entries, sorts by start and descending stop, and builds nested sublists ([NCList.js:54](../../src/NCList.js#L54), [NCList.js:91](../../src/NCList.js#L91)). Queries binary-search each list's relevant boundary, then traverse overlapping intervals and nested lists ([NCList.js:172](../../src/NCList.js#L172)). Wrapped query ranges are split, with duplicate suppression for features crossing the origin or spanning both query pieces ([NCList.js:218](../../src/NCList.js#L218)). `count` performs a complete `run`; `find` performs a `run` and materializes an array ([NCList.js:239](../../src/NCList.js#L239)).

For position drawing, the slot streams query results directly to `Feature.draw`. Score drawing allocates a result array and sorts ascending score, then ascending feature length, every draw ([Slot.js:325](../../src/Slot.js#L325)). The baseline slot implementation performs a separate exact count for partial ranges before drawing. That count matters for fast sampling and debug statistics, but not for full-quality feature selection. Avoiding unused full-quality counts is a small candidate for measurement.

Fast rendering limits feature *callbacks*, not NCList traversal. A power-of-two sampling step is derived from the visible feature count, with a nominal budget of 1,000 features divided among visible slots ([Layout.js:54](../../src/Layout.js#L54), [Layout.js:1107](../../src/Layout.js#L1107)). NCList still visits every relevant interval and accepts one when its original feature index is divisible by the step ([NCList.js:202](../../src/NCList.js#L202)). The original-index rule provides stable samples as zoom changes. Fast frame time can therefore continue increasing with dataset size even when the number of painted features stays near the budget.

## Feature geometry and Canvas work

`Feature.draw` rejects invisible features. A simple feature draws its map range; a joined feature creates ranges and per-location options, draws each location, and adds thin connectors ([Feature.js:660](../../src/Feature.js#L660)). `drawRange` checks overlap again, clips out-of-view endpoints with a 100-base cushion, and can split origin-crossing linear features or very long circular features at high zoom into two draw operations ([Feature.js:711](../../src/Feature.js#L711)). Score decoration changes width and center offset; other features can have a proportion of slot thickness ([Feature.js:844](../../src/Feature.js#L844)). A feature count is consequently not a Canvas primitive count.

`Canvas.drawElement` receives genomic start/stop, center offset, width, decoration, color, and styling flags ([Canvas.js:333](../../src/Canvas.js#L333)). It expands endpoints by half a base, enforces minimum arc length, optionally culls arcs below 0.1 pixel when minimum arc length is zero, and decides whether automatic arrows fit ([Canvas.js:385](../../src/Canvas.js#L385)). Arrowheads are expressed in pixels and converted to bases; the arrow tip and inner edge require additional point conversions ([Canvas.js:498](../../src/Canvas.js#L498)).

| Element | Main path work | Additional work |
| --- | --- | --- |
| Unshaded arc | One `beginPath`, one `stroke`, width/color assignments | Optional border path and stroke |
| Shaded arc | Three paths and strokes | Two `Color` constructions and light/dark conversions; optional border |
| Unshaded arrow | One closed path and fill, two body edges plus tip | Optional border path and stroke |
| Shaded arrow | Three closed paths and fills | Two `Color` constructions and light/dark conversions; optional border |
| Selected element | Normal body | Dashed border and dash reset |

These counts exclude clipping splits, joined locations/connectors, and elements rejected before path construction ([Canvas.js:435](../../src/Canvas.js#L435), [Canvas.js:535](../../src/Canvas.js#L535)). Fast slot drawing disables shading through feature options; it does not generally disable borders or selection decoration ([Slot.js:320](../../src/Slot.js#L320), [Canvas.js:465](../../src/Canvas.js#L465)).

Canvas delegates path construction through `Layout` ([Canvas.js:631](../../src/Canvas.js#L631), [Layout.js:394](../../src/Layout.js#L394)). Circular positions convert base pairs to angles using the base scale, then use sine/cosine plus the projected map center ([LayoutCircular.js:62](../../src/LayoutCircular.js#L62)). Short circular ranges, under one thousandth of sequence length, are straight segments. Longer ranges use `arc`, with near-full-circle paths split for SVG compatibility and an adaptive-polyline Safari workaround where enabled ([LayoutCircular.js:192](../../src/LayoutCircular.js#L192)). Linear paths are straight segments generated through the base and x/y scales ([LayoutLinear.js:60](../../src/LayoutLinear.js#L60), [LayoutLinear.js:162](../../src/LayoutLinear.js#L162)).

## Fast, full, and export scheduling

`drawFast` performs its full work synchronously: map infrastructure and fast annotations, sampled slots, sequence, and foreground ([Layout.js:929](../../src/Layout.js#L929)). D3 zoom/pan events update scales and call `viewer.drawFast`; the end event calls `viewer.drawFull` ([Viewer-Zoom.js:74](../../src/Viewer-Zoom.js#L74)). Programmatic animation has the same fast-during-transition/full-at-end pattern ([Viewer.js:1648](../../src/Viewer.js#L1648)).

`drawFull` first draws full outside annotations and *all slots in fast mode*. It then clears and redraws the first slot synchronously at full quality, scheduling subsequent slots individually with zero-delay timers ([Layout.js:953](../../src/Layout.js#L953), [Layout.js:1018](../../src/Layout.js#L1018)). Work is sliced between slots, not within a slot. One million features in one slot can still produce a long main-thread task. Clearing a slot draws its range using `destination-out` before restoring `source-over` ([Slot.js:271](../../src/Slot.js#L271)).

Benchmark consequences:

- The return time of `viewer.drawFull()` can exclude later slots. Await `layout.fullDrawInProgress` becoming false, and distinguish CPU work from elapsed completion time.
- Existing debug `fullDraw` timing starts after infrastructure and fast preview, so it is not total render time. Existing timers use millisecond `Date` values rather than `performance.now()`.
- A full render includes preview draws, clears, and final draws. Count them or label the measurement as a direct slot/export draw.
- Measure interaction with animation-frame intervals as well as synchronous draw duration. A Canvas method returning does not establish that its pixels have been presented.
- Idle/synchronous render timing and browser raster/compositor time are separate measurements. Headless software rendering results cannot establish hardware GPU speedups.

`drawExport` draws all slots synchronously at full quality without the preview ([Layout.js:964](../../src/Layout.js#L964)). PNG export temporarily replaces Canvas contexts, scales them, draws, composites layers, and restores the original contexts ([IO.js:470](../../src/IO.js#L470), [IO.js:502](../../src/IO.js#L502)). Any style/context cache must survive context replacement correctly; SVG also requires the existing path semantics.

## Plots, labels, and hit testing

`Plot.draw` chooses the legacy path renderer or the contour renderer, with one or two color passes ([Plot.js:432](../../src/Plot.js#L432)). The legacy path searches visible positions, creates a filled path, and samples by a power-of-two step above about 4,000 positions in fast mode ([Plot.js:449](../../src/Plot.js#L449)). The contour renderer builds screen-scale bins, samples summaries, and reuses the resulting geometry for positive and negative drawing. Full mode can add a contour stroke; fast mode doubles bin width and omits outlines ([PlotRenderer.js:42](../../src/PlotRenderer.js#L42), [PlotRenderer.js:69](../../src/PlotRenderer.js#L69), [PlotRenderer.js:188](../../src/PlotRenderer.js#L188)). These are distinct workloads and should have separate results.

Outside labels have a separate NCList. Refresh filters visibility and calculates default positions; width measurement is refreshed on label/font changes ([Annotation.js:346](../../src/Annotation.js#L346)). A frame queries candidates, sorts by favorites and feature length, places priority labels, positions remaining labels, and rejects overlapping rectangles before painting connector lines, text backgrounds, and text ([Annotation.js:550](../../src/Annotation.js#L550)). Large numbers of candidates can therefore cost time even when very few labels fit. Label calculation and label painting should be reported separately.

Inline/auto labels add another full visible-feature query per slot. Their placement intentionally considers all visible features even during fast sampled drawing so collision decisions remain stable ([FeatureLabelRenderer.js:496](../../src/FeatureLabelRenderer.js#L496)). Placement is cached within a map draw and cleared by `beginDraw`; glyph measurements and automatic text colors have separate caches ([FeatureLabelRenderer.js:48](../../src/FeatureLabelRenderer.js#L48), [FeatureLabelRenderer.js:70](../../src/FeatureLabelRenderer.js#L70)). Auto mode performs this placement before outside fallback labels, then slot drawing consumes it. Reporting only `Annotation.draw` would miss inline painting inside `Slot.draw`. Track names and ruler labels are additional foreground work ([Layout.js:976](../../src/Layout.js#L976)).

Hit testing is event driven and does not read Canvas pixels. Mouse coordinates are inverted into base position and center offset, then the slot is found by scanning visible slot bounds ([EventMonitor.js:206](../../src/EventMonitor.js#L206), [Layout.js:794](../../src/Layout.js#L794)). A point NCList query returns overlapping features and the smallest visible feature wins; labels use rectangle checks after other element checks ([EventMonitor.js:278](../../src/EventMonitor.js#L278), [EventMonitor.js:320](../../src/EventMonitor.js#L320)). Model/visibility indexing can therefore remain shared if future genomic geometry is drawn by another graphics API.

## Optimization experiments and constraints

| Hypothesis | Evidence and experiment | Correctness constraints |
| --- | --- | --- |
| Avoid unused full-quality counts | Partial-range slot drawing does `count` followed by `run`/`find`. Compare full zoomed draws with count restricted to fast mode or enabled debug counts. | Preserve fast step, score ordering, wrapped ranges, debug counts, and full-map shortcut. |
| Cache derived shading colors | Two new colors per shaded element; base `rgbaString` is already cached ([Color.js:117](../../src/Color.js#L117)). Compare shaded arcs/arrows with bounded per-color light/dark reuse. | Key on actual RGBA value and shading amount; never mutate shared legend colors; bound growth for arbitrary colors. |
| Avoid temporary map ranges | `Feature.mapRange` calls `CGRange.onMap`, which constructs a new object on every access ([CGRange.js:136](../../src/CGRange.js#L136)). Measure allocations and feature-draw CPU separately. | Contig offsets and lengths are mutable. Reusing ranges requires explicit invalidation or avoiding allocation without changing range semantics. |
| Reuse frame-local transforms | Circular center coordinates and pixels per base repeat; linear pixels-per-base queries repeatedly read/invert scale endpoints. Compare scoped cached values while holding all pixels equal. | Invalidate on zoom, pan, resize, layout/sequence/slot changes; per-feature width/offset may differ. |
| Reuse frame-local query results | Full preview/full redraw and inline placement repeat queries. Measure allocation tradeoff against streaming iteration. | Sampling and painter order differ; storing a million feature references can worsen memory/GC. |
| Improve origin duplicate membership if measured | NCList uses `indexOf` on crossing-feature lists ([NCList.js:194](../../src/NCList.js#L194)). Stress origin-wrapping datasets separately. | Preserve feature identity, ordering, and duplicate suppression. Ordinary short nonwrapping datasets will not justify an index redesign. |

Slot geometry already skips recalculation at unchanged zoom unless forced, so a new persistent layout cache is not automatically useful ([Layout.js:1098](../../src/Layout.js#L1098)). Likewise, replacing existing cached RGBA getters or cached label widths would target the wrong cost.

Batching same-color paths is not automatically visually equivalent:

- Reordering by color changes overlap priority, especially score order, directional arrows, and shading. Even contiguous same-style elements can overlap.
- A single path composites translucent overlap once; separate draws composite it repeatedly. Antialiased boundaries can differ even for opaque colors.
- `ctx.arc` appends to the existing subpath when one exists. Concatenating circular arcs without explicit moves can create connecting lines that did not exist when each element began a fresh path.
- Filled-arrow winding, overlapping edges, joins, caps, border/shadow layering, selection dashes, and slot `destination-out` clears must be preserved.
- SVG export and Safari polyline paths must remain equivalent to their current Canvas behavior.

A bounded experiment can start with contiguous non-overlapping opaque unshaded arcs with identical width and state, explicit independent subpaths, no selection/border, and image comparisons in circular and linear layouts. A measured win in that restricted case would justify considering a guarded path, not global style sorting. Stage 1 does not require implementing batching.

## Compact representations for later stages

The model currently shares `Feature` references across viewer/contig/track/slot arrays, while each slot NCList adds wrapper entries and sublists. Shared references do not duplicate the entire feature, but index wrappers and arrays still scale with memberships. Measure JS heap, index construction, and load time independently of draw time.

Potential render-only typed arrays include base starts/stops, stable feature IDs, style indexes, strand/decoration flags, thickness proportions, and score values. Joined locations need offsets/counts into a separate location table. Slot transforms and camera/viewport state belong separately so pan/zoom does not copy per-feature data. Preserve the public feature objects and JSON format during experiments.

`Uint32Array` positions support integers only through 4,294,967,295. `Float32Array` stops representing every integer above 16,777,216, so it is not a safe generic storage type for large genomic coordinates at high zoom. CPU arrays can retain exact supported coordinates in `Float64Array`; future GPU experiments can investigate local-origin offsets or split integer coordinates. Memory wins, precision, update cost, and renderer independence require measurement before selecting a format.

Stage 2 should initially isolate the genomic geometry already described by `Canvas.drawElement`, while leaving labels, captions, legends, and other text on Canvas. Keep visibility, clipping, feature identity, and hit testing separate from graphics submission. Do not proceed until Stage 1 identifies which costs actually dominate representative maps.
