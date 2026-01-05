//////////////////////////////////////////////////////////////////////////////
// Ruler
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

import CGObject from './CGObject';
import Color from './Color';
import Font from './Font';
import utils from './Utils';
import * as d3 from 'd3';

/**
 * The Ruler controls and draws the sequence ruler in bp.
 *
 * ### Action and Events
 *
 * Action                                  | Viewer Method              | Ruler Method        | Event
 * ----------------------------------------|----------------------------|---------------------|-----
 * [Update](../docs.html#updating-records) | -                          | [update()](#update) | ruler-update
 * [Read](../docs.html#reading-records)    | [ruler](Viewer.html#ruler) | -                   | -
 *
 * <a name="attributes"></a>
 * ### Attributes
 *
 * Attribute                        | Type      | Description
 * ---------------------------------|-----------|------------
 * [font](#font)                    | String    | A string describing the font [Default: 'sans-serif, plain, 10']. See {@link Font} for details.
 * [color](#color)                  | String    | A string describing the color [Default: 'black']. See {@link Color} for details.
 * [visible](CGObject.html#visible) | Boolean   | Rulers are visible [Default: true]
 * [meta](CGObject.html#meta)       | Object    | [Meta data](../tutorials/details-meta-data.html) for ruler
 *
 * ### Examples
 *
 * @extends CGObject
 */
class Ruler extends CGObject {

  /**
   * Create a new ruler
   * @param {Viewer} viewer - The viewer
   * @param {Object} options - [Attributes](#attributes) used to create the ruler
   * @param {Object} [meta] - User-defined [Meta data](../tutorials/details-meta-data.html) to add to the ruler.
   */
  constructor(viewer, options = {}, meta = {}) {
    super(viewer, options, meta);
    this.tickCount = utils.defaultFor(options.tickCount, 10);
    this.tickWidth = utils.defaultFor(options.tickWidth, 1);
    this.tickLength = utils.defaultFor(options.tickLength, 4);
    this.rulerPadding = utils.defaultFor(options.rulerPadding, 10);
    this.spacing = utils.defaultFor(options.spacing, 2);
    this.font = utils.defaultFor(options.font, 'sans-serif, plain, 10');
    this.color = new Color( utils.defaultFor(options.color, 'black') );
    this.lineCap = 'round';

    this.viewer.trigger('ruler-update', { attributes: this.toJSON({includeDefaults: true}) });
  }

  /**
   * Return the class name as a string.
   * @return {String} - 'Ruler'
   */
  toString() {
    return 'Ruler';
  }

  /**
   * @member {Font} - Get or set the font. When setting the font, a string representing the font or a {@link Font} object can be used. For details see {@link Font}.
   */
  get font() {
    return this._font;
  }

  set font(value) {
    if (value.toString() === 'Font') {
      this._font = value;
    } else {
      this._font = new Font(value);
    }
  }

  /**
   * @member {Color} - Get or set the Color. When setting the color, a string representing the color or a {@link Color} object can be used. For details see {@link Color}.
   */
  get color() {
    return this._color;
  }

  set color(color) {
    if (color.toString() === 'Color') {
      this._color = color;
    } else {
      this._color.setColor(color);
    }
  }

  get tickCount() {
    return this._tickCount;
  }

  set tickCount(count) {
    this._tickCount = count;
  }

  get tickWidth() {
    return this._tickWidth;
  }

  set tickWidth(width) {
    this._tickWidth = width;
  }

  get tickLength() {
    return this._tickLength;
  }

  set tickLength(length) {
    this._tickLength = length;
  }

  get rulerPadding() {
    return this._rulerPadding;
  }

  set rulerPadding(padding) {
    this._rulerPadding = padding;
  }

  // Distance between divider and tick marks
  get spacing() {
    return this._spacing;
  }

  set spacing(value) {
    this._spacing = value;
  }

  /**
   * @member {Array} - Get the array of Major Ticks.
   */
  get majorTicks() {
    return this._majorTicks;
  }

  /**
   * @member {Number} - Get distance between major tick marks.
   */
  get majorTickStep() {
    return this._majorTickStep;
  }

  /**
   * @member {Array} - Get the array of Minor Ticks.
   */
  get minorTicks() {
    return this._minorTicks;
  }

  /**
   * @member {Number} - Get distance between minor tick marks.
   */
  get minorTickStep() {
    return this._minorTickStep;
  }

