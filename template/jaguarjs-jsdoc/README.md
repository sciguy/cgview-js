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
- `static/scripts/` contains scripts copied into the generated API.
- `../jsdoc_conf.json` controls source discovery and template options.
- Shared navigation styles and scripts live in `../../docs/styles/` and
  `../../docs/scripts/`.

Regenerate the API after template or static asset changes. Edit the sources here,
not the generated copies under `docs/api`.

## Attribution

The original template is copyright 2013 Sangmin, Shim and is distributed under
the MIT license. Preserve [LICENSE](LICENSE) with the customized template.
