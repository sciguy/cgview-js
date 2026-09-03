//////////////////////////////////////////////////////////////////////////////
// Color
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

import utils from './Utils';

/**
 * The Color class is meant to represent a color and opacity in a consistant manner
 * Colors are stored internally as an RGBA string (CSS/Canvas compatible) for quick access.
 * The color can be provided or generated in the following formats:
 *
 * ### String
 *
 * Type    | Example
 * --------|--------
 * RGB     | 'rgb(100, 100, 240)'
 * RGBA    | 'rgba(100, 100, 240, 0.5)'
 * HEX     | '#FF8833' or '#F83'
 * Name    | 'black' (Browser supported color names [List](http://www.w3schools.com/colors/colors_names.asp))
 * HSL     | not implemented yet
 * HSLA    | not implemented yet
 *
 *
 * ### Object
 *
 * Type    | Example
 * --------|--------
 * RGB     | {r: 100, g: 100, b: 100}
 * RGBA    | {r: 100, g: 100, b: 100, a: 0.5}
 * HSV     | {h:240, s: 50, v: 30}
 *
 * To set the color using any of the above formats, use the [setColor]{@link Color#setColor} method.
 */
class Color {

  /**
   * Create a Color using a string or object as described above.
   * @param {(String|Object)} color - A color string or object.
   */
  constructor(color) {
    this.setColor(color);
  }

  /**
   * Return the class name as a string.
   * @return {String} - 'Color'
   */
  toString() {
    return 'Color';
  }

  /**
   * Set the color using a color string (e.g RGB, RGBA, Hex, HLA) or a color object (e.g. RGB, RGBA, HSV)
   * as described above.
   * @param {(String|Object)} - A color string or object
   */
  setColor(color) {
    if (typeof color === 'string' || color instanceof String) {
      this._string = color;
    } else if (color.toString() === 'Color') {
      this._string = color.rgbaString;
    } else {
      const keys = Object.keys(color);
      if (keys.includes('h') && keys.includes('s') && keys.includes('v')) {
        this.hsv = color;
      } else if (keys.includes('r') && keys.includes('g') && keys.includes('b') && keys.includes('a')) {
        this.rgba = color;
      } else if (keys.includes('r') && keys.includes('g') && keys.includes('b')) {
        this.rgb = color;
      }
    }
  }

  /**
   * Set the color using, RGB, RGBA, Hex, etc String
   * @private
   */
  set _string(value) {
    const rgba = Color.string2rgba(value, this.opacity);
    this._rgbaString = Color.rgba2String(rgba);
    this._updateOpacityFromRgba();
  }


  /**
   * @member {Number} - Get or set the opacity (alpha) of the color.
   */
  get opacity() {
    return (this._opacity === undefined) ? 1 : this._opacity;
  }

  set opacity(value) {
    this._opacity = Color._validateOpacity(value);
    this._updateRgbaOpacity();
  }

  /**
   * @member {String} - Return the color as an RGBA string.
   */
  get rgbaString() {
    return this._rgbaString;
  }

  /**
   * @member {String} - Return the color as an RGB string.
   */
  get rgbString() {
    return Color.rgb2String(this.rgb);
  }

