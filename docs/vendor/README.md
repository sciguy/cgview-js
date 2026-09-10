# Shared browser assets

`yarn docs:assets` generates the Bootstrap and Prism files in `docs/scripts` and
`docs/styles` from dependencies resolved by the root `yarn.lock`. Do not edit
those generated files. This directory retains their upstream licenses.

- Bootstrap: `bootstrap.min.css` and a JavaScript bundle of the separately
  installed Popper and Bootstrap, published at the existing `bootstrap.min.js`
  URL. Updating Popper's lockfile version updates the code shipped to browsers.
- Prism: markup, CSS, C-like, JavaScript, Bash, and JSON grammars, plus the line
  highlight and line number plugins used by the site and API.

Source maps are omitted. Customize syntax colors in `docs/styles/general.css`.
Run `yarn docs:build` and `yarn docs:check` after updating the root packages.
