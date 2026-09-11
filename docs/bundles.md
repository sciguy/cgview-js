CGView bundle variants

The normal Rollup build provides two variants: core and standalone. Each has a
minified browser script and a readable ES module. Together with four source
maps and the separate stylesheet, the distribution contains nine files.

| File | Purpose |
| --- | --- |
| `cgview.min.js` | Core browser script, exporting global `CGView` |
| `cgview.esm.js` | Core ES module with named exports |
| `cgview.standalone.min.js` | Complete browser script, exporting global `CGView` |
| `cgview.standalone.esm.js` | Complete ES module with named exports |
| `cgview.css` | Stylesheet for the core builds |
| `cgview.min.js.map` | Source map for the core browser script |
| `cgview.esm.js.map` | Source map for the core ES module |
| `cgview.standalone.min.js.map` | Source map for the standalone browser script |
| `cgview.standalone.esm.js.map` | Source map for the standalone ES module |

Run these commands from the checkout:

```bash
cgview-run yarn gh-pages
cgview-run node scripts/analyze-dependencies.mjs
```

The first command writes the JavaScript files and maps into `docs/dist`, next
to the tracked `cgview.css`. The second measures those exact outputs; it does
not rebuild or substitute source. `cgview-run yarn build` watches the same
configurations, including embedded CSS changes. Application bundlers can
minify the readable ES modules.

| Browser build | D3 bundled | SVG bundled | CSS embedded | Minified KiB | Gzip KiB |
| --- | --- | --- | --- | ---: | ---: |
| Core | no | no | no | 260.87 | 70.99 |
| Standalone | yes | yes | yes | 363.33 | 104.06 |

Sizes were measured on 11 September 2026 using the locked dependencies, with
gzip level 9. KiB means 1,024 bytes. JavaScript sizes include license notices
and source-map references; separate `.map` files are excluded. Measurements
for both browser scripts and both ES modules are saved in
`.agents/dependencies/sizes.json`.

Core is intended for existing integrations and applications that manage their
own assets. Its browser script requires a separately loaded global `d3`; its
ES module keeps `import ... from 'd3'` and requires a bundler or browser import
map. Include `cgview.css` separately. To use SVG export, supply an `SVGContext`
constructor when creating the viewer. CGView's SVG export methods remain
available in the core build.

Standalone contains the D3 code CGView uses, SVGCanvas's Context implementation,
and CGView's styles. `viewer.io.getSVG()` works without additional setup. It
preserves a caller-supplied `SVGContext` override. Bundled D3 and SVGCanvas do
not create global `d3` or `svgcanvas` objects for application code.

Loading either standalone format installs the viewer stylesheet once per
document. Identical styles share a content-based identifier, including across
the two formats. A browser script's nonce is copied to the injected style
node. ES modules do not have `document.currentScript`; applications that
require a nonce for styles can use core and load the stylesheet through their
usual CSP setup.

For a single browser script with everything included:

```html
<div id="map"></div>
<script src="dist/cgview.standalone.min.js"></script>
<script>
  const viewer = new CGView.Viewer('#map', {
    width: 600,
    height: 600,
    sequence: {length: 10000}
  });
  viewer.draw();
</script>
```

For the same inclusion choices as an ES module:

```js
import {Viewer} from './dist/cgview.standalone.esm.js';

const viewer = new Viewer('#map', {sequence: {length: 10000}});
viewer.draw();
```

The [standalone demo](test/standalone.html) uses one library request for D3,
SVG export, and styles. The genome data and the page's controls are defined
in the HTML. Other scripts in the existing docs/test harness may use global
D3 independently, so changing their CGView bundle does not automatically
remove the need for their D3 script tag.

The configuration uses Rollup's
[multiple configuration and output support](https://rollupjs.org/command-line-interface/#configuration-files).
Shared variant and format definitions live in `scripts/build/bundles.mjs`.
The hooks use Node's resolver for the current ESM dependency graph, respect
package side-effect metadata, and preserve D3's transition setup. SVGCanvas
2.x is bundled from its shipped ESM Context source. CommonJS packages or
packages requiring different browser resolution conditions would need a
resolver update or the corresponding Rollup plugins. No dependency was
installed or upgraded for this change.

Bundled packages' complete license notices are included in every output that
contains their code. `src/SVGContext.js` supplies the core build's empty
default; Rollup resolves it to SVGCanvas for standalone. Viewer source text
is not rewritten during the build.

Verify both variants with:

```bash
cgview-run node scripts/smoke-standalone.mjs /home/jason/www/cgview-worktrees/v1.9-d3
```

Chromium checks cover all four outputs: imports, source maps, bundled
inclusion, notices, public exports, pixel-identical circular and linear maps,
animations, SVG export/defaults/overrides, and embedded styles. The standalone
demo also checks mouse interactions, color-picker transitions, SVG/PNG exports,
and feature/plot workers. The existing Jest suite last reported 227 passes
and the pre-existing label truncation failure recorded in the
[dependency audit](dependency-audit.md).

These standalone builds are part of the unreleased 1.9 development work.
They are available from a local build and have not been published to npm or
an official release. The [installation tutorial](tutorials/tutorial-installation.html)
also documents the existing published builds.
