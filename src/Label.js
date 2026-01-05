//////////////////////////////////////////////////////////////////////////////
// Label
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

import Font from './Font';

/**
 * Labels are used by [Annotation](Annotation.html) to control drawing
 * [feature](Feature.html) names on the map.
 * @private
 */
class Label {

  /**
   * Create a new label
   * @param {Feature} feature - Feature this label is associated with
   * @param {Object} options - ...
   */
  constructor(feature, options = {}) {
    this._feature = feature;
    this.name = options.name;
    // Minus 0.5 since features are drawn from start-0.5 to stop+0.5
    this.bp = this.feature.mapStart - 0.5 + (this.feature.length / 2);
    this.bpDefault = this.bp;

    // this.lineAttachmentDefault = this.viewer.layout.clockPositionForBp(this.bp);
  }

  /**
   * @member {String} - Get or set the label name.
   */
  get name() {
    return this._name;
  }

  set name(value) {
    if (value === undefined || value === '') {
      this.width = 0;
      // Label was in Annotation, so remove it
      if (!(this._name === '' || this._name === undefined)) {
        this.annotation.removeLabels(this);
      }
      this._name = '';
    } else {
      // Label was not in Annotation, so add it
      if (this._name === '' || this._name === undefined) {
        this.annotation.addLabel(this);
      }
      this._name = value;
      this.width = this.font.width(this.viewer.canvas.context('map'), this._name);
    }
  }

  /**
   * @member {Rect} - Get or set the label bounding rect.
   */
  get rect() {
    return this._rect;
  }

  set rect(value) {
    this._rect = value;
  }

  /**
   * @member {Number} - Get or set the label width.
   */
  get width() {
    return this._width;
  }

  set width(value) {
    this._width = value;
  }


  /**
   * @member {Number} - Get the label height which is based on the font size.
   */
  get height() {
    return this.font.height;
  }

  /**
   * @member {Point} - Get or set the label origin. The upper-left corner of the label rect.
   */
  // get origin() {
  //   return this._origin
  // }
  //
  // set origin(value) {
  //   this._origin = value;
  // }

  /**
   * @member {Number} - Get the default attachment point
   */
  get lineAttachmentDefault() {
    // FIXME: This may be slow. Consider calculating when ever the scales change???
    return this.viewer.layout.clockPositionForBp(this.bp, true);
  }

  /**
   * @member {Number} - Get or set the label attachment point. This number represents where on the label
   *                    the label lines attaches in term of a hand on a clock. (e.g. 12 would be top middle of label)
   */
  get lineAttachment() {
    return this._lineAttachment || this.lineAttachmentDefault;
  }

  set lineAttachment(value) {
    this._lineAttachment = value;
  }

  /**
   * @member {Font} - Get or set the font. When setting the font, a string representing the font or a {@link Font} object can be used. For details see {@link Font}.
   */
  get font() {
    return this._font || this.annotation.font;
  }

  set font(value) {
    if (value === undefined) {
      this._font = this.annotation.font;
    } else if (value.toString() === 'Font') {
      this._font = value;
    } else {
      this._font = new Font(value);
    }
  }

  /**
   * @member {Viewer} - Get the *Viewer*
   */
  get viewer() {
    return this.feature.viewer;
  }

  /**
   * @member {Annotation} - Get the *Annotation*
   */
  get annotation() {
    return this.viewer.annotation;
  }

  /**
   * @member {Feature} - Get the Feature
   */
  get feature() {
    return this._feature;
  }

  /**
   * @member {Number} - Get the mapStart position of the feature
   */
  get mapStart() {
    return this.feature.mapStart;
  }

  /**
   * @member {Number} - Get the mapStop position of the feature
   */
  get mapStop() {
    return this.feature.mapStop;
  }

  /**
   * Highlgith this label
   */
  // highlight() {
  //   const canvas = this.viewer.canvas;
  //   canvas.clear('ui');
  //   const color = this.annotation.color || this.feature.color;
  //   const ctx = canvas.context('ui');
  //   const rect = this.rect;
  //   ctx.strokeStyle = color.rgbaString;
  //   ctx.lineWidth = 1;
  //   const padding = 2;
  //   ctx.strokeRect(rect.x - padding , rect.y - padding, rect.width + (2*padding), rect.height + (2*padding) );
  // }
  hightlight() {
    this.feature.hightlight();
    // this._highlight();
  }
  // Called from feature.highlight()
  _highlight() {
    if (!this.rect) { return; }
    if (!this.annotation._visibleLabels.includes(this)) { return; }

    const canvas = this.viewer.canvas;
    // canvas.clear('ui');
    const color = this.annotation.color || this.feature.color;
    const ctx = canvas.context('ui');
    const rect = this.rect;
    ctx.strokeStyle = color.rgbaString;
    ctx.lineWidth = 1;

    // Rectangle Outline
    // ctx.strokeRect(rect.x - padding , rect.y - padding, rect.width + (2*padding), rect.height + (2*padding) );

    // Rounded Rectangle Outline
    const padding = 2;
    const corner = this.height / 4;
    ctx.beginPath();
    ctx.roundRect(rect.x - padding , rect.y - padding, rect.width + (2*padding), rect.height + (2*padding), [corner] );
    ctx.stroke();

    // Label Line
    this.annotation.drawLabelLine(this, ctx, 1.5);
  }

}

export default Label;

