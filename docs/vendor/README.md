# Shared browser assets

`yarn docs:assets` generates the Bootstrap, markdown-it, and Prism files in
`docs/scripts` and `docs/styles` from dependencies resolved by the root `yarn.lock`.
Do not edit those generated files. This directory retains their upstream licenses.

- Bootstrap: `bootstrap.min.css` and a JavaScript bundle of the separately
  installed Popper and Bootstrap, published at the existing `bootstrap.min.js`
  URL. Updating Popper's lockfile version updates the code shipped to browsers.
- Prism: markup, CSS, C-like, JavaScript, Bash, and JSON grammars, plus the line
  highlight and line number plugins used by the site and API.
- markdown-it: browser Markdown rendering, using the same 14.x package as JSDoc.
  `renderDocsMarkdown` in `docs/scripts/general.js` enables the trusted raw HTML
  used by viewers and controls and preserves the site's original heading IDs.

Marked and Gumshoe are no longer shipped. `marked-LICENSE.txt` credits the heading
normalization retained from Marked's slugger. The small `section-nav.js` script
tracks the home and documentation sidebars without an external dependency.

When editing page Markdown, indent fenced code inside its list item and leave a
blank line between a raw HTML section tag and Markdown content. Live tutorials
still assemble and run their checked-in JavaScript examples in the browser.

Source maps are omitted. Customize syntax colors in `docs/styles/general.css`.
Run `yarn docs:build` and `yarn docs:check` after updating the root packages.
