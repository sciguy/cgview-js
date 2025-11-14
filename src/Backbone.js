//////////////////////////////////////////////////////////////////////////////
// Backbone
//////////////////////////////////////////////////////////////////////////////

/**
 * CGView.js – Interactive Circular Genome Viewer
 * Copyright © 2016–2025 Jason R. Grant
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

import CGObject from './CGObject';
import Color from './Color';
import utils from './Utils';

/**
 * The CGView Backbone represents the sequence of the map. When zoomed in far
 * enough the sequence will be shown on the backbone. If contigs are present,
 * they will be represented as arcs or arrows on the backbone.
 *
 * ### Action and Events
 *
 * Action                                    | Viewer Method                   | Backbone Method      | Event
 * ------------------------------------------|--------------------------------- |---------------------|-----
 * [Update](../docs.html#s.updating-records) | -                                | [update()](#update) | backbone-update
 * [Read](../docs.html#s.reading-records)    | [backbone](Viewer.html#backbone) | -                   | -
 *
 * <a name="attributes"></a>
 * ### Attributes
 *
 * Attribute                         | Type      | Description
 * ----------------------------------|-----------|------------
 * [thickness](#thickness)           | Number    | Thickness of backbone [Default: 5]
 * [color](#color)                   | String    | A string describing the main backbone color [Default: 'grey']. See {@link Color} for details.
 * [colorAlternate](#alternateColor) | String    | A string describing the alternate color used for contigs [Default: 'rgb(200,200,200)']. See {@link Color} for details.
 * [decoration](#decoration)         | String    | How the bakcbone should be drawn. Choices: 'arc', 'arrow' [Default: arc for single contig, arrow for muliple contigs]
 * [visible](CGObject.html#visible)  | Boolean   | Backbone is visible [Default: true]
 * [meta](CGObject.html#meta)        | Object    | [Meta data](../tutorials/details-meta-data.html)
 *
 * ### Examples
 * ```js
 * cgv.backbone.update({
 *   thickness: 20
 * });
 *
 * @extends CGObject
 */
class Backbone extends CGObject {

  /**
   * Create the Backbone.
   * @param {Viewer} viewer - The viewer
   * @param {Object} options - [Attributes](#attributes) used to create the backbone
   * @param {Object} [meta] - User-defined [Meta data](../tutorials/details-meta-data.html) to add to the backbone.
   */
  constructor(viewer, options = {}, meta = {}) {
    super(viewer, options, meta);
    this.color = utils.defaultFor(options.color, 'grey');
    this.colorAlternate = utils.defaultFor(options.colorAlternate, 'rgb(200,200,200)');
    this.thickness = utils.defaultFor(options.thickness, 5);
    this._bpThicknessAddition = 0;
    // Default decoration is arrow for multiple contigs and arc for single contig
    const defaultDecoration = this.sequence.hasMultipleContigs ? 'arrow' : 'arc';
    this.decoration = utils.defaultFor(options.decoration, defaultDecoration);

    this.viewer.trigger('backbone-update', { attributes: this.toJSON({includeDefaults: true}) });
  }

  /**
   * Return the class name as a string.
   * @return {String} - 'Backbone'
   */
  toString() {
    return 'Backbone';
  }


  get visible() {
    return this._visible;
  }

  set visible(value) {
    this._visible = value;
    this.viewer._initialized && this.refreshThickness();
    // FIXME:
    this.viewer.layout && this.viewer.layout._adjustProportions();
  }

  /**
   * @member {Color} - Get or set the backbone color. When setting the color, a string representing the color or a {@link Color} object can be used. For details see {@link Color}.
   */
  get color() {
    return this._color;
  }

  set color(value) {
    if (value.toString() === 'Color') {
      this._color = value;
    } else {
      this._color = new Color(value);
    }
  }

  /**
   * @member {Color} - Get or set the backbone alternate color. This color is used when contigs are present. 
   *    The first contigs will be use *color*, the second will use *colorAlternate*, the third will use *color* and so on. When setting the color, a string representing the color or a {@link Color} object can be used. For details see {@link Color}.
   */
  get colorAlternate() {
    return this._colorAlternate;
  }

  set colorAlternate(value) {
    if (value.toString() === 'Color') {
      this._colorAlternate = value;
    } else {
      this._colorAlternate = new Color(value);
    }
  }

