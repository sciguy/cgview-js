# Documentation modernization follow-ups

Dependency cleanup was committed as 24bc73e. Native API navigation, literal search,
shared Bootstrap/Prism assets, and light/dark/system themes are implemented in the
following stage. The customized Jaguar layout and API URLs are preserved.

Remaining follow-ups:
- Review existing broken links in API descriptions. A fresh baseline generation
  already contained these problems before the tooling changes:
  - Retired/undocumented properties such as favorite, onlyDrawFavorites,
    alternateColor, meta, source, strand, scores, popovers, and showMetaData.
  - References to the private Label class, tutorial-meta.html, lowercase
    plot.html, IO.loadJson, Viewer.update, Viewer.updateCaptions,
    Viewer.removeCaptions, Canvas.scale, and C#remove.
  - Check Box.color, Legend.font, Sequence.name, and Bookmark.bbOffset references.
- Address remaining library and build/test dependency alerts separately,
  including the d3-color runtime dependency.
- Review the remaining shared vendored assets separately, including Marked 2.1.2
  and Gumshoe 5.1.2. The clean documentation dependency audit covers the declared
  JSDoc/Salty/Playwright/Bootstrap/Popper/Prism trees, not these older copies or the
  example viewers' D3/CGParse dependencies.

Source-page line anchors are created in the browser by highlight.js; their
absence in static HTML is expected and is covered by the browser checks.

The library suite has one existing failure: FeatureLabelRenderer's
"truncates labels with an ellipsis only when enabled" test reads metrics.text
when metrics is undefined. The same failure was reproduced from unchanged HEAD
with the original dependencies in an isolated temporary directory. The remaining
181 tests pass with the documentation dependency updates.