  /**
   * @member {Object} - Get or set the color using a RGB object.
   */
  get rgb() {
    const result = /^rgba\((\d+),(\d+),(\d+)/.exec(this.rgbaString);
    return result ? { r: Number(result[1]), g: Number(result[2]), b: Number(result[3]) } : undefined;
  }

  set rgb(value) {
    this._string = Color.rgb2String(value);
    this._updateOpacityFromRgba();
  }

  /**
   * @member {Object} - Get or set the color using a RGBA object.
   */
  get rgba() {
    const result = /^rgba\((\d+),(\d+),(\d+),([\d.]+)/.exec(this.rgbaString);
    return result ? { r: Number(result[1]), g: Number(result[2]), b: Number(result[3]), a: Number(result[4]) } : undefined;
  }

  set rgba(value) {
    this._string = Color.rgba2String(value);
    this._updateOpacityFromRgba();
  }

  /**
   * @member {Object} - Get or set the color using a HSV object.
   */
  get hsv() {
    return Color.rgb2hsv(this.rgb);
  }

  set hsv(value) {
    const rgba = Color.hsv2rgb(value);
    rgba.a = this.opacity;
    this.rgba = rgba;
  }

  /**
   * NIY
   * @private
   */
  get hex() {
    return Color.rgb2hex(this.rgb);
  }

  /**
   * @member {Object} - Get or set the color using a HSL object.
   * @private
   */
  get hsl() {
    return Color.rgb2hsl(this.rgb);
  }

  set hsl(value) {
    const rgba = Color.hsl2rgb(value);
    rgba.a = this.opacity;
    this.rgba = rgba;
  }

  /**
   * Returns a copy of this color object
   */
  copy() {
    return new Color(this.rgbaString);
  }

  /**
   * Return the WCAG relative luminance of this color. Opacity is not included;
   * use {@link Color#compositeOver} first when evaluating a translucent color.
   * @return {Number} Relative luminance between 0 (black) and 1 (white).
   */
  get relativeLuminance() {
    const rgb = this.rgb;
    const linearChannel = value => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    };
    return (0.2126 * linearChannel(rgb.r)) +
      (0.7152 * linearChannel(rgb.g)) +
      (0.0722 * linearChannel(rgb.b));
  }

  /**
   * Return the color produced by drawing this color over a background color.
   * Neither input color is modified.
   * @param {(Color|String|Object)} background - Background color.
   * @return {Color} The alpha-composited color.
   */
  compositeOver(background) {
    const backgroundColor = background?.toString() === 'Color' ? background : new Color(background);
    const foregroundRgba = this.rgba;
    const backgroundRgba = backgroundColor.rgba;
    const alpha = foregroundRgba.a + (backgroundRgba.a * (1 - foregroundRgba.a));
    if (alpha === 0) { return new Color('rgba(0,0,0,0)'); }
    const component = name => Math.round(
      ((foregroundRgba[name] * foregroundRgba.a) +
       (backgroundRgba[name] * backgroundRgba.a * (1 - foregroundRgba.a))) / alpha
    );
    return new Color({
      r: component('r'),
      g: component('g'),
      b: component('b'),
      a: alpha,
    });
  }

  /**
   * Calculate the WCAG contrast ratio between this color and another color.
   * @param {(Color|String|Object)} color - Color to compare.
   * @return {Number} Contrast ratio between 1 and 21.
   */
  contrastRatio(color) {
    const otherColor = color?.toString() === 'Color' ? color : new Color(color);
    const lighter = Math.max(this.relativeLuminance, otherColor.relativeLuminance);
    const darker = Math.min(this.relativeLuminance, otherColor.relativeLuminance);
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Choose whichever of two text colors has greater contrast against this
   * color. Black and white are used by default.
   * @param {(Color|String|Object)} darkColor - Dark text candidate.
   * @param {(Color|String|Object)} lightColor - Light text candidate.
   * @return {Color} A copy of the higher-contrast candidate.
   */
  contrastColor(darkColor = 'black', lightColor = 'white') {
    const dark = darkColor?.toString() === 'Color' ? darkColor : new Color(darkColor);
    const light = lightColor?.toString() === 'Color' ? lightColor : new Color(lightColor);
    const color = this.contrastRatio(dark) >= this.contrastRatio(light) ? dark : light;
    return color.copy();
  }

  /**
   * Returns true if this color has the same value as the provided color
   * @param {Color} color - This color to compare with
   * @param {Boolean} ignoreAlpha - Should opacity be considered in the comparison
   */
  equals(color, ignoreAlpha = false) {
    const rgb1 = this.rgba;
    const rgb2 = color.rgba;
    if (ignoreAlpha) {
      return (rgb1.r === rgb2.r) && (rgb1.g === rgb2.g) && (rgb1.b === rgb2.b);
    } else {
      return (rgb1.r === rgb2.r) && (rgb1.g === rgb2.g) && (rgb1.b === rgb2.b) && (rgb1.a === rgb2.a);
    }
  }

  /**
   * Tests if this color in the provided array of colors
   * @param {Array} colors - List of colors for the comparison
   * @param {Boolean} ignoreAlpha - Should opacity be considered in the comparison
   * @private
   */
  inArray(colors, ignoreAlpha) {
    let present = false;
    for (const color of colors) {
      if (this.equals(color, ignoreAlpha)) {
        present = true;
        break;
      }
    }
    return present;
  }

  /**
   * Alters the color. Useful for highlighting.
   * @param {Number} colorAdjustment - Amount to change the color by
   * @private
   */
  highlight(colorAdjustment = 0.25) {
    const hsv = this.hsv;
    hsv.v += (hsv.v < 0.5) ? colorAdjustment : -colorAdjustment;
    this.hsv = hsv;
  }

  /**
   * Lightens the color.
   * @param {Number} fraction - Amount to lighten the color by
   * @private
   */
  lighten(fraction) {
    const hsl = this.hsl;
    hsl.l += utils.constrain(fraction, 0, 1);
    hsl.l = Math.min(hsl.l, 1);
    this.hsl = hsl;
    return this;
  }

  /**
   * Darkens the color.
   * @param {Number} fraction - Amount to darken the color by
   * @private
   */
  darken(fraction) {
    const hsl = this.hsl;
    hsl.l -= utils.constrain(fraction, 0, 1);
    hsl.l = Math.max(hsl.l, 0);
    this.hsl = hsl;
    return this;
  }

  /**
   * Inverts the color
   */
  invert() {
    const rgb = this.rgb;
    this.rgb = {
      r: 255 - rgb.r,
      g: 255 - rgb.g,
      b: 255 - rgb.b
    };
    return this;
  }


  /**
   * Update the internal RGBA String using the current opacity property.
   * @private
   */
  _updateRgbaOpacity() {
    this._rgbaString = this._rgbaString.replace(/^(rgba\(.*,)([\d.]+?)(\))/, (m, left, opacity, right) => {
      return left + this.opacity + right;
    });
  }

  /**
   * Update the the opacity property using the value in the internal RGBA string
   * @private
   */
  _updateOpacityFromRgba() {
    const result = /^rgba.*,([\d.]+?)\)$/.exec(this.rgbaString);
    if (result) {
      this._opacity = Color._validateOpacity(result[1]);
    }
  }

}

/**
 * Convert a legal color string to RGBA. See http://www.w3schools.com/cssref/css_colors_legal.asp
 * @function string2rgba
 * @memberof Color
 * @param {String} value - *value* can be a hexidecimal, HSL, RGB, RGBA, or a color name.
 * @param {Number} opacity - a number between 0 and 1.
 * @return {String} The color as an RGBA object.
 * @static
 * @private
 */
Color.string2rgba = function(value, opacity = 1) {
  if ( /^#/.test(value) ) {
    return Color.hexString2rgba(value, opacity);
  } else if ( /^rgb\(/.test(value) ) {
    return Color.rgbString2rgba(value, opacity);
  } else if ( /^rgba\(/.test(value) ) {
    return Color.rgbaString2rgba(value, opacity);
  } else if ( /^hsl\(/.test(value) ) {
    return Color.hslStringToRgba(value, opacity);
  } else {
    const hex = Color.name2HexString(value);
    return Color.hexString2rgba(hex, opacity);
  }
};

/**
 * Validate that the opacity is between 0 and 1.
 * @private
 */
Color._validateOpacity = function(value) {
  value = Number(value);
  if (isNaN(value)) {
    value = 1;
  } else if (value > 1) {
    value = 1;
  } else if (value < 0) {
    value = 0;
  }
  return value;
};

/**
 * Validate that the RGBA color components are between 0 and 255. Also validate the opacity.
 * @private
 */
Color._validateRgba = function(value) {
  return {
    r: Color._validateRgbNumber(value.r),
    g: Color._validateRgbNumber(value.g),
    b: Color._validateRgbNumber(value.b),
    a: Color._validateOpacity(value.a)
  };
};

/**
 * Validate that the number is between 0 and 255.
 * @private
 */
Color._validateRgbNumber = function(value) {
  value = Number(value);
  if (isNaN(value)) {
    value = 0;
  } else if (value > 255) {
    value = 255;
  } else if (value < 0) {
    value =  0;
  }
  return value;
};

/**
 * Convert an RGB string to an RGBA object
 * @function rgbString2rgba
 * @memberof Color
 * @param {String} rgbString - *rgbString* should take the form of 'rgb(red,green,blue)', where red, green and blue are numbers between 0 and 255.
 * @param {Number} opacity - a number between 0 and 1.
 * @return {String} The color as an RGBA object.
 * @static
 * @private
 */
Color.rgbString2rgba = function(rgbString, opacity = 1) {
  rgbString = rgbString.replace(/ +/g, '');
  const result = /^rgb\((\d+),(\d+),(\d+)\)/.exec(rgbString);
  return result ? { r: Number(result[1]), g: Number(result[2]), b: Number(result[3]), a: opacity } : undefined;
};

/**
 * Convert an RGBA String color to RGBA.
 * @function rgbString2rgba
 * @memberof Color
 * @param {String} rgbaString - *rgbaString* should take the form of 'rgb(red,green,blue, alpha)', where red, green and blue are numbers between 0 and 255.
 * @return {String} The color as RGBA.
 * @static
 * @private
 */
Color.rgbaString2rgba = function(rgbaString) {
  rgbaString = rgbaString.replace(/ +/g, '');
  const result = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)/.exec(rgbaString);
  return result ? { r: Number(result[1]), g: Number(result[2]), b: Number(result[3]), a: Number(result[4]) } : undefined;
};

/**
 * Convert an HSL color to RGBA.
 * @function hslToRgba
 * @memberof Color
 * @param {String} hsl - *hsl*  NOT Implemented yet
 * @param {Number} opacity - a number between 0 and 1.
 * @return {String} The color as RGBA.
 * @static
 * @private
 */
Color.hslStringToRgba = function(hsl) {
  console.log('NOT IMPLEMENTED');
};

/**
 * Convert a RGB object to an HSV object.
 * r, g, b can be either in <0,1> range or <0,255> range.
 * Credits to http://www.raphaeljs.com
 * @private
 */
Color.rgb2hsv = function(rgb) {
  let r = rgb.r;
  let g = rgb.g;
  let b = rgb.b;

  if (r > 1 || g > 1 || b > 1) {
    r /= 255;
    g /= 255;
    b /= 255;
  }

  let H, S, V, C;
  V = Math.max(r, g, b);
  C = V - Math.min(r, g, b);
  H = (C === 0 ? null :
    V === r ? (g - b) / C + (g < b ? 6 : 0) :
      V === g ? (b - r) / C + 2 :
        (r - g) / C + 4);
  H = (H % 6) * 60;
  S = C === 0 ? 0 : C / V;
  return { h: H, s: S, v: V };
};

/**
 * Convert an HSV object to RGB HEX string.
 * Credits to http://www.raphaeljs.com
 * @private
 */
Color.hsv2rgb = function(hsv) {
  let R, G, B, X, C;
  let h = (hsv.h % 360) / 60;

  C = hsv.v * hsv.s;
  X = C * (1 - Math.abs(h % 2 - 1));
  R = G = B = hsv.v - C;

  h = ~~h;
  R += [C, X, 0, 0, X, C][h];
  G += [X, C, C, X, 0, 0][h];
  B += [0, 0, X, C, C, X][h];

  // const r = Math.floor(R * 255);
  // const g = Math.floor(G * 255);
  // const b = Math.floor(B * 255);
  const r = Math.round(R * 255);
  const g = Math.round(G * 255);
  const b = Math.round(B * 255);
  return { r: r, g: g, b: b };
};

/**
 * Convert a Hexidecimal color string to an RGBA object.
 * Credited to http://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
 * @function hex2rgba
 * @memberof Color
 * @param {String} hex - *hex* can be shorthand (e.g. "03F") or fullform (e.g. "0033FF"), with or without the starting '#'.
 * @param {Number} opacity - a number between 0 and 1.
 * @return {String} The color as an RGBA object.
 * @static
 * @private
 */
Color.hexString2rgba = function(hex, opacity = 1) {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, function(m, r, g, b) {
    return r + r + g + g + b + b;
  });
  // Defaults:
  let red = 0;
  let green = 0;
  let blue = 0;
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    red = parseInt(result[1], 16);
    green = parseInt(result[2], 16);
    blue = parseInt(result[3], 16);
  }
  return { r: red, g: green, b: blue, a: opacity };
};

/**
 * Converts an RGB color object to a Hex string (without the '#').
 * Based on https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
 * @function rgb2hex
 * @memberof Color
 * @param {Object} rgb - object with r, g, b properties
 * @return {String} The color as a Hex string (without the '#')
 * @static
 * @private
 */
Color.rgb2hex = function(rgb) {
  function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
  }