  /**
   * @member {String} - Get or set the decoration for the backbone contigs: 'arrow' or 'arc'
   */
  get decoration() {
    return this._decoration;
  }

  set decoration(value) {
    this._decoration = value;
  }

  /**
   * @member {Number} - Get or set the backbone centerOffset. This is the unzoomed centerOffset.
   */
  set centerOffset(value) {
    if (utils.isNumeric(value)) {
      this._centerOffset = value;
      // FIXME: zoommax will be based on map thickness, instead of backbone radius
      this.viewer._updateZoomMax();
    }
  }

  get centerOffset() {
    return this._centerOffset;
  }

  /**
   * @member {Number} - Get the zoomed backbone radius. This is the radius * zoomFacter
   */
  get adjustedCenterOffset() {
    return this.layout.adjustedBackboneCenterOffset(this.centerOffset);
  }

  /**
   * @member {Number} - Get or set the backbone thickness. This is the unzoomed thickness.
   */
  set thickness(value) {
    if (utils.isNumeric(value)) {
      this._thickness = Number(value);
      // FIXME:
      this.viewer.layout && this.viewer.layout._adjustProportions();
    }
  }

  get thickness() {
    return this.visible ? this._thickness : 0;
  }

  /**
   * @member {Number} - Get the zoomed backbone thickness.
   */
  // get zoomedThickness() {
    // NOTE: Can not divide by centerOffset
  //   return (Math.min(this.adjustedCenterOffset, this.viewer.maxZoomedRadius()) * (this.thickness / this.centerOffset)) + (this.bpThicknessAddition / CGV.pixel(1));
  // }

  /**
   * @member {Number} - Get the backbone thickness adjusted for visibility, zoom level and space for the sequence.
   */
  get adjustedThickness() {
    if (!this.visible) { return 0; }
    // FIXME: need to calculate the max zoom level for changing backbone thickness
    //        - should depend on the zoomFactor to at which pont the map thickness is at the maximum?
    //        - Used to depend on the maxZoomedRadius which was set to minDimension
    //        - for now set to 4
    return (Math.min(this.viewer.zoomFactor, 4) * this.thickness) + this.bpThicknessAddition;
  }

  /**
   * @member {Number} - Maximum thickness the backbone should become to allow viewing of the sequence
   */
  get maxThickness() {
    // return Math.max(this.thickness, this.sequence.thickness)
    return Math.max(this.adjustedThickness, this.sequence.thickness);
  }

  /**
   * Get the factor used to increase backbone thickness when approaching the ability to see the sequence.
   * @member {number}
   */
  get bpThicknessAddition() {
    return this._bpThicknessAddition;
  }

  /**
   * The visible range
   * @member {Range}
   */
  get visibleRange() {
    return this._visibleRange;
  }

  // Return the pixelLength of the backbone at a zoom level of 1
  get pixelLength() {
    return this.layout.pixelsPerBp(this.adjustedCenterOffset) / this.viewer.zoomFactor * this.sequence.length;
  }

  /**
   * Does the backbone contain the given *centerOffset*.
   * @param {Number} offset - The centerOffset.
   * @return {Boolean}
   */
  containsCenterOffset(offset) {
    const halfthickness = this.adjustedThickness / 2;
    const adjustedCenterOffset = this.adjustedCenterOffset;
    return (offset >= (adjustedCenterOffset - halfthickness)) && (offset <= (adjustedCenterOffset + halfthickness));
  }

  /**
   * The maximum zoom factor to get the correct spacing between basepairs.
   * @return {Number}
   */
  maxZoomFactor() {
    return (this.sequence.length * (this.sequence.bpSpacing + (this.sequence.bpMargin * 2))) / this.pixelLength;
  }

  /**
   * The number of pixels per basepair along the backbone circumference.
   * @return {Number}
   */
  pixelsPerBp() {
    return this.layout.pixelsPerBp();
  }

  directionalDecorationForContig(contig) {
    if (this.decoration === 'arrow') {
      return contig.orientation === '+' ? 'clockwise-arrow' : 'counterclockwise-arrow';
    } else {
      return this.decoration;
    }
  }

  invertColors() {
    this.update({
      color: this.color.invert().rgbaString,
      colorAlternate: this.colorAlternate.invert().rgbaString
    });
  }

