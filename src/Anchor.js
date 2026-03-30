//////////////////////////////////////////////////////////////////////////////
// CGView Anchor
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
import utils from './Utils';

/**
 * An Anchor is a point on a box/rect that can be described in words ('top-left')
 * or as x/y percents where 0 is the top/left and 100 is the bottom/right.
 * Anchors are typically used to describe the focal point on a box or where to
 * draw an attachemnt line.
 *
 * <a name="anchor-names"></a>
 * ### Anchor Names
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
 */
class Anchor {

  /**
   * Creating an Anchor. The default value for Anchor will be 'top-left' ({xPercent: 0, yPercent: 0}).
   * @param {String|Object} value - A string describing the position or
   *   an object with 2 properties: xPercent, yPercent.
   *   The percent values should be between 0 (top/left) and 100 (bottom/right).
   *   Percents below 0 will become 0 and values abouve 100 will become 100.
   *   See the [Anchor Names](#anchor-names) table for possible string values and their corresponding
   *   x/y Percents.
   */
  constructor(value) {
    if (typeof value === 'string') {
      if (value === 'auto') {
        this.auto = true;
      } else {
        this.name = value;
      }
    } else if (typeof value === 'object') {
      this.xPercent = utils.defaultFor(Number(value.xPercent), 50);
      this.yPercent = utils.defaultFor(Number(value.yPercent), 50);
    } else {
      this.xPercent = 50;
      this.yPercent = 50;
    }
  }

  /**
   * Return the class name as a string.
   * @return {String} - 'Anchor'
   */
  toString() {
    return 'Anchor';
  }

  //////////////////////////////////////////////////////////////////////////
  // MEMBERS
  //////////////////////////////////////////////////////////////////////////

  get auto() {
    return this._auto;
  }

  set auto(value) {
    this._auto = Boolean(value);
  }

  /**
   * @member {Number} - Get or set the xPercent. The value will be constrained between 0 and 100.
   */
  get xPercent() {
    return this._xPercent;
  }

  set xPercent(value) {
    this._xPercent = Math.round(utils.constrain(value, 0, 100))
    this._name = Position.nameFromPercents(this.xPercent, this.yPercent);
  }

  /**
   * @member {Number} - Get or set the yPercent. The value will be constrained between 0 and 100.
   */
  get yPercent() {
    return this._yPercent;
  }

  set yPercent(value) {
    this._yPercent = Math.round(utils.constrain(value, 0, 100));
    this._name = Position.nameFromPercents(this.xPercent, this.yPercent);
  }

  /**
   * @member {String} - Get or set the anchor name. If a string can not
   * describe the anchor, _undefined_ will be returned.
   */
  get name() {
    // return this._nameFromPercents();
    return this._name;
  }

  set name(value) {
    if (value && utils.validate(value, Position.names)) {
      this._name = value;
      this._updatePercentsFromName(value);
    }
  }

  // Should only be called from set name so the string is validated first.
  _updatePercentsFromName(name) {
    const { xPercent, yPercent } = Position.percentsFromName(name);

    this._xPercent = xPercent;
    this._yPercent = yPercent;
  }

  autoUpdateForPosition(position) {
    if (this.auto) {
      if (position.onCanvas) {
        this.xPercent = position.xPercent;
        this.yPercent = position.yPercent;
      } else if (position.onMap) {
        const format = position.viewer.format;
        const offsetPositive = position.offsetPositive;
        const lengthPercent = position.value.lengthPercent;
        if (format === 'linear') {
          this.yPercent = offsetPositive ? 100 : 0;
          this.xPercent = lengthPercent;
        } else if (format === 'circular') {
          if (lengthPercent <= 7) {
            this.xPercent = (lengthPercent + 7) / 14 * 100;
            this.yPercent = 100;
          } else if (lengthPercent > 7 && lengthPercent < 43) {
            this.xPercent = 0;
            this.yPercent = (lengthPercent - 7) / 36 * 100;
          } else if (lengthPercent >= 43 && lengthPercent <= 57) {
            this.xPercent = (lengthPercent - 43) / 14 * 100;
            this.yPercent = 0;
          } else if (lengthPercent > 57 && lengthPercent < 93) {
            this.xPercent = 100;
            this.yPercent = (lengthPercent - 57) / 36 * 100;
          } else if (lengthPercent >= 93) {
            this.xPercent = (lengthPercent - 93) / 14 * 100;
            this.yPercent = 100;
          }
        }
      }
    }
  }

  /**
   * Returns JSON representing this anchor, either as a name or an object with
   * xPercent and yPercent properties.
   */
  toJSON() {
    if (this.auto) {
      return 'auto';
    } else if (this.name) {
      return this.name;
    } else {
      return {
        xPercent: this.xPercent,
        yPercent: this.yPercent
      };
    }
  }

}

export default Anchor;
