import json from '@rollup/plugin-json';
import {terser} from 'rollup-plugin-terser';
import {bundleVariants, bundleFormats, bundleDependencies, bundleInput, bundledNotices, dependencySideEffects} from './scripts/build/bundles.mjs';

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

export default bundleVariants.map(variant => ({
  input: bundleInput(variant),
  external: variant.d3 ? [] : ['d3'],
  treeshake: {moduleSideEffects: dependencySideEffects},
  plugins: [json(), bundleDependencies(variant)],
  onwarn(warning, warn) {
    if (warning.code === 'UNRESOLVED_IMPORT') { throw new Error(warning.message); }
    warn(warning);
  },
  output: bundleFormats.map(({format, minified}) => ({
    file: `docs/dist/${variant.stem}${format === 'es' ? '.esm' : ''}${minified ? '.min' : ''}.js`,
    format,
    name: 'CGView',
    globals: {d3: 'd3'},
    plugins: minified ? [terser({numWorkers: 1})] : [],
    banner: chunk => (minified ? banner_license : banner_cgview) + bundledNotices(chunk),
    footer: format === 'iife' ? cgv_deprecation_warning : undefined,
    sourcemap: true,
  }))
}));