  /**
   * @member {Object} - Get the d3 formatter for printing the tick labels
   */
  get tickFormater() {
    return this._tickFormater;
  }

  /**
   * Create d3 tickFormat based on the distance between ticks
   * @param {Number} tickStep - Distance between ticks
   * @return {Object}
   * @private
   */
  _createTickFormatter(tickStep) {
    let tickFormat, tickPrecision;
    if (tickStep <= 50) {
      tickFormat = d3.formatPrefix(',.0', 1);
    } else if (tickStep <= 50e3) {
      tickPrecision = d3.precisionPrefix(tickStep, 1e3);
      tickFormat = d3.formatPrefix(`.${tickPrecision}`, 1e3);
    } else if (tickStep <= 50e6) {
      tickPrecision = d3.precisionPrefix(tickStep, 1e6);
      tickFormat = d3.formatPrefix(`.${tickPrecision}`, 1e6);
    } else if (tickStep <= 50e9) {
      tickPrecision = d3.precisionPrefix(tickStep, 1e9);
      tickFormat = d3.formatPrefix(`.${tickPrecision}`, 1e9);
    }
    return tickFormat;
  }

  // Below the zoomFactorCutoff, all ticks are calculated for the entire map
  // Above the zoomFactorCutoff, ticks are created for the visible range
  _updateTicks(innerCenterOffset, outerCenterOffset) {
    const zoomFactorCutoff = 5;
    const sequenceLength = this.sequence.length;
    let start = 0;
    let stop = 0;
    let majorTicks = [];
    let majorTickStep = 0;
    let minorTicks = [];
    let minorTickStep = 0;
    let tickCount = this.tickCount;

    // Find start and stop to create ticks
    if (this.viewer.zoomFactor < zoomFactorCutoff) {
      start = 1;
      stop = sequenceLength;
    } else {
      tickCount = Math.ceil(tickCount / 2);
      const innerRange = this.canvas.visibleRangeForCenterOffset(innerCenterOffset);
      const outerRange = this.canvas.visibleRangeForCenterOffset(outerCenterOffset);
      if (innerRange && outerRange) {
        const mergedRange = innerRange.mergeWithRange(outerRange);
        start = mergedRange.start;
        stop = mergedRange.stop;
      } else if (innerRange) {
        start = innerRange.start;
        stop = innerRange.stop;
      } else if (outerRange) {
        start = outerRange.start;
        stop = outerRange.stop;
      }
    }

    // Create Major ticks and tickStep
    if (stop > start) {
      majorTicks = majorTicks.concat( d3.ticks(start, stop, tickCount) );
      majorTickStep = d3.tickStep(start, stop, tickCount);
    } else if (stop < start) {
      // Ratio of the sequence length before 0 to sequence length after zero
      // The number of ticks will for each region will depend on this ratio
      const tickCountRatio = (sequenceLength - start) / this.sequence.lengthOfRange(start, stop);
      const ticksBeforeZero = Math.round(tickCount * tickCountRatio);
      const ticksAfterZero = Math.round(tickCount * (1 - tickCountRatio)) * 2; // Multiply by 2 for a margin of safety
      if (ticksBeforeZero > 0) {
        majorTicks = majorTicks.concat( d3.ticks(start, sequenceLength, ticksBeforeZero) );
        majorTickStep = Math.round(d3.tickStep(start, sequenceLength, ticksBeforeZero));
        for (let i = 1; i <= ticksAfterZero; i ++) {
          if (majorTickStep * i < start) {
            majorTicks.push( majorTickStep * i );
          }
        }
      } else {
        majorTicks = majorTicks.concat( d3.ticks(1, stop, tickCount) );
        majorTickStep = Math.round(d3.tickStep(1, stop, tickCount));
      }
    }

    // Find Minor ticks
    minorTicks = [];
    if ( !(majorTickStep % 5) ) {
      minorTickStep = majorTickStep / 5;
    } else if ( !(majorTickStep % 2) ) {
      minorTickStep = majorTickStep / 2;
    } else {
      minorTickStep = 0;
    }
    if (minorTickStep) {
      if (this.sequence.lengthOfRange(majorTicks[majorTicks.length - 1], majorTicks[0]) <= 3 * majorTickStep) {
        start = 0;
        stop = sequenceLength;
      } else {
        start = majorTicks[0] - majorTickStep;
        stop = majorTicks[majorTicks.length - 1] + majorTickStep;
      }
      if (start < stop) {
        for (let tick = start; tick <= stop; tick += minorTickStep) {
          if (tick % majorTickStep) {
            minorTicks.push(tick);
          }
        }
      } else {
        for (let tick = start; tick <= sequenceLength; tick += minorTickStep) {
          if (tick % majorTickStep) {
            minorTicks.push(tick);
          }
        }
        for (let tick = 0; tick <= stop; tick += minorTickStep) {
          if (tick % majorTickStep) {
            minorTicks.push(tick);
          }
        }
      }
    }
    this._majorTicks = majorTicks;
    this._majorTickStep = majorTickStep;
    this._minorTicks = minorTicks;
    this._minorTickStep = minorTickStep;
    this._tickFormater = this._createTickFormatter(majorTickStep);
  }

