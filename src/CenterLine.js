//////////////////////////////////////////////////////////////////////////////
// CenterLine
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
import utils from './Utils';

/**
 * The center line points to the center of the viewer (i.e. the current base pair).
 *
 * CenterLine settings are not saved with the map. They are only used for display purposes.
 *
 * If either track or slot has their mirror set to true, then both dividers will be treated as the same.
 * In addition, if only settings for one of the dividers is provided on Viewer creation, then it will be mirrored.
 *
 * ### Action and Events
 *
 * Action                                  | Viewer Method                    | Divider Method      | Event
 * ----------------------------------------|----------------------------------|---------------------|-----
 * [Update](../docs.html#updating-records) | -                                | [update()](#update) | centerLine-update
 *
 * <a name="attributes"></a>
 * ### Attributes
 *
 * Attribute                        | Type      | Description
 * ---------------------------------|-----------|------------
 * [color](#color)                  | String    | A string describing the color [Default: 'black']. See {@link Color} for details.
 * [thickness](#thickness)          | Number    | Thickness of center line [Default: 1]
 * [dashes](#dashes)                | Array     | An array of numbers describing the dash pattern [Default: [1, 2]]
 * [visible](CGObject.html#visible) | Boolean   | Center line is visible [Default: true]
 * [meta](CGObject.html#meta)       | Object    | [Meta data](../tutorials/details-meta-data.html) for center line
 *
 * ### Examples
 * ```js
 * // Turn on the center line
 * cgv.centerLine.visible = true;
 * 
 * // Turn off the center line
 * cgv.centerLine.visible = false;
 *
 * // Change the color of the center line
 * cgv.centerLine.update({color: 'red'});
 * ```
 * 
 * @extends CGObject
 */
class CenterLine extends CGObject {

  /**
   * Create the center line
   * @param {Viewer} viewer - The viewer
   * @param {Object} options - [Attributes](#attributes) used to create the center line
   * @param {Object} [meta] - User-defined [Meta data](../tutorials/details-meta-data.html) to add to the center line
   */
  constructor(viewer, options = {}, meta = {}) {
    super(viewer, options, meta);
    this.color = utils.defaultFor(options.color, 'grey');
    this._thickness = utils.defaultFor(options.thickness, 1);
    this._dashes = utils.defaultFor(options.dashes, [1,2]);
    this.viewer.trigger('centerLine-update', { centerLine: this, attributes: this.toJSON({includeDefaults: true}) });
  }

  /**
   * Return the class name as a string.
   * @return {String} - 'CenterLine'
   */
  toString() {
    return 'CenterLine';
  }

  /**
   * @member {Boolean} - Get or Set the visibility of this object.
   */
  get visible() {
    return this._visible;
  }

  set visible(value) {
    this._visible = value;
  }

  /**
   * @member {Color} - Get or set the center line color. When setting the color, a string representing the color or a {@link Color} object can be used. For details see {@link Color}.
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
   * @member {Number} - Set or get the center line thickness. This is the unzoomed thickness.
   */
  set thickness(value) {
    if (value !== undefined) {
      this._thickness = value;
    }
  }

  get thickness() {
    return this._thickness;
  }

  /**
   * @member {Array} - Set or get the center line dash pattern. Falsy values will result in a solid line. Any other non array values will result in the default dash pattern.
   */
  set dashes(value) {
    if (Array.isArray(value)) {
      // NOTE: we could filter out non-numeric values here
      // newValue = value.map( v => parseInt(v) ).filter( v => !isNaN(v) );
      this._dashes = value;
    } else if (!value) {
      this._dashes = [];
    } else {
      // Default dash pattern
      this._dashes = [1, 2];
    }
  }

  get dashes() {
    return this._dashes;
  }

  /**
   * Invert colors of the centerLine
   */
  invertColors() {
    this.update({ color: this.color.invert().rgbaString });
  }

  /**
   * Update CenterLine [attributes](#attributes).
   * See [updating records](../docs.html#s.updating-records) for details.
   * @param {Object} attributes - Object describing the properties to change
   */
  update(attributes) {
    const { records: centerLine, updates } = this.viewer.updateRecords(this, attributes, {
      recordClass: 'CenterLine',
      validKeys: ['visible', 'color', 'thickness', 'dashes']
    });
    this.viewer.trigger('centerLine-update', { centerLine: this, attributes, updates });
  }

  draw() {
    if (this.visible) {
      this.layout.drawCenterLine();
    }
  }

  toJSON() {
    return {
      visible: this.visible,
      color: this.color.rgbaString,
      thickness: this.thickness,
      dashes: this.dashes
    };
  }

}

export default CenterLine;


