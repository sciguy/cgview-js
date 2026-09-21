CGView dependency audit, 11 September 2026

This records the initial investigation and its measurements. The subsequent
implementation now builds core and standalone through the normal Rollup
configuration, each as minified IIFE and readable ESM. See [the current bundle guide](bundles.md) for filenames,
updated sizes, commands, and verification. The prototype-specific workflow
described below has been replaced by that implementation.

Yes: CGView can ship as one JavaScript file containing the D3 code it uses,
SVG export, and its styles. The measured demonstration is **371,798 bytes
(363.08 KiB), or 106,284 bytes (103.79 KiB) gzipped**. That increases the
CGView JavaScript file by **39.20%**, while reducing the current combined
CGView + D3 + SVGCanvas + CSS download by **41.16% when gzipped**.

The initial investigation used revision
`b6d126051e19c6deb6bd4831dfabc979a56784da` as its baseline.

The [single-file demonstration](test/standalone.html)
uses [the standalone bundle](dist/cgview.standalone.min.js).
It supplies SVG export automatically, honors a caller's `SVGContext` override,
and injects CGView's styles. It exports the existing `CGView` API without
creating global `d3` or `svgcanvas` objects.

The initial measurements below came from separate demonstration builds.
At that stage, the normal Rollup configuration and library source were
unchanged. The subsequent implementation is described in the current bundle
guide linked above. No packages were added or upgraded in either stage.

The measurements below use this checkout's locked D3 7.0.1, SVGCanvas 2.3.0,
Rollup 4.34.6, existing Terser settings, and Node 24.21.0. KiB means 1,024
bytes. Gzip uses level 9 on each complete file and is a local compression
measurement, not a measurement of the server's HTTP compression settings.
Third-party license notices are included in the demonstration bundles.

| JavaScript build | Minified bytes | Minified KiB | Increase over current JS | Gzip KiB | Gzip increase |
| --- | ---: | ---: | ---: | ---: | ---: |
| Current CGView, with external D3 | 267,094 | 260.83 | baseline | 70.98 | baseline |
| Bundle D3 using existing imports | 338,808 | 330.87 | 26.85% | 94.27 | 32.80% |
| Bundle D3 using explicit module imports | 338,847 | 330.91 | 26.86% | 94.16 | 32.65% |
| Explicit D3 + SVG export | 361,078 | 352.62 | 35.19% | 101.42 | 42.88% |
| Explicit D3 + SVG export + embedded CSS | 371,798 | 363.08 | 39.20% | 103.79 | 46.22% |

Bundling selected D3 adds **71,753 bytes (70.07 KiB)** to the current CGView
file, or **23,729 bytes (23.17 KiB)** after gzip. The small difference between
the two D3 builds is negligible. Existing `import * as d3 from 'd3'` statements
are statically analyzable and do not force the entire D3 library into the
browser bundle.

The current baseline includes its 39-byte source-map reference. Demonstrations
omit source maps. Rebuilding the external baseline without that reference
produces 267,055 bytes, confirming that the core/minifier baseline is the same.
Source-map files themselves are excluded from every download comparison.

| Complete browser setup | Files | Total bytes | Total KiB | Gzip KiB |
| --- | ---: | ---: | ---: | ---: |
| Current CGView + full D3 + CSS | 3 | 556,343 | 543.30 | 162.49 |
| Bundled selected D3 + separate CSS | 2 | 353,827 | 345.53 | 97.17 |
| Current CGView + full D3 + SVGCanvas + CSS | 4 | 618,281 | 603.79 | 176.40 |
| Standalone including SVG export and styles | 1 | 371,798 | 363.08 | 103.79 |

Relative to today's equivalent four-file setup, standalone saves **246,483
bytes (39.87%)**, or **74,348 gzipped bytes (41.16%)**. Even compared with
today's three-file setup without SVG export, standalone is **33.17% smaller
uncompressed and 36.12% smaller gzipped**, while adding SVG export.

These totals use the files currently served by the repository. In particular,
`docs/scripts/svgcanvas.iife.js` is unminified, so the raw savings include
minifying that library. Gzip totals sum the separately compressed responses.
Caching, HTTP headers, application code, and genome data are outside these
comparisons.

CGView calls **19 D3 functions** directly, from eight D3 packages. A ninth
package, `d3-transition`, supplies the selection methods used for animations.
After tree shaking, portions of 14 D3 packages remain.

