//////////////////////////////////////////////////////////////////////////////
// CGview Box
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

import Position from './Position';
import Anchor from './Anchor';
import utils from './Utils';

/**
 * A Box consists of an x and y point (the top-left corner) and
 * a width and height. The Box position can be relative to the
 * canvas where the position stays static or to the map in which
 * case the position moves with the map.
 *
 * <a name="attributes"></a>
 * ### Attributes
 *
 * Attribute             | Type          | Description
 * ----------------------|---------------|------------
 * [width](#width)       | Number        | Width of box (Default: 100)
 * [height](#height)     | Number        | Height of box (Default: 100)
 * [padding](#padding)   | Number        | Sets paddedX and paddedY values (Default: 0)
 * [position](#position) | String\|Object | Where to place the box. See {@link Position} for details.
 * [anchor](#anchor)     | String\|Object | Where the position should be anchored to the box.
 * [color](#color)       | String\|Color  | A string describing the color. See {@link Color} for details. (DOESN'T DO ANYTHING YET)
 *
 * Position:
 * If the position is on (i.e. relativeTo) the 'canvas', the box will be in a static position
 * and will not move as the map is panned. String values (e.g. top-right, bottom-middle, etc)
 * position the box appropriately. An object with xPercent and yPercent values between
 * 0 and 100 will position the box along the x and y axes starting from the top-left.
 * The string values are associated with specific offsets. For example,
 *   - top-left = {xPercent: 0, yPercent: 0}
 *   - middle-center = {xPercent: 50, yPercent: 50}
 *   - bottom-right = {xPercent: 100, yPercent: 100}
 *
 * If position is on (i.e. relativeTo) the 'map', the box will move with the map as it's panned.
 * The position will consist of
 *   - lengthPercent: 0 - start of map; 50 - middle of map; 100 - end of map
 *   - mapOffset or bbOffsetPercent: distance from the backbone
 *
 * ### Examples
 *
 */
class Box {

  /**
   * Create a Box.
   * @param {Viewer} viewer - The viewer this box will be associated with.
   * @param {Object} options - [Attributes](#attributes) used to create the box.
   */
  constructor(viewer, options = {}) {
    this._viewer = viewer;
    this._width = utils.defaultFor(options.width, 100);
    this._height = utils.defaultFor(options.height, 100);
    this.anchor = options.anchor;
    // Set position after anchor. If position is on canvas, the anchor will be updated.
    this.position = utils.defaultFor(options.position, 'middle-center');
    this.padding = utils.defaultFor(options.padding, 0);
    this.color = utils.defaultFor(options.color, 'white');
  }

  /**
   * Return the class name as a string.
   * @return {String} - 'Box'
   */
  toString() {
    return 'Box';
  }

  get viewer() {
    return this._viewer;
  }

  get canvas() {
    return this.viewer.canvas;
  }

  /**
   * Alias for [Position on](Position.html#on). Values: 'map', 'campus'.
   */
  get on() {
    return this.position.on;
  }

  set on(value) {
    this.position.on = value;
    // this._adjustAnchor(); // Only needed when onCanvas, which is called when the position is set
    if (this.position.onMap) {
      // To keep the box in the same position when changing to onMap, the auto anchor has to be turned off.
      this.anchor.auto = false;
    } else if (this.position.onCanvas) {
      // To keep the box in the same position when changing to onCanvas, the position must be adjusted.
      // Adjust Position
      this.position = {
        xPercent: this.x / (this.viewer.width - this.width) * 100,
        yPercent: this.y / (this.viewer.height - this.height) * 100
      }
    }
  }

  /**
   * @member {String} - Get or set the postion. String values include: "top-left", "top-center", "top-right", "middle-left", "middle-center", "middle-right", "bottom-left", "bottom-center", or "bottom-right".
   */
  get position() {
    return this._position;
  }

  set position(value) {
    this._position = new Position(this.viewer, value);
    this._adjustAnchor();
    this.refresh(true);
  }