  draw(innerCenterOffset, outerCenterOffset) {
    // console.log(innerCenterOffset, outerCenterOffset);
    if (this.visible) {
      innerCenterOffset -= this.spacing;
      outerCenterOffset += this.spacing;
      this._updateTicks(innerCenterOffset, outerCenterOffset);
      this.drawForCenterOffset(innerCenterOffset, 'inner');
      this.drawForCenterOffset(outerCenterOffset, 'outer', false);
    }
  }


  drawForCenterOffset(centerOffset, position = 'inner', drawLabels = true) {
    const ctx = this.canvas.context('map');
    const tickLength = (position === 'inner') ? -this.tickLength : this.tickLength;
    // ctx.fillStyle = 'black'; // Label Color
    ctx.fillStyle = this.color.rgbaString; // Label Color
    ctx.font = this.font.css;
    ctx.textAlign = 'left';
    // ctx.textBaseline = 'top';
    ctx.textBaseline = 'alphabetic'; // The default baseline works best across canvas and svg
    // Draw Tick for first bp (Origin)
    this.canvas.radiantLine('map', 1, centerOffset, tickLength, this.tickWidth * 2, this.color.rgbaString, this.lineCap);
    // Draw Major ticks
    this.majorTicks.forEach( (bp) => {
      this.canvas.radiantLine('map', bp, centerOffset, tickLength, this.tickWidth, this.color.rgbaString, this.lineCap);
      if (drawLabels) {
        const label = this.tickFormater(bp);
        this.drawLabel(bp, label, centerOffset, position);
      }
    });
    // Draw Minor ticks
    for (const bp of this.minorTicks) {
      if (bp > this.sequence.length) { break; }
      this.canvas.radiantLine('map', bp, centerOffset, tickLength / 2, this.tickWidth, this.color.rgbaString, this.lineCap);
    }
  }

  drawLabel(bp, label, centerOffset, position = 'inner') {
    const ctx = this.canvas.context('map');
    // Put space between number and units
    label = label.replace(/([kM])?$/, ' $1bp');
    // INNER
    const innerPt = this.canvas.pointForBp(bp, centerOffset - this.rulerPadding);
    const attachmentPosition = this.layout.clockPositionForBp(bp);
    const labelWidth = this.font.width(ctx, label);
    const labelPt = utils.rectOriginForAttachementPoint(innerPt, attachmentPosition, labelWidth, this.font.height);
    // ctx.fillText(label, labelPt.x, labelPt.y);
    ctx.fillText(label, labelPt.x, labelPt.y + this.font.height);
  }

  invertColors() {
    this.update({
      color: this.color.invert().rgbaString
    });
  }

  /**
   * Update ruler [attributes](#attributes).
   * See [updating records](../docs.html#s.updating-records) for details.
   * @param {Object} attributes - Object describing the properties to change
   */
  update(attributes) {
    this.viewer.updateRecords(this, attributes, {
      recordClass: 'Ruler',
      validKeys: ['color', 'font', 'visible']
    });
    this.viewer.trigger('ruler-update', { attributes });
  }

  /**
   * Returns JSON representing the object
   */
  toJSON(options = {}) {
    const json = {
      font: this.font.string,
      color: this.color.rgbaString,
      // visible: this.visible
    };
    // Optionally add default values
    if (!this.visible || options.includeDefaults) {
      json.visible = this.visible;
    }
    return json;
  }

}

export default Ruler;


