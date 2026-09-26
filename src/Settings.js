//////////////////////////////////////////////////////////////////////////////
// Settings
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

import Color from './Color';
import utils from './Utils';

/**
 * The CGView Settings contain general settings for the viewer.
 *
 * ### Action and Events
 *
 * Action                                  | Viewer Method                    | Settings Method     | Event
 * ----------------------------------------|----------------------------------|---------------------|-----
 * [Update](../docs.html#updating-records) | -                                | [update()](#update) | settings-update
 * [Read](../docs.html#reading-records)    | [settings](Viewer.html#settings) | -                   | -
 *
 * <a name="attributes"></a>
 * ### Attributes
 *
 * Attribute                           | Type      | Description
 * ------------------------------------|-----------|------------
 * [format](#format)                   | String    | The layout format of the map: circular, linear [Default: circular]
 * [backgroundColor](#backgroundColor) | String    | A string describing the background color of the map [Default: 'white']. See {@link Color} for details.
 * [plotRenderer](#plotRenderer)       | String    | Experimental testing switch: contour or legacy. May change or be removed without notice. [Default: contour]
 * [showPlotOutline](#showPlotOutline) | Boolean   | Draw the contour edge on line plots during full draws [Default: true]
 * [showShading](#showShading)         | Boolean   | Should a shading effect be drawn on the features [Default: true]
 * [showTrackLabels](#showTrackLabels) | Boolean | Show compact track names when the map is zoomed in [Default: true]
 * [showBorder](#showBorder)           | Boolean   | Should a border be drawn on the features [Default: false]
 * [borderColor](#borderColor)         | String    | Feature and backbone border color. Undefined or null blends each element's fill 50% toward black on light backgrounds or white on dark backgrounds, preserving opacity [Default: undefined]. See {@link Color} for explicit colors.
 * [borderThickness](#borderThickness) | Number    | Border width in pixels, or maximum width when adaptiveBorderThickness is enabled [Default: 1]
 * [adaptiveBorderThickness](#adaptiveBorderThickness) | Boolean | Reduce feature and backbone borders according to their on-screen size and a zoom multiplier, from half width at zoom 1 to full width at zoom 2. When false, borderThickness stays fixed at every zoom [Default: true]
 * [arrowHeadLength](#arrowHeadLength) | Number    | Length of feature arrowheads as a proportion of the feature thickness. From 0 (no arrowhead) to 1 (arrowhead as long on the feature is thick) [Default: 0.3]
 * [initialMapThicknessProportion](#initialMapThicknessProportion) | Number  | Proportion of canvas size to use for drawing map tracks at a zoomFactor of 1 [Default: 0.1]
 * [maxMapThicknessProportion](#maxMapThicknessProportion) | Number  | Proportion of canvas size to use for drawing map tracks at max zoom level [Default: 0.5]
 * [maxSlotThickness](#maxSlotThickness) | Number | Shared maximum slot thickness in pixels, including overview [Default: 50]
 *
 * ### Examples
 *
 */
class Settings {

  /**
   * Initialize Settings.
   * @param {Viewer} viewer - The viewer
   * @param {Object} options - [Attributes](#attributes) used to initialize settings.
   */
  constructor(viewer, options = {}) {
    this.viewer = viewer;
    // Only set format if provided. Otherwise the defaults in the Viewer constructor are used.
    if (options.format) {
      this.format = options.format;
    }
    this._backgroundColor = new Color( utils.defaultFor(options.backgroundColor, 'white') );
    this._geneticCode = utils.defaultFor(options.geneticCode, 11);
    this.arrowHeadLength = utils.defaultFor(options.arrowHeadLength, 0.3);
    this._plotRenderer = options.plotRenderer === 'legacy' ? 'legacy' : 'contour';
    this._showPlotOutline = utils.defaultFor(options.showPlotOutline, true);
    this._showShading = utils.defaultFor(options.showShading, true);
    this._showTrackLabels = utils.defaultFor(options.showTrackLabels, true);
    this._showBorder = utils.defaultFor(options.showBorder, false);
    this._borderColor = options.borderColor == null ? undefined : new Color(options.borderColor);
    this._borderThickness = utils.defaultFor(options.borderThickness, 1);
    this._adaptiveBorderThickness = utils.defaultFor(options.adaptiveBorderThickness, true);
    this.initialMapThicknessProportion = utils.defaultFor(options.initialMapThicknessProportion, 0.1);
    this.maxMapThicknessProportion = utils.defaultFor(options.maxMapThicknessProportion, 0.5);
    this.maxSlotThickness = utils.defaultFor(options.maxSlotThickness, 50);
    this.viewer.trigger('settings-update', {attributes: this.toJSON({includeDefaults: true})});
  }

