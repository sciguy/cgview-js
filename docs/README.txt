This directory contains the [CGView.js Homepage](http://js.cgview.ca).

Run 'yarn docs:build' to regenerate the API and the record tables.
Run 'yarn docs:check' to check generated navigation, source links, local assets,
search, and mobile navigation using Playwright Chromium.

The individual generation commands are:

- Run 'yarn api' to generate the API jsdoc pages.
- Update the record tables (docs.html) with: 'ruby scripts/update_docs_tables.rb'.

API generation replaces the generated docs/api directory only after a successful
build. Edit template/jaguarjs-jsdoc for API layout and styling changes. All build
dependencies are installed from the repository root; there is no template install.

Example Map JSON can be updated by running:

$ ./scripts/create_examples.sh

Note:
  - Local copies of D3 and Bootstrap are used for easier offline development


HTML tags in docs/tutorials:
  - When trying to have html tags in docs (e.g. <script>), they get parsed before generated into markdown.
  - First, use the ```html markdown
  - Then copy the actual HTML from the console
  - Paste into the docs
