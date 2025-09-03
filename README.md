# [CGView.js](http://js.cgview.ca)

[![Pages Status](https://github.com/sciguy/cgview-js/actions/workflows/pages.yml/badge.svg)](https://github.com/sciguy/cgview-js/actions/workflows/pages.yml)
[![Tests Status](https://github.com/sciguy/cgview-js/actions/workflows/tests.yml/badge.svg)](https://github.com/sciguy/cgview-js/actions/workflows/tests.yml)
[![Last Commit](https://img.shields.io/github/last-commit/sciguy/CGView-js.svg)](https://github.com/sciguy/cgview-js/commits/main/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)
[![Docs](https://img.shields.io/badge/docs-available-blue)](https://js.cgview.ca)

[![npm version](https://img.shields.io/npm/v/cgview)](https://www.npmjs.com/package/cgview)
![bundle size](https://img.shields.io/bundlephobia/min/cgview)
[![Min+Gzip](https://img.shields.io/bundlephobia/minzip/cgview)](https://bundlephobia.com/package/cgview)
[![jsDelivr hits](https://data.jsdelivr.com/v1/package/npm/cgview/badge)](https://www.jsdelivr.com/package/npm/cgview)

CGView.js is a <strong>C</strong>ircular <strong>G</strong>enome <strong>View</strong>ing
tool for visualizing and interacting with small genomes. 

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

## License

CGView.js is distrubuted under the [Apache Version 2.0 License](https://github.com/sciguy/cgview-js/blob/main/LICENSE).




