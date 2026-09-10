# Contributing

Thanks for your interest in contributing to CGView.js.

## Issues

Please use GitHub Issues to report bugs, request features, or ask questions. When reporting a bug, include a clear description, steps to reproduce, and any relevant example data or screenshots.

Please open an issue to discuss larger changes before starting work.

## Development

Install dependencies:

```bash
yarn install
```

Start the build watcher:

```bash
yarn build
```

This runs in watch mode and builds the files in `docs/dist` from the source files in `src`. To preview changes locally, open [`docs/test/index.html`](test/index.html) in a browser. Reload the page after each build to see the updated viewer.

Run the test suite:

```bash
yarn test
```

This command also runs in watch mode.

### Performance benchmarks

Use the Node.js version in `.nvmrc`. The first benchmark run also requires the
Playwright Chromium browser and its operating-system dependencies:

```bash
yarn benchmark:install
```

Run the browser benchmark:

```bash
yarn benchmark
```

Compare the working tree with a Git revision:

```bash
yarn benchmark:compare HEAD
```

Use `HEAD` to benchmark uncommitted work against the current commit, `HEAD^` to
compare a committed change with its parent, or another ref such as `main`. The
helper builds both revisions using the installed dependencies and removes its
temporary baseline worktree when finished.

The command builds CGView, measures fast and full draws for small, medium
contig, and large maps at several zoom levels, prints median and p90 timings,
and writes raw JSON results under `.benchmark-results`. The medium contig map is
measured in both circular and linear formats. Benchmark scenarios can define
nested `mapOverrides` in `scripts/benchmark.mjs`; these values are merged into
the fixture before it is loaded, allowing new settings to be measured without
changing the fixture. Pull requests run the same benchmark against the base and
candidate revisions on one GitHub Actions runner. Pushes to `main` compare the
new revision with the previous main revision. Performance flags are informational
while normal runner variance is being established.

### Documentation

Build the CGView bundles, shared browser assets, API, and record tables:

```bash
yarn docs:build
```

This uses Node.js 24 and Ruby (standard library only). To regenerate the API and
shared browser assets without rebuilding CGView:

```bash
yarn api
```

API generation replaces `docs/api` only after a successful build, removing stale
generated pages and assets. Edit the templates in `template/jaguarjs-jsdoc`, not
the generated files. The template's `static/styles/jaguar.css` is the authoritative
API stylesheet; it no longer has a LESS or Grunt build.

The site's sun/moon toggle uses the palette in `docs/styles/general.css`.
The initial theme follows the operating system until a visitor toggles it;
the chosen light or dark preference is stored as `cgview-docs-theme` in local storage.
Map colors remain controlled by each example's CGView configuration.

Bootstrap, Popper, and Prism are root development dependencies. `yarn docs:assets`
copies Bootstrap's CSS, bundles Bootstrap with the installed Popper version, and
assembles the Prism languages/plugins used by the site. Their licenses are copied
to `docs/vendor`. Update packages in
the root, regenerate, and review the browser checks instead of editing these
generated assets. Custom Prism colors belong in `general.css`.

Check generated navigation, API source links, local assets, literal search,
keyboard and mobile navigation, themes, and shared example pages in Chromium:

```bash
yarn playwright install --with-deps chromium # First run only, if not already installed
yarn docs:check
```

The browser checks use a temporary local server and block external analytics and
CDN requests. Handwritten links in API descriptions require a separate content
review. CI runs documentation generation and checks on pushes and pull requests,
and the Pages workflow regenerates and checks documentation before publishing.

## Pull Requests

Please keep pull requests focused and small when possible. Include a short description of the change and the reason for it. If your change affects behavior, documentation or tests should be updated as appropriate.

## Style

Follow the existing code style and project structure. Ensure all tests pass before opening a pull request.