  /**
   * @member {String|Object} - Get or set the anchor.
   */
  get anchor() {
    return this._anchor;
  }

  set anchor(value) {
    if (this.position && this.position.onCanvas) { return; }
    this._anchor = new Anchor(value);
    this.position && this.refresh(true);
  }

  /**
   * @member {Number} - Get or set the width.
   */
  get width() {
    return this._width;
  }

  set width(value) {
    this._width = value;
    this.refresh(true);
  }

  /**
   * @member {Number} - Get or set the height.
   */
  get height() {
    return this._height;
  }

  set height(value) {
    this._height = value;
    this.refresh(true);
  }

  /**
   * @member {Number} - Get the x position of the origin.
   */
  get x() {
    return this._x;
  }

  /**
   * @member {Number} - Get the y position of the origin.
   */
  get y() {
    return this._y;
  }

  /**
   * @member {Number} - Get or set the padding. This will be added to x and y when accessed via paddedX and paddedY.
   */
  get padding() {
    return this._padding;
  }

  set padding(value) {
    this._padding = value;
  }

  /**
   * @member {Number} - Get the x position of the origin plus padding.
   */
  get paddedX() {
    return this.x + this.padding;
  }

  /**
   * @member {Number} - Get the y position of the origin plus padding.
   */
  get paddedY() {
    return this.y + this.padding;
  }

  /**
   * @member {Number} - Get bottom of the Box
   */
  get bottom() {
    return this.y + this.height;
  }

  /**
   * @member {Number} - Get bottom of the Box minus padding
   */
  get bottomPadded() {
    return this.bottom - this.padding;
  }

  /**
   * @member {Number} - Get top of the Box. Same as Y.
   */
  get top() {
    return this.y;
  }

  /**
   * @member {Number} - Get top of the Box plus padding.
   */
  get topPadded() {
    return this.top + this.padding;
  }

  /**
   * @member {Number} - Get left of the Box. Same as X.
   */
  get left() {
    return this.x;
  }

  /**
   * @member {Number} - Get left of the Box plus padding.
   */
  get leftPadded() {
    return this.left + this.padding;
  }

  /**
   * @member {Number} - Get right of the Box.
   */
  get right() {
    return this.x + this.width;
  }

  /**
   * @member {Number} - Get right of the Box minus padding.
   */
  get rightPadded() {
    return this.right - this.padding;
  }

  /**
   * @member {Number} - Get the center x of the box.
   */
  get centerX() {
    return this.x + (this.width / 2);
  }

  /**
   * @member {Number} - Get the center y of the box.
   */
  get centerY() {
    return this.y + (this.height / 2);
  }

  resize(width, height) {
    this._width = width;
    this._height = height;
    this.refresh(true);
  }

  /**
   * Check if the Box conains the point
   *
   * @param {Number} x - X coordinate of the point
   * @param {Number} y - Y coordinate of the point
   * @return {Boolean}
   */
  containsPt(x, y) {
    return ( x >= this.x && x <= (this.x + this.width) && y >= this.y && y <= (this.y + this.height) );
  }

  _adjustAnchor() {
    if (this.position.onCanvas) {
      this.anchor.xPercent = this.position.xPercent;
      this.anchor.yPercent = this.position.yPercent;
      this.anchor.auto = true;
    }
  }

  refresh(force = false) {
    if (!force && this.on === 'canvas') { return; }
    this.position.refresh();
    if (this.anchor.auto) {
      this.anchor.autoUpdateForPosition(this.position);
    }
    this._x = this.position.x - (this.width * this.anchor.xPercent / 100);
    this._y = this.position.y - (this.height * this.anchor.yPercent / 100);
  }

  /**
   * Clear the rect area described by this box using the provided context.
   * @param {Context}  ctx - Context used to clear the rect.
   */
  clear(ctx) {
    // Added margin of 1 to remove thin lines of previous background that were not being removed
    ctx.clearRect(this.x - 1, this.y - 1, this.width + 2, this.height + 2);
  }

}

export default Box;