  /**
   * Return the class name as a string.
   * @return {String} - 'Settings'
   */
  toString() {
    return 'Settings';
  }

  /**
   * @member {String} - Get or set the map format: circular, linear
   */
  get format() {
    return this.viewer.format;
  }

  set format(value) {
    this.viewer.format = value;
  }

  /**
   * @member {Number} - Get or set the genetic code used for translation.
   * This genetic code will be used unless a feature has an overriding genetic code.
   * Default: 11
   */
  get geneticCode() {
    return this._geneticCode || 11;
  }

  set geneticCode(value) {
    this._geneticCode = value;
  }

  /**
   * @member {Color} - Get or set the backgroundColor. When setting the color, a string representing the color or a {@link Color} object can be used. For details see {@link Color}.
   */
  get backgroundColor() {
    return this._backgroundColor;
  }

  set backgroundColor(color) {
    if (color === undefined) {
      this._backgroundColor = new Color('white');
    } else if (color.toString() === 'Color') {
      this._backgroundColor = color;
    } else {
      this._backgroundColor = new Color(color);
    }
    this.viewer.fillBackground();
    // Static caption and legend layers must also follow inherited backgrounds.
    if (!this.viewer.loading) { this.viewer.refreshCanvasLayer(); }
  }

  /**
   * @member {Number} - Set or get the arrow head length as a fraction of the slot width. The value must be between 0 and 1 [Default: 0.3].
   */
  set arrowHeadLength(value) {
    this._arrowHeadLength = utils.constrain(Number(value), 0, 1);
  }

  get arrowHeadLength() {
    return this._arrowHeadLength;
  }

  /**
   * @member {String} - Experimental renderer selection: 'contour' (default)
   * or 'legacy'. Changing it redraws the map for direct visual comparison.
   * This testing switch is not a stable API and may change or be removed
   * without notice. Applications should use the default renderer rather than
   * depend on this setting. It is currently serialized with viewer settings.
   */
  get plotRenderer() {
    return this._plotRenderer;
  }

  set plotRenderer(value) {
    if (utils.validate(value, ['legacy', 'contour'])) {
      this._plotRenderer = value;
      this.viewer.drawFull();
    }
  }

  /**
   * @member {Boolean} - Draw a thin edge on contour line plots (default: true).
   * Changing it redraws the map. Fast draws and legacy/bar plots omit the edge.
   */
  get showPlotOutline() {
    return this._showPlotOutline;
  }

  set showPlotOutline(value) {
    this._showPlotOutline = value;
    this.viewer.drawFull();
  }

  /**
   * @member {Boolean} - Get or set whether arrows and other components whould be draw with shading (Default: true).
   */
  get showShading() {
    return this._showShading;
  }

  set showShading(value) {
    this._showShading = value;
    this.viewer.drawFull();
  }

  /**
   * @member {Boolean} - Get or set whether compact track names are shown after
   * the map has been zoomed far enough to read individual lanes. Names appear
   * just inside the leading edge of each visible track side, follow circular
   * map curvature, and use a background-derived protective outline
   * (Default: true).
   */
  get showTrackLabels() {
    return this._showTrackLabels;
  }

  set showTrackLabels(value) {
    const nextValue = Boolean(value);
    const changed = this._showTrackLabels !== nextValue;
    this._showTrackLabels = nextValue;
    if (changed && this.viewer.layout.trackLabelsAtCurrentZoom()) {
      this.viewer.drawFull();
    }
  }

  /**
   * @member {Boolean} - Get or set whether features should be drawn with a border (Default: false).
   */
  get showBorder() {
    return this._showBorder;
  }

  set showBorder(value) {
    this._showBorder = value;
    this.viewer.drawFull();
  }

  /**
   * @member {Color|undefined} - Get or set the border color using a color string
   * or a {@link Color}. Undefined or null selects automatic coloring and returns
   * undefined: each feature's legend color (or the backbone fill) is blended 50%
   * toward black on light backgrounds or white on dark backgrounds, preserving
   * its opacity. Automatic coloring is saved as null in JSON.
   */
  get borderColor() {
    return this._borderColor;
  }

  set borderColor(color) {
    if (color == null) {
      this._borderColor = undefined;
    } else if (color.toString() === 'Color') {
      this._borderColor = color;
    } else {
      this._borderColor = new Color(color);
    }
    this.viewer.drawFull();
  }

