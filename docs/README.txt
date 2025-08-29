This directory contains the [CGView.js Homepage](http://js.cgview.ca).

Two steps are required to update the API:

- Run 'yarn api' to generate the API jsdoc pages.
- Update the the record tables (docs.html) with: 'ruby scripts/update_docs_tables.rb'.

Example Map JSON can be updated by running:

$ ./scripts/create_examples.sh

Note:
  - Local copies of D3 and Bootstrap are used for easier offline development


HTML tags in docs/tutorials:
  - When trying to have html tags in docs (e.g. <script>), they get parsed before generated into markdown.
  - First, use the ```html markdown
  - Then copy the actual HTML from the console
  - Paste into the docs
