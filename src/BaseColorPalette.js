//////////////////////////////////////////////////////////////////////////////
// Semantic sequence base colors
//////////////////////////////////////////////////////////////////////////////

/**
 * CGView.js – Interactive Circular Genome Viewer
 * Copyright © 2016–2026 Jason R. Grant
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
 */

/** Palette variants selected from the rendered backbone luminance. */
export const BASE_COLOR_VARIANTS = Object.freeze(['onLight', 'onDark']);

/** Semantic entries required by each base-color palette. U uses the T entry. */
export const BASE_COLOR_KEYS = Object.freeze(['A', 'C', 'G', 'T', 'ambiguous']);

/**
 * Restrained semantic nucleotide colors based on the behavior introduced in
 * paul-cgview-js commit 4a4bb32. Each variant retains the same base-to-hue
 * mapping while remaining legible on light or dark backbones.
 */
export const DEFAULT_BASE_COLORS = Object.freeze({
  onLight: Object.freeze({
    A: '#15803d',
    C: '#1d4ed8',
    G: '#a16207',
    T: '#b91c1c',
    ambiguous: '#475569',
  }),
  onDark: Object.freeze({
    A: '#4ade80',
    C: '#60a5fa',
    G: '#fbbf24',
    T: '#f87171',
    ambiguous: '#cbd5e1',
  }),
});

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const colorValue = (color) => color?.toString() === 'Color' ? color.rgbaString : color;

/**
 * Copy recognized base-color palette entries into a JSON-safe object.
 *
 * @param {Object} [baseColors={}] - Complete or partial base-color palettes.
 * @returns {Object} A detached copy containing only supported variants and keys.
 * @example
 * copyBaseColors({onLight: {A: '#008000'}});
 */
export const copyBaseColors = (baseColors = {}) => BASE_COLOR_VARIANTS
  .reduce((copy, variant) => {
    const palette = baseColors?.[variant];
    if (!palette || typeof palette !== 'object' || Array.isArray(palette)) {
      return copy;
    }
    const paletteCopy = BASE_COLOR_KEYS.reduce((colors, key) => {
      if (hasOwn(palette, key) && palette[key] !== undefined) {
        colors[key] = colorValue(palette[key]);
      }
      return colors;
    }, {});
    if (Object.keys(paletteCopy).length) {
      copy[variant] = paletteCopy;
    }
    return copy;
  }, {});

/**
 * Deeply merge partial base-color palettes without modifying either input.
 *
 * @param {Object} baseColors - Base palettes supplying fallback values.
 * @param {Object} overrides - Complete or partial palette overrides.
 * @returns {Object} Detached merged palettes.
 * @example
 * mergeBaseColors(DEFAULT_BASE_COLORS, {onLight: {A: '#006400'}});
 */
export const mergeBaseColors = (baseColors, overrides = {}) => {
  const merged = copyBaseColors(baseColors);
  const overrideCopy = copyBaseColors(overrides);
  BASE_COLOR_VARIANTS.forEach((variant) => {
    if (overrideCopy[variant]) {
      merged[variant] = {...(merged[variant] || {}), ...overrideCopy[variant]};
    }
  });
  return merged;
};

/**
 * Return whether a complete or partial palette contains any supported color.
 *
 * @param {Object} baseColors - Base-color palettes to inspect.
 * @returns {Boolean} True when at least one supported color is present.
 */
export const hasBaseColors = (baseColors) => BASE_COLOR_VARIANTS.some((variant) => (
  BASE_COLOR_KEYS.some((key) => baseColors?.[variant]?.[key] !== undefined)
));

/**
 * Resolve a sequence character to its semantic color. U shares T's color and
 * all other IUPAC, gap, placeholder, or unknown characters are ambiguous.
 *
 * @param {Object} baseColors - Complete onLight and onDark palettes.
 * @param {String} base - Sequence character to color.
 * @param {'onLight'|'onDark'} variant - Palette variant to use.
 * @returns {*} The configured color value.
 * @example
 * colorForBase(DEFAULT_BASE_COLORS, 'U', 'onDark');
 */
export const colorForBase = (baseColors, base, variant) => {
  const character = String(base || '').toUpperCase();
  const key = character === 'U' ? 'T' : (
    ['A', 'C', 'G', 'T'].includes(character) ? character : 'ambiguous'
  );
  return baseColors?.[variant]?.[key];
};