  /**
   * @member {Number} - Get or set the border width in pixels (Default: 1).
   *   This is the maximum width when {@link Settings#adaptiveBorderThickness} is enabled.
   */
  get borderThickness() {
    return this._borderThickness;
  }

  set borderThickness(value) {
    this._borderThickness = Number(value);
    this.viewer.drawFull();
  }

  /**
   * @member {Boolean} - Adapt feature and backbone border width to their on-screen
   *   length and thickness (Default: true). Borders disappear when either dimension
   *   is at most 2 pixels, then grow toward {@link Settings#borderThickness} as the
   *   element grows. This size-adjusted width is also multiplied by
   *   min(zoomFactor, 2) / 2: half width at zoom 1 and full width at zoom 2 or above.
   *   When false, borders use the configured width at every zoom level.
   */
  get adaptiveBorderThickness() {
    return this._adaptiveBorderThickness;
  }

  set adaptiveBorderThickness(value) {
    this._adaptiveBorderThickness = Boolean(value);
    this.viewer.drawFull();
  }

  /**
   * @member {Boolean} - Get or set the initial width/thickness of the map as a
   * proportion of the canvas dimension (Circular: minDimension; Linear:
   * height). The width will grow/shrink with the zoomFactor (Default: 0.1).
   * This value will be ignored if the
    * [maxMapThicknessProportion](#maxMapThicknessProportion) value is smaller.
   */
  get initialMapThicknessProportion() {
    return this.viewer.layout.initialMapThicknessProportion;
  }

  set initialMapThicknessProportion(value) {
    this.viewer.layout.initialMapThicknessProportion = value;
  }

  /**
   * @member {Boolean} - Get or set the maximum width/thickness of the map as a
   * proportion of the canvas width or height (Default: 0.5).
   */
  get maxMapThicknessProportion() {
    return this.viewer.layout.maxMapThicknessProportion;
  }

  set maxMapThicknessProportion(value) {
    this.viewer.layout.maxMapThicknessProportion = value;
  }

  /**
   * @member {Number} - Shared maximum thickness in pixels for feature and plot
   * slots, at overview and while zooming (Default: 50). Must be finite and at
   * least layout.minSlotThickness (normally 1). Invalid values are ignored.
   * This cap can rescale all slots. Pixel sizing raises it when necessary;
   * zoomed neighbouring slots may consequently change thickness.
   * The first visible along-backbone track can render wider to retain its
   * 5 pixel clearance on each edge of the visible backbone or sequence detail.
   */
  get maxSlotThickness() {
    return this.viewer.layout.maxSlotThickness;
  }

  set maxSlotThickness(value) {
    this.viewer.layout.maxSlotThickness = value;
  }

  /**
   * Update settings [attributes](#attributes).
   * See [updating records](../docs.html#s.updating-records) for details.
   * @param {Object} attributes - Object describing the properties to change
   */
  update(attributes) {
    this.viewer.layout.batchProportionUpdates(() => this.viewer.updateRecords(this, attributes, {
      recordClass: 'Settings',
      validKeys: ['format', 'backgroundColor', 'plotRenderer', 'showPlotOutline', 'showShading', 'showTrackLabels', 'showBorder', 'borderColor', 'borderThickness', 'adaptiveBorderThickness', 'arrowHeadLength', 'geneticCode', 'initialMapThicknessProportion', 'maxMapThicknessProportion', 'maxSlotThickness']
    }));
    this.viewer.layout._triggerProportionEvent('settings-update', { attributes });
  }

  /**
   * Returns JSON representing the object
   */
  toJSON() {
    return {
      format: this.format,
      geneticCode: this.geneticCode,
      backgroundColor: this.backgroundColor.rgbaString,
      plotRenderer: this.plotRenderer,
      showPlotOutline: this.showPlotOutline,
      showShading: this.showShading,
      showTrackLabels: this.showTrackLabels,
      showBorder: this.showBorder,
      borderColor: this.borderColor?.rgbaString ?? null,
      borderThickness: this.borderThickness,
      adaptiveBorderThickness: this.adaptiveBorderThickness,
      arrowHeadLength: this.arrowHeadLength,
      initialMapThicknessProportion: this.initialMapThicknessProportion,
      maxMapThicknessProportion: this.maxMapThicknessProportion,
      maxSlotThickness: this.maxSlotThickness
    };
  }

}

export default Settings;
