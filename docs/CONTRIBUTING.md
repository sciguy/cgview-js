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

If needed, regenerate the API documentation from the JSDoc comments in the source code:

```bash
yarn api
```

## Pull Requests

Please keep pull requests focused and small when possible. Include a short description of the change and the reason for it. If your change affects behavior, documentation or tests should be updated as appropriate.

## Style

Follow the existing code style and project structure. Ensure all tests pass before opening a pull request.