| D3 package | Direct functions or behavior | Main CGView callers |
| --- | --- | --- |
| `d3-selection` | `select`, `selectAll`, `pointer` | Viewer, Canvas, EventMonitor, ColorPicker, IO, Messenger |
| `d3-array` | `min`, `max`, `sum`, `mean`, `median`, `ticks`, `tickStep` | Layout, Plot, Ruler, Caption, Legend, IO |
| `d3-format` | `format`, `formatPrefix`, `precisionPrefix` | Utils, Ruler |
| `d3-scale` | `scaleLinear` | Layout |
| `d3-time-format` | `timeFormat` | IO's fixed timestamp format |
| `d3-zoom` | `zoom`, `zoomTransform` | Viewer-Zoom, Viewer, Layout |
| `d3-ease` | `easeCubic` | Viewer |
| `d3-interpolate` | `interpolateObject` | Viewer |
| `d3-transition` | Selection `.transition()` and `.interrupt()` setup | Viewer, Layout, ColorPicker, Messenger |

The retained supporting packages are `d3-color`, `d3-dispatch`, `d3-drag`,
`d3-time`, and `d3-timer`. No rendered code remains from D3's axes, brush,
chords, contours, Delaunay, force, geographic, hierarchy, shape, chromatic,
CSV, fetch, or random modules.

`src/d3.js` is an unused historical inventory. It contains obsolete imports
such as `event` and incorrectly groups interpolation functions under
`d3-ease`; it must be corrected before being used as a real adapter.
`src/LayoutCircular.js` also imports `line` without calling it. The explicit
module experiment removes that import only in the generated build.