  draw() {
    // this._visibleRange = this.canvas.visibleRangeForCenterOffset( this.adjustedCenterOffset, 100);
    this._visibleRange = this.canvas.visibleRangeForCenterOffset( this.adjustedCenterOffset, { margin: 100 });
    if (this.visibleRange && this.visible) {
      this.refreshThickness();

      if (this.sequence.hasMultipleContigs) {
        const contigs = this.sequence.contigsForMapRange(this.visibleRange);
        for (let i = 0, len = contigs.length; i < len; i++) {
          const contig = contigs[i];
          // Postions:
          // Large arcs (ie contigs) car drawn wrong when zoomed in (Safari)
          // So the start/stop should be adjusted to the visible range
          let start = this.sequence.bpForContig(contig);
          if (start < this.visibleRange.start && !this.visibleRange.isWrapped()) {
            start = this.visibleRange.start;
          }
          let stop = this.sequence.bpForContig(contig, contig.length);
          if (stop > this.visibleRange.stop && !this.visibleRange.isWrapped()) {
            stop = this.visibleRange.stop;
          }
          let color = (contig.index % 2 === 0) ? this.color : this.colorAlternate;
          if (contig.color) {
            color = contig.color;
          }
          this.viewer.canvas.drawElement('map', start, stop, this.adjustedCenterOffset, color.rgbaString, this.adjustedThickness, this.directionalDecorationForContig(contig));
        }
      } else {
        if (this.visibleRange.isWrapped() && this.decoration === 'arrow') {
          this.viewer.canvas.drawElement('map', this.visibleRange.start, this.sequence.length, this.adjustedCenterOffset, this.color.rgbaString, this.adjustedThickness, this.directionalDecorationForContig(this.sequence.mapContig));
          this.viewer.canvas.drawElement('map', 1, this.visibleRange.stop, this.adjustedCenterOffset, this.color.rgbaString, this.adjustedThickness, this.directionalDecorationForContig(this.sequence.mapContig));
        } else {
          this.viewer.canvas.drawElement('map', this.visibleRange.start, this.visibleRange.stop, this.adjustedCenterOffset, this.color.rgbaString, this.adjustedThickness, this.directionalDecorationForContig(this.sequence.mapContig));
        }
      }

      // Now Done in Layout.js (to accommodate 'along' position, ie drawing sequence over features)
      // if (this.pixelsPerBp() > 1) {
      //   this.sequence.draw();
      // }
    }
  }

  refreshThickness() {
    const pixelsPerBp = this.pixelsPerBp();
    if (pixelsPerBp > 1 && this.visible) {
      // const zoomedThicknessWithoutAddition = Math.min(this.adjustedCenterOffset, this.viewer.maxZoomedRadius()) * (this.thickness / this.centerOffset);
      // FIXME: see adjustedThickness for note. Use 4 for now.
      const zoomedThicknessWithoutAddition = Math.min(this.viewer.zoomFactor, 4) * this.thickness;
      const addition = pixelsPerBp * 2;
      if ( (zoomedThicknessWithoutAddition + addition ) >= this.maxThickness) {
        this._bpThicknessAddition = this.maxThickness - zoomedThicknessWithoutAddition;
      } else {
        this._bpThicknessAddition = addition;
      }
    } else {
      this._bpThicknessAddition = 0;
    }
  }

  /**
   * Update backbone [attributes](#attributes).
   * See [updating records](../docs.html#s.updating-records) for details.
   * @param {Object} attributes - Object describing the properties to change
   */
  update(attributes) {
    this.viewer.updateRecords(this, attributes, {
      recordClass: 'Backbone',
      validKeys: ['color', 'colorAlternate', 'thickness', 'decoration', 'visible']
    });
    this.viewer.trigger('backbone-update', { attributes });
  }

  /**
   * Returns JSON representing the object
   */
  toJSON(options = {}) {
    const json = {
      color: this.color.rgbaString,
      colorAlternate: this.colorAlternate.rgbaString,
      thickness: this._thickness,
      decoration: this.decoration
    };
    // Optionally add default values
    if (!this.visible || options.includeDefaults) {
      json.visible = this.visible;
    }
    return json;
  }

}

export default Backbone;