  return (componentToHex(rgb.r) + componentToHex(rgb.g) + componentToHex(rgb.b)).toUpperCase();
};

/**
 * Credited: https://gist.github.com/mjackson/5311256
 * Converts an RGB color value to HSL. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and l in the set [0, 1].
 *
 * @param   Number  r       The red color value
 * @param   Number  g       The green color value
 * @param   Number  b       The blue color value
 * @return  Array           The HSL representation
 * @private
 */
Color.rgb2hsl = function(rgb) {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
    case g: h = (b - r) / d + 2; break;
    case b: h = (r - g) / d + 4; break;
    }

    h /= 6;
  }

  // return [ h, s, l ];
  return { h: h, s: s, l: l };
};

/**
 * Credited: https://gist.github.com/mjackson/5311256
 * Converts an HSL color value to RGB. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes h, s, and l are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 * @param   Number  h       The hue
 * @param   Number  s       The saturation
 * @param   Number  l       The lightness
 * @return  Array           The RGB representation
 * @private
 */
Color.hsl2rgb = function(hsl) {
  const h = hsl.h;
  const s = hsl.s;
  const l = hsl.l;
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    function hue2rgb(p, q, t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  r = Math.floor(r * 255);
  g = Math.floor(g * 255);
  b = Math.floor(b * 255);

  return { r: r, g: g, b: b };
};

/**
 * Convert a RGBA object to a RGBA string
 * @function rgba2String
 * @memberof Color
 * @param {Object} rgba - RGBA object
 * @return {String} - RGBA String
 * @static
 * @private
 */
Color.rgba2String = function(rgba) {
  rgba = Color._validateRgba(rgba);
  return `rgba(${rgba.r},${rgba.g},${rgba.b},${rgba.a})`;
};

/**
 * Convert a RGB object to a RGB string
 * @function rgb2String
 * @memberof Color
 * @param {Object} rgb - RGB object
 * @return {String} - RGB String
 * @static
 * @private
 */
Color.rgb2String = function(rgb) {
  return `rgb(${rgb.r},${rgb.g},${rgb.b})`;
};


/**
 * Convert a named color to RGBA.
 * @function name2HexString
 * @memberof Color
 * @param {String} name - *name* should be one of the ~150 browser supported color names [List](http://www.w3schools.com/colors/colors_names.asp))
 * @return {String} The color as a Hex string.
 * @static
 * @private
 */
Color.name2HexString = function(name) {
  name = name.toLowerCase();
  const hex = Color.names()[name];
  if (hex) {
    return hex;
  } else {
    console.log('Name not found! Defaulting to Black');
    return '#000000';
  }
};


/**
 * Returns a color with RGB values centered around *center* and upto *width* away from the center.
 * If *notColors* is provided, the method makes sure not to return one of those colors.
 * Internally getColor creates an array of colors double the size of *notColors* plus 1 and then checks
 * the color from array starting at the index of *notColors* length (ie if *colors* is an array of 4,
 * the methods creates an array of 9 colors and starts at color number 5). This prevents always returning
 * the first few colors, if they are being changed by the user.
 * @private
 */
Color.getColor = function(notColors = [], center = 128, width = 127, alpha = 1) {
  const colors = [];
  const len = (notColors.length * 2) + 1;
  const freq1  = 2.4;
  const freq2  = 2.4;
  const freq3  = 2.4;
  // Originally: 0, 2, 4 which gave a first color of  (128, 243, 32)
  const phase1 = 0;
  const phase2 = 4;
  const phase3 = 2;
  // Generate Colors
  for (let i = 0; i < len; ++i) {
    const red   = Math.round(Math.sin(freq1 * i + phase1) * width + center);
    const green = Math.round(Math.sin(freq2 * i + phase2) * width + center);
    const blue  = Math.round(Math.sin(freq3 * i + phase3) * width + center);
    colors.push(new Color(`rgba(${red}, ${green}, ${blue}, ${alpha})`));
  }
  // Check that is color has not been used before
  let colorIndex = notColors.length;
  if (colorIndex > 0) {
    for (; colorIndex < colors.length; colorIndex++) {
      const color = colors[colorIndex];
      if (!color.inArray(notColors)) {
        break;
      }
    }
  }
  return colors[colorIndex];
};

/**
 * Return a object of color names and their HEX values
 */
Color.names = function() {
  return {
    aliceblue: '#f0f8ff',
    antiquewhite: '#faebd7',
    aqua: '#00ffff',
    aquamarine: '#7fffd4',
    azure: '#f0ffff',
    beige: '#f5f5dc',
    bisque: '#ffe4c4',
    black: '#000000',
    blanchedalmond: '#ffebcd',
    blue: '#0000ff',
    blueviolet: '#8a2be2',
    brown: '#a52a2a',
    burlywood: '#deb887',
    cadetblue: '#5f9ea0',
    chartreuse: '#7fff00',
    chocolate: '#d2691e',
    coral: '#ff7f50',
    cornflowerblue: '#6495ed',
    cornsilk: '#fff8dc',
    crimson: '#dc143c',
    cyan: '#00ffff',
    darkblue: '#00008b',
    darkcyan: '#008b8b',
    darkgoldenrod: '#b8860b',
    darkgray: '#a9a9a9',
    darkgrey: '#a9a9a9',
    darkgreen: '#006400',
    darkkhaki: '#bdb76b',
    darkmagenta: '#8b008b',
    darkolivegreen: '#556b2f',
    darkorange: '#ff8c00',
    darkorchid: '#9932cc',
    darkred: '#8b0000',
    darksalmon: '#e9967a',
    darkseagreen: '#8fbc8f',
    darkslateblue: '#483d8b',
    darkslategray: '#2f4f4f',
    darkslategrey: '#2f4f4f',
    darkturquoise: '#00ced1',
    darkviolet: '#9400d3',
    deeppink: '#ff1493',
    deepskyblue: '#00bfff',
    dimgray: '#696969',
    dimgrey: '#696969',
    dodgerblue: '#1e90ff',
    firebrick: '#b22222',
    floralwhite: '#fffaf0',
    forestgreen: '#228b22',
    fuchsia: '#ff00ff',
    gainsboro: '#dcdcdc',
    ghostwhite: '#f8f8ff',
    gold: '#ffd700',
    goldenrod: '#daa520',
    gray: '#808080',
    grey: '#808080',
    green: '#008000',
    greenyellow: '#adff2f',
    honeydew: '#f0fff0',
    hotpink: '#ff69b4',
    indianred: '#cd5c5c',
    indigo: '#4b0082',
    ivory: '#fffff0',
    khaki: '#f0e68c',
    lavender: '#e6e6fa',
    lavenderblush: '#fff0f5',
    lawngreen: '#7cfc00',
    lemonchiffon: '#fffacd',
    lightblue: '#add8e6',
    lightcoral: '#f08080',
    lightcyan: '#e0ffff',
    lightgoldenrodyellow: '#fafad2',
    lightgray: '#d3d3d3',
    lightgrey: '#d3d3d3',
    lightgreen: '#90ee90',
    lightpink: '#ffb6c1',
    lightsalmon: '#ffa07a',
    lightseagreen: '#20b2aa',
    lightskyblue: '#87cefa',
    lightslategray: '#778899',
    lightslategrey: '#778899',
    lightsteelblue: '#b0c4de',
    lightyellow: '#ffffe0',
    lime: '#00ff00',
    limegreen: '#32cd32',
    linen: '#faf0e6',
    magenta: '#ff00ff',
    maroon: '#800000',
    mediumaquamarine: '#66cdaa',
    mediumblue: '#0000cd',
    mediumorchid: '#ba55d3',
    mediumpurple: '#9370db',
    mediumseagreen: '#3cb371',
    mediumslateblue: '#7b68ee',
    mediumspringgreen: '#00fa9a',
    mediumturquoise: '#48d1cc',
    mediumvioletred: '#c71585',
    midnightblue: '#191970',
    mintcream: '#f5fffa',
    mistyrose: '#ffe4e1',
    moccasin: '#ffe4b5',
    navajowhite: '#ffdead',
    navy: '#000080',
    oldlace: '#fdf5e6',
    olive: '#808000',
    olivedrab: '#6b8e23',
    orange: '#ffa500',
    orangered: '#ff4500',
    orchid: '#da70d6',
    palegoldenrod: '#eee8aa',
    palegreen: '#98fb98',
    paleturquoise: '#afeeee',
    palevioletred: '#db7093',
    papayawhip: '#ffefd5',
    peachpuff: '#ffdab9',
    peru: '#cd853f',
    pink: '#ffc0cb',
    plum: '#dda0dd',
    powderblue: '#b0e0e6',
    purple: '#800080',
    rebeccapurple: '#663399',
    red: '#ff0000',
    rosybrown: '#bc8f8f',
    royalblue: '#4169e1',
    saddlebrown: '#8b4513',
    salmon: '#fa8072',
    sandybrown: '#f4a460',
    seagreen: '#2e8b57',
    seashell: '#fff5ee',
    sienna: '#a0522d',
    silver: '#c0c0c0',
    skyblue: '#87ceeb',
    slateblue: '#6a5acd',
    slategray: '#708090',
    slategrey: '#708090',
    snow: '#fffafa',
    springgreen: '#00ff7f',
    steelblue: '#4682b4',
    tan: '#d2b48c',
    teal: '#008080',
    thistle: '#d8bfd8',
    tomato: '#ff6347',
    turquoise: '#40e0d0',
    violet: '#ee82ee',
    wheat: '#f5deb3',
    white: '#ffffff',
    whitesmoke: '#f5f5f5',
    yellow: '#ffff00',
    yellowgreen: '#9acd32'
  };
};

export default Color;

