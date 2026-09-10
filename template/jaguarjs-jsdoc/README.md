# CGView JSDoc template

CGView maintains this customized version of
[Jaguar.js's JSDoc template](https://github.com/davidshimjs/jaguarjs-jsdoc).
It keeps Jaguar's API layout and integrates CGView's navigation, shared site
styles, and API quick links.

## Building

Install dependencies from the repository root with `yarn install --frozen-lockfile`,
then run `yarn api`. All build dependencies are declared in the root `package.json`
and resolved by the root `yarn.lock`. This directory has no separate installation.

The local `package.json` keeps `publish.js` in CommonJS mode inside CGView's
ES module repository. Keep that package boundary when changing the template.

## Editing

- `publish.js` prepares JSDoc's Salty doclet collection and generates API pages.
- `tmpl/` contains the page templates. The `cgv_*` partials integrate the site
  navigation, and `mainpage.tmpl` defines the API quick links.
- `static/styles/jaguar.css` is the authoritative API stylesheet. Edit it directly;
  the original LESS sources and Grunt build have been retired.
- `static/scripts/main.js` implements native API navigation and literal search.
- `static/scripts/highlight.js` uses the shared Prism highlighter and preserves
  source URLs such as `Viewer.js.html#line500`.
- `../jsdoc_conf.json` controls source discovery and template options.
- Shared navigation styles and scripts live in `../../docs/styles/` and
  `../../docs/scripts/`.

Regenerate the API after template or static asset changes. Edit the sources here,
not the generated copies under `docs/api`. API descriptions and record attribute
tables come from JSDoc comments in `../../src/`; run `yarn docs:build` after editing
them to update both the API and the tables in `../../docs/docs.html`.

## Themes and browser assets

The sun/moon toggle is shared with the documentation site. The initial theme
follows the operating system until a visitor chooses light or dark mode.
`../../docs/scripts/theme.js` applies the preference before styles load and adds
the control to the navbar. Edit the shared `--docs-*` colors in
`../../docs/styles/general.css` and use those variables in `jaguar.css`.

Bootstrap and Prism are generated from root development dependencies by
`../../scripts/build-docs-assets.mjs`; `yarn api` runs that step automatically.
`yarn docs:build` also builds CGView and updates the record tables, and
`yarn docs:check` checks browser behavior and local links and assets throughout
the generated API, handwritten documentation, tutorials, and examples. It checks
rendered Markdown fragments, source-line links, and JSON property ranges, and
verifies that the JSON reference sample parses and loads. External websites are
not checked.

The old jQuery, Underscore, Bootstrap 3, Prettify, icon font, Disqus, and Google
Analytics integrations have been retired. The site's Plausible integration
remains active.

## Attribution

The original template is copyright 2013 Sangmin, Shim and is distributed under
the MIT license. Preserve [LICENSE](LICENSE) with the customized template.
