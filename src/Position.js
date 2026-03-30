//////////////////////////////////////////////////////////////////////////////
// CGView Positin
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
 * A Position gives a precise location on the canvas or map. Map-based
 * positions move with the map while cavas-based-position do not.
 *
 * ### Canvas-based positions
 *
 * Positions on the canvas are described using [position names](#position-names)
 * or x/yPercents.
 *
 * <a name="position-names"></a>
 * ### Position Names
 *
 * String           | xPercent | yPercent
 * -----------------|----------|---------
 * top-left         | 0        | 0
 * top-center       | 50       | 0
 * top-right        | 100      | 0
 * middle-left      | 0        | 50
 * middle-center    | 50       | 50
 * middle-right     | 100      | 50
 * bottom-left      | 0        | 100
 * bottom-center    | 50       | 100
 * bottom-right     | 100      | 100
 *
 * Canvas-based position examples:
 * - value: { xPercent: 50, yPercent: 40 }
 * - value: 'top-left'
 *
 * ### Map-based positions
 * 
 * Map-based positions are described with an object containing lengthPercent
 * and mapOffset values.
 *
 * - lengthPercent: Number between 0 and 100 (%) indicating the position as a percentage of the the map length.
 * - mapOffset: pixel distance from the map
 *    - values above 0: add to outside edge of map
 *    - values below 0: substract from inside edge of map
 *
 * Map-based position examples:
 * - value: { lengthPercent: 23, mapOffset: 10 }
 */

// Note: A better name may be Location over Position
//
// - value: { lengthPercent: 23, bbOffsetPercent: 10 }     // NOT IMPLEMENTED
// - value: { contig: 'contig-1', bp: 100, mapOffset: 10 } // NOT IMPLEMENTED
//
//
//  Order of priority for value:
//  Value                           | Assumes On |
//  --------------------------------|------------|------------
//  "top-left"                      | Canvas     |
//  {xPercent, yPercent,...}        | Canvas     |
//  {lengthPercent,...}             | Map        |
//  {contig, bp,...} //NOT IMPLEMENTED               | Map        |
//  {bp,...}         //NOT IMPLEMENTED               | Map        |
//
//  For offsets on the map: mapOffset > bbOffsetPercent > default [mapOffset: 20]
//
//  Positions create a point in canvas space based on the supplied values.
//  The position (on the map) can be updated by calling refresh, if the map pans or zooms.
//  The type of position can be changed by altering the position properties:
//     - on: map, canvas
//     - offsetType: backbone, map // NOT IMPLEMENTED
//     - value:
//        - 'top-left'
//        - {bp: 1, contig: 'c-1'}
//        - {lengthPercent: 23, mapOffset: 23}
//        - {xPercent: 20, yPercent: 30}
//
// mapOffset values are the pixel distance from the map:
//   -  >=0: Add to outside edge of map
//   -   <0: Subtract from inside edge of map
//
// bbOffsetPercent values are the percentage distance from the backbone
// to the outside/upper edge or the inside/botom edge of the map:
//   -    0: center of backbone
//   -  100: outside edge of map
//   - -100: inside edge of map
class Position {

  /**
   * Creating a Position. The default value for Position will be 'middle-center'.
   *
   * @param {String|Object} value - A string describing the position or
   *   an object. The object properties will depend on the position type.
   *   NOTE: see examples above. 
   *   <br /><br />
   *   Examples:
   *   - value: { lengthPercent: 23, mapOffset: 10 }
   *   - value: { xPercent: 50, yPercent: 40 }
   *   - value: 'top-left'
   */
  //   - value: { lengthPercent: 23, bbOffsetPercent: 10 } // NOT IMPLEMENTED
  //   - value: { contig: 'contig-1', bp: 100, mapOffset: 10 } // NOT IMPLEMENTED
  constructor(viewer, value) {
    this._viewer = viewer;
    this.value = value;
  }

  /**
   * Return the class name as a string.
   * @return {String} - 'Position'
   */
  toString() {
    return 'Position';
  }

  //////////////////////////////////////////////////////////////////////////
  // STATIC CLASSS METHODS
  //////////////////////////////////////////////////////////////////////////

  static get names() {
    return ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-center', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right'];
  }

  static percentsFromName(name) {
    const [yString, xString] = name.split('-');
    let xPercent, yPercent;

    if (yString === 'top') {
      yPercent = 0;
    } else if (yString === 'middle') {
      yPercent = 50;
    } else if (yString === 'bottom') {
      yPercent = 100;
    }

    if (xString === 'left') {
      xPercent = 0;
    } else if (xString === 'center') {
      xPercent = 50;
    } else if (xString === 'right') {
      xPercent = 100;
    }

    return { xPercent, yPercent };
  }

  static nameFromPercents(xPercent, yPercent) {
    const allowedPercents = [0, 50, 100];
    if (allowedPercents.includes(xPercent) && allowedPercents.includes(yPercent)) {
      let name = '';
      // yPercent Percent
      if (yPercent === 0) {
        name += 'top';
      } else if (yPercent === 50) {
        name += 'middle';
      } else if (yPercent === 100) {
        name += 'bottom';
      }
      // xPercent Percent
      if (xPercent === 0) {
        name += '-left';
      } else if (xPercent === 50) {
        name += '-center';
      } else if (xPercent === 100) {
        name += '-right';
      }
      return name;
    }
  }

  //////////////////////////////////////////////////////////////////////////
  // MEMBERS
  //////////////////////////////////////////////////////////////////////////

  get viewer() {
    return this._viewer;
  }

  get canvas() {
    return this.viewer.canvas;
  }

  /**
   * @member {Number} - Get the x value for the position.
   */
  get x() {
    return this._x;
  }

  /**
   * @member {Number} - Get the y value for the position.
   */
  get y() {
    return this._y;
  }

  /**
   * @member {Point} - Get the x/y values for the position as a point.
   */
  get point() {
    return {x: this.x, y: this.y};
  }

  get value() {
    return this._value;
  }

  set value(value) {
    return this._processValue(value);
  }

  get type() {
    return this._type;
  }

  get name() {
    return (Position.names.includes(this.value) && this.value) || Position.nameFromPercents(this.xPercent, this.yPercent);
  }

  get xPercent() {
    return this._xPercent;
  }

  get yPercent() {
    return this._yPercent;
  }

  /**
   * Get or set where this position is relative to. Values: 'canvas' or 'map'.
   */
  get on() {
    return this._on;
  }

  set on(value) {
    if (value === 'map') {
      this.convertToOnMap();
    } else if (value === 'canvas') {
      this.convertToOnCanvas();
    }
  }

  get onMap() {
    return this.on === 'map';
  }

  get onCanvas() {
    return this.on === 'canvas';
  }

  get offsetType() {
    return this._offsetType;
  }

  get offsetPositive() {
    if (this.onMap) {
      const { bbOffsetPercent, mapOffset } = this.value;
      const offset = (this.offsetType === 'map') ? mapOffset : bbOffsetPercent;
      return offset >= 0;
    }
    return undefined;
  }

  // Constrains value between min and max. Also rounds to decimals.
  formatNumber(number, min = 0, max = 100, decimals = 1) {
    return utils.round( utils.constrain(number, min, max), decimals );
  }

  _processValue(value) {
    if (typeof value === 'string') {
      this._value = utils.validate(value, Position.names) ? value : 'middle-center';
      this._on = 'canvas';
      this._type = 'name';
    } else if (typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.includes('xPercent') && keys.includes('yPercent')) {
        const {xPercent, yPercent} = value;
        this._xPercent = this.formatNumber(xPercent);
        this._yPercent = this.formatNumber(yPercent);
        this._value = {xPercent: this.xPercent, yPercent: this.yPercent};
        this._on = 'canvas';
        this._type = 'percent';
      } else if (keys.includes('lengthPercent')) {
        const {lengthPercent} = value;
        this._value = {lengthPercent: this.formatNumber(lengthPercent, 0, 100, 6)};
        this._on = 'map';
        this._type = 'percent';
      } else if (keys.includes('bp')) {
        // FIXME: handle bp without contig
        // FIXME: currently not handing bp at all (do we need to yet?)
        // const {bp, contig} = value;
        // this._value = {bp, contig};
        // this._on = 'map';
        // this._type = 'bp';
      }
      // Add offset value
      if (this.onMap) {
        const {mapOffset, bbOffsetPercent} = value;
        if (utils.isNumeric(mapOffset)) {
          this._offsetType = 'map';
          // this._value.mapOffset = Number(mapOffset);
          this._value.mapOffset = Math.round(mapOffset);
        } else if (utils.isNumeric(bbOffsetPercent)) {
          this._offsetType = 'backbone';
          // this._value.bbOffsetPercent = utils.constrain(bbOffsetPercent, -100, 100);
          this._value.bbOffsetPercent = this.formatNumber(bbOffsetPercent, -100, 100, 0);
        } else {
          this._offsetType = 'map';
          this._value.mapOffset = 20;
        }
      }
    }
    this.refresh();
  }

  // Create position point
  refresh() {
    let origin;

    if (this.onCanvas) {
      if (this.type === 'name') {
        origin = this._originFromName(this.value);
      } else if (this.type === 'percent') {
        origin = this._originFromCanvasPercents(this.value);
      }
    } else if (this.onMap) {
      if (this.type === 'percent') {
        origin = this._originFromMapPercent(this.value);
      }
      // TODO: get origin from BP
    }

    this._x = origin.x;
    this._y = origin.y;
  }


  _originFromName(name) {
    const { xPercent, yPercent } = Position.percentsFromName(name);

    this._xPercent = xPercent;
    this._yPercent = yPercent;

    return this._originFromCanvasPercents({xPercent, yPercent});
  }

  _originFromCanvasPercents({xPercent, yPercent}) {
    const x = this.canvas.width * xPercent / 100;
    const y = this.canvas.height * yPercent / 100;

    return {x, y};
  }

  _originFromMapPercent(value = this.value) {
    let point;
    if (value.lengthPercent === 50 && value.mapOffset === 0) {
      // Special case to center caption in the middle of the map
      // point = this.canvas.pointForBp(0,0);
      point = this.viewer.layout.centerCaptionPoint();
    } else {
      const bp = this.viewer.sequence.length * value.lengthPercent / 100;
      const centerOffset = this.centerOffset(value);
      point = this.canvas.pointForBp(bp, centerOffset);
    }
    return point;
  }

  centerOffset(value = this.value) {
    const {bbOffsetPercent, mapOffset} = value;
    const layout = this.viewer.layout;
    let centerOffset;
    if (this.offsetType === 'backbone') {
      centerOffset = layout.centerOffsetForBBOffsetPercent(bbOffsetPercent);
    } else {
      centerOffset = layout.centerOffsetForMapOffset(mapOffset);
    }
    return centerOffset;
  }

  convertToOnMap() {
    if (this.onMap) { return this; }
    const viewer = this.viewer;
    const canvas = this.canvas;
    const layout = viewer.layout;

    const point = this.point;
    const bp = canvas.bpForPoint(point);
    const lengthPercent = this.formatNumber(bp / viewer.sequence.length * 100);

    const ptOffset = layout.centerOffsetForPoint(point);
    const bbCenterOffset = viewer.backbone.adjustedCenterOffset;

    let mapOffset, bbOffsetPercent;
    if (ptOffset >= layout.centerOutsideOffset) {
      // Outside Map
      mapOffset = ptOffset - layout.centerOutsideOffset;
      this.value = {lengthPercent, mapOffset};
    } else if (ptOffset <= layout.centerInsideOffset) {
      // Inside Map
      mapOffset = ptOffset - layout.centerInsideOffset;
      this.value = {lengthPercent, mapOffset};
    } else if (ptOffset >= bbCenterOffset) {
      // Outside Backbone
      bbOffsetPercent = (ptOffset - bbCenterOffset) / layout.bbOutsideOffset * 100;
      this.value = {lengthPercent, bbOffsetPercent};
    } else if (ptOffset < bbCenterOffset) {
      // Inside Backbone
      bbOffsetPercent = (bbCenterOffset - ptOffset) / layout.bbInsideOffset * 100;
      this.value = {lengthPercent, bbOffsetPercent};
    }

    return this;
  }

  convertToOnCanvas() {
    if (this.onCanvas) { return this; }
    const viewer = this.viewer;
    const canvas = this.canvas;
    const value = this.value;
    const centerOffset = this.centerOffset(value);
    const bp = viewer.sequence.length * value.lengthPercent / 100;
    const point = canvas.pointForBp(bp, centerOffset);

    this.value = {
      xPercent: this.formatNumber(point.x / viewer.width * 100),
      yPercent: this.formatNumber(point.y / viewer.height * 100)
    };
    return this;
  }

  moveTo(duration) {
    if (this.onMap) {
      const bp = this.viewer.sequence.length * this.value.lengthPercent / 100;
      const bbOffset = this.viewer.backbone.adjustedCenterOffset - this.centerOffset();
      this.viewer.moveTo(bp, null, {duration, bbOffset});
    }
  }

  toJSON(options = {}) {
    return this.value;
  }

}

export default Position;
