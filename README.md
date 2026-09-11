# [CGView.js](http://js.cgview.ca)

[![Pages Status](https://github.com/sciguy/cgview-js/actions/workflows/pages.yml/badge.svg)](https://github.com/sciguy/cgview-js/actions/workflows/pages.yml)
[![Tests Status](https://github.com/sciguy/cgview-js/actions/workflows/tests.yml/badge.svg)](https://github.com/sciguy/cgview-js/actions/workflows/tests.yml)
[![Last Commit](https://img.shields.io/github/last-commit/sciguy/CGView-js.svg)](https://github.com/sciguy/cgview-js/commits/main/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)
[![Docs](https://img.shields.io/badge/docs-available-blue)](https://js.cgview.ca)

[![npm version](https://img.shields.io/npm/v/cgview)](https://www.npmjs.com/package/cgview)
![bundle size](https://img.shields.io/bundlephobia/min/cgview)
[![jsDelivr hits](https://data.jsdelivr.com/v1/package/npm/cgview/badge)](https://www.jsdelivr.com/package/npm/cgview)
[![DOI](https://joss.theoj.org/papers/10.21105/joss.09930/status.svg)](https://doi.org/10.21105/joss.09930)

CGView.js is a <strong>C</strong>ircular <strong>G</strong>enome <strong>View</strong>ing
tool for visualizing and interacting with small genomes. 

## Citing CGView.js

Grant JR and Stothard P  
CGView.js: a JavaScript package for visualizing small genomes.  
Journal of Open Source Software, 2026, 11(122), 9930.  
[https://doi.org/10.21105/joss.09930](https://doi.org/10.21105/joss.09930)


## Resources

- [CGView.js Home](http://js.cgview.ca)
- [Tutorials](http://js.cgview.ca/tutorials)
- [Examples](http://js.cgview.ca/examples)
- [Documentation](http://js.cgview.ca/docs.html)

## Install

```bash
npm install cgview
```
See [Installation Instructions](http://js.cgview.ca/tutorials/tutorial-installation.html)
for additional ways to setup CGView.js.

The `v1.9-d3` Rollup build provides core and standalone variants. Run
`cgview-run yarn gh-pages` to produce a minified browser script and a readable
ES module for each, with source maps. Use `cgview.standalone.min.js` or
`cgview.standalone.esm.js` for one file with D3, SVG export, and CSS included.
See the [bundle filenames, requirements, and sizes](docs/bundles.md).

## Usage

```js
import * as CGView from 'cgview';
import 'cgview/dist/cgview.css';
 
cgv = new CGView.Viewer('#my-viewer', {
  height: 500,
  width: 500,
  sequence: {
    // The length of the sequence
    length: 1000
    // Or, you can provide a sequence
    // seq: 'ATGTAGCATGCATCAGTAGCTA...'
  }
});

// Draw the map
cgv.draw()
```

See the [tutorials](http://js.cgview.ca/tutorials/index.html) to learn how to add features and plots, including [how](https://js.cgview.ca/tutorials/tutorial-cgparse.html) to use [CGParse.js](https://parse.cgview.ca) to convert GenBank and EMBL files into maps.

## Development

Development uses the Node.js version in [`.nvmrc`](.nvmrc) (currently Node 24)
and Yarn Classic 1.22.22. CI reads the same version file. With
[nvm](https://github.com/nvm-sh/nvm) installed, run these commands from the checkout:

```bash
nvm install
nvm use
yarn install --frozen-lockfile
yarn gh-test --runInBand
yarn gh-pages
```

Run `nvm use` in each new shell before installing dependencies or running tests,
builds, documentation commands, or benchmarks. Automated shells must load nvm
explicitly and stop if runtime selection fails, for example:

```bash
. "${NVM_DIR:-$HOME/.nvm}/nvm.sh" --no-use &&
  nvm use &&
  yarn gh-test --runInBand
```

Use the selected runtime for dependency installation instead of bypassing
compatibility checks with `--ignore-engines`. This Node version is the development
toolchain target; browser use of the built CGView bundles does not require Node.

## License

CGView.js is distributed under the [Apache Version 2.0 License](https://github.com/sciguy/cgview-js/blob/main/LICENSE).


