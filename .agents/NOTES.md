# Documentation modernization follow-ups

The dependency cleanup preserves the customized Jaguar layout. Follow-on stages:

- Replace Jaguar's jQuery navigation/search script with native DOM code and
  literal search, then remove unused browser assets. Review whether clearing a
  search restores individual member links as well as class sections.
- Convert API and shared site colors to CSS variables, update Bootstrap, and add
  a shared light/dark/system preference.
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

Source-page line anchors are created in the browser by linenumber.js; their
absence in static HTML is expected and is covered by the browser checks.

The library suite has one existing failure: FeatureLabelRenderer's
"truncates labels with an ellipsis only when enabled" test reads metrics.text
when metrics is undefined. The same failure was reproduced from unchanged HEAD
with the original dependencies in an isolated temporary directory. The remaining
181 tests pass with the documentation dependency updates.
