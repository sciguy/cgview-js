CGView.js maintains a customized Jaguar template for JSDoc 4 in jaguarjs-jsdoc/.
Run yarn api from the repository root to regenerate docs/api.

Install dependencies only at the repository root. The template uses the root
package.json and yarn.lock; its own package.json only defines its CommonJS
module boundary and package metadata.

Edit jaguarjs-jsdoc/static/styles/jaguar.css directly. The old LESS/Grunt
workflow and the unused Dash template have been retired.

See jaguarjs-jsdoc/README.md for template maintenance details.