The production bundling change can be small: resolve packages into Rollup,
remove `d3` from `external` for the standalone target, and preserve package
side effects. This is the dependency inclusion pattern in the
[Rollup documentation](https://rollupjs.org/tools/#with-npm-packages).
The experiment's resolver is deliberately scoped to the locked local graph;
use the official `@rollup/plugin-node-resolve` plugin when promoting this to
the normal build. It is a build dependency and adds no browser download.

Do not set all D3 modules to side-effect-free. D3 explicitly
[installs transition and interrupt methods on the selection prototype](https://github.com/d3/d3-transition/blob/v3.0.1/src/selection/index.js),
and its [package metadata identifies the required side-effect modules](https://github.com/d3/d3-transition/blob/v3.0.1/package.json).
The experiment respects those declarations. Keeping every module's possible
side effects instead produced 393,520 bytes with the existing imports;
respecting the metadata reduced this to 338,808 bytes without changing CGView
source. Changing namespace imports is not the source of that saving.

The remaining dependencies and assets have different roles:

| Dependency or asset | Current role | Removal or bundling path |
| --- | --- | --- |
| `svgcanvas` (`^2.3.0`, locked to 2.3.0) | Declared runtime dependency, used only when the caller passes an SVG context; CGView does not currently import it | Bundle its `Context` implementation and make it the default. The experiment adds 22,231 bytes (21.71 KiB), or 7,441 gzipped bytes (7.27 KiB), on top of bundled D3. Removing it entirely requires dropping SVG export or maintaining an SVG drawing backend. An optional peer is another choice for a deliberately smaller build. |
| `cgview.css` | Viewer layering and color-picker styling, currently a separate file | Embed the styles once in the standalone entry. Adds 10,720 bytes (10.47 KiB), or 2,428 gzipped bytes (2.37 KiB), on top of D3 + SVG. No fonts, images, or stylesheets are fetched by this CSS. |
| `CGParse.min.js` | Optional GenBank/EMBL conversion in selected tutorials and the test page; not imported by CGView | Omit for JSON-based viewers, or add a parser-enabled bundle if file conversion is part of the desired single-file API. Its existing standalone asset is 61,971 bytes (60.52 KiB), or 15,920 gzipped bytes (15.55 KiB); this is not an incremental combined-bundle estimate. It is not included in this demonstration. |
| Bootstrap + Popper | Documentation/test-page interface | Keep outside the viewer. Removing from the docs would require rewriting the docs' layout and UI behavior, and would not shrink CGView. |
| Markdown-it + Prism | Documentation rendering and syntax highlighting | Keep outside the viewer. Build-time Markdown rendering and static highlighting could remove those browser scripts from the docs. |
| `@jsdoc/salty`, `jsdoc` | API documentation generation | Build tooling only; contributes no code to CGView. |
| Rollup, JSON plugin, Terser plugin | Build and minification | Build tooling only; replacing these does not remove viewer runtime dependencies. Existing peer warnings reflect older plugin declarations against Rollup 4; both builds succeeded. |
| Jest, es-jest, jest-canvas-mock, Playwright | Tests and browser verification | Development only; contributes no code to CGView. |
| Sequence extraction workers | Existing CGView source for feature and plot generation | Already serialized into blob workers from the bundle; no separate worker script is needed. |
| Color-picker SVG icons, browser canvas/DOM/download APIs | Existing source literals and browser facilities | Already self-contained; no icon/font package, jQuery, or download helper library is required by the viewer. |

Bundling removes consumers' separate script requirements, but the bundled code
remains third-party code that needs updates. To also reduce the npm dependency
graph, replace the `d3` umbrella dependency with the nine directly used D3
packages and update the source imports/adapter and lockfile. Their transitive
dependencies will still be installed. Simply moving them to devDependencies
would be incorrect while the published ESM file still imports external D3.

For eventually removing D3 code, start with `IO.formatDate`: there is one
fixed local-time pattern, `%Y-%m-%d %H:%M:%S`, which can use native Date getters
and padding. `toISOString()` would change the timezone semantics. Native
reductions can replace `min`, `max`, `sum`, and `mean` once empty, null, NaN,
and large-array behavior is specified. Median needs selection or sorting on a
copy so it does not mutate plot scores. None of these additional replacements
has been implemented or assigned a speculative byte saving here.

Removing D3's selection, zoom, and transition behavior would require a larger
rewrite of events, mouse/touch gestures, animation cancellation, and timing.
Replacing `scaleLinear` also needs care because the viewer exposes D3 scales
through its public API. Keep that work separate from bundling, which already
achieves the single-file goal while preserving the existing behavior.

Recommended next production step: add a supported standalone IIFE target
with bundled D3, an SVG context default, and embedded CSS, while retaining an
ESM target for application bundlers. Keep explicit `SVGContext` overrides.
The CSS injection approach needs a nonce or external-CSS option for consumers
whose Content Security Policy disallows inline styles. The experimental file
injects once per document and is intended for ordinary script-tag use; it is
not a final multi-version/shadow-DOM style integration design.

The docs and test harness should then be migrated deliberately. For example,
`docs/test/performance.js` independently uses global `d3.format`, and existing
SVG setup uses `svgcanvas.Context`. Those page-level calls must be updated
before their script tags can be removed. Include the new output in the normal
build/release flow and update installation examples when making it a supported
distribution. The demo is generated only by the analysis command so fresh
normal docs builds do not gain references to missing experimental assets.

To build and measure the current implementation from the repository root:

```bash
yarn gh-pages
node scripts/analyze-dependencies.mjs
node scripts/smoke-standalone.mjs
```

The normal Rollup command now creates core and standalone variants in `docs/dist`.
The analysis measures those files and records D3 usage and sizes in
`.agents/dependencies/sizes.json`. The standalone demo is a regular docs page.
The initial prototype also inspected retained-package source contributions;
those figures were before minification and must not be added as if they were
compressed costs.

Browser verification passed in Chromium: unchanged public exports, pixel-identical
circular and linear maps against the original build, animated zoom and
`stopAnimate()`, mouse zoom and pan, color-picker transitions, SVG and PNG export,
caller-supplied SVGContext, and both feature and plot extraction workers.
The standalone demo makes exactly one library request, without separate D3,
SVGCanvas, CSS, font, or map-data requests. Evidence is saved under
`.agents/dependencies/`, including `smoke-results.json`, `standalone.png`,
`standalone.svg`, and `export.png`.

The published docs symlink and its original homepage also passed the browser
check through a temporary loopback server serving that exact directory.
Anonymous requests to the public HTTPS URL return 401 from the sandbox's
existing authentication; authenticated HTTPS rendering was not verified.

The existing Jest suite has **227 passes and one failure** in
`test/FeatureLabelRenderer.test.js`, "truncates labels with an ellipsis only
when enabled". The same failure was reproduced in the untouched primary
`v1.9` checkout at the identical commit. No library or test source was changed
by this investigation. Verification here covers Chromium, not Safari or Firefox.
