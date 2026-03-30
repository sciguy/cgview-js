import json from '@rollup/plugin-json';
import {terser} from 'rollup-plugin-terser';

const banner_license = `/*!
 * CGView.js – Interactive Circular Genome Viewer
 * Copyright © 2016–2026 Jason R. Grant
 * https://github.com/sciguy/cgview-js
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */`;

 const banner_cgview = '// +-------------------------------------------------------+\n// |             _____________    ___                      |\n// |            / ____/ ____/ |  / (_)__ _      __         |\n// |           / /   / / __ | | / / / _ \\ | /| / /         |\n// |          / /___/ /_/ / | |/ / /  __/ |/ |/ /          |\n// |          \\____/\\____/  |___/_/\\___/|__/|__/           |\n// +-------------------------------------------------------+\n'

 const cgv_deprecation_warning = `
(function () {
  var g = typeof globalThis !== 'undefined' ? globalThis : window;
  if (!g.CGV) {
    let warned = false;
    Object.defineProperty(g, 'CGV', {
      configurable: true,
      get() {
        if (!warned && typeof console !== 'undefined' && console.warn) {
          console.warn('[CGView] "CGV" is deprecated and will be removed in v1.9. Use "CGView" instead.');
          warned = true;
        }
        return g.CGView;
      },
      set(v) {
        if (!warned && console && console.warn) {
          console.warn('[CGView] Setting "window.CGV" is deprecated. Use "window.CGView".');
          warned = true;
        }
        g.CGView = v;
      }
    });
  }
})();
`;

export default {
  input: 'src/index.js',
  watch: true,
  external: ['d3', 'svgcanvas'],
  output: [
    {
      file: 'docs/dist/cgview.js',
      format: 'iife',
      name: 'CGView',
      globals: {d3: 'd3', svgcanvas: 'svgcanvas'},
      banner: banner_cgview,
      footer: cgv_deprecation_warning,
      sourcemap: true,
    },
    {
      file: 'docs/dist/cgview.min.js',
      format: 'iife',
      name: 'CGView',
      globals: {d3: 'd3', svgcanvas: 'svgcanvas'},
      plugins: [terser()],
      banner: banner_license,
      footer: cgv_deprecation_warning,
      sourcemap: true,
    },
    {
      file: 'docs/dist/cgview.esm.min.js',
      format: 'es',
      globals: {d3: 'd3', svgcanvas: 'svgcanvas'},
      plugins: [terser()],
      banner: banner_license,
      sourcemap: true,
    },
    {
      file: 'docs/dist/cgview.esm.js',
      globals: {d3: 'd3', svgcanvas: 'svgcanvas'},
      format: 'es',
      banner: banner_cgview,
      sourcemap: true,
    },
  ],
  plugins: [ json() ]
};


