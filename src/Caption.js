//////////////////////////////////////////////////////////////////////////////
// Caption
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
import Box from './Box';
import Font from './Font';
import Color from './Color';
import utils from './Utils';
import * as d3 from 'd3';

/**
 * Captions are used to add additional annotation to the map.
 *
 * ### Action and Events
 *
 * Action                                     | Viewer Method                                  | Caption Method       | Event
 * -------------------------------------------|------------------------------------------------|----------------------|-----
 * [Add](../docs.html#adding-records)         | [addCaptions()](Viewer.html#addCaptions)       | -                    | captions-add
 * [Update](../docs.html#updating-records)    | [updateCaptions()](Viewer.html#updateCaptions) | [update()](#update)  | captions-update
 * [Remove](../docs.html#removing-records)    | [removeCaptions()](Viewer.html#removeCaptions) | [remove()](C#remove) | captions-remove
 * [Reorder](../docs.html#reordering-records) | [moveCaption()](Viewer.html#moveCaption)       | [move()](#move)      | captions-reorder
 * [Read](../docs.html#reading-records)       | [captions()](Viewer.html#captions)             | -                    | -
 *
 * <a name="attributes"></a>
 * ### Attributes
 *
 * Attribute                        | Type      | Description
 * ---------------------------------|-----------|------------
 * [name](#name)                    | String    | Text of the caption
 * [position](#position)            | String\|Object | Where to draw the caption [Default: 'middle-center']. See {@link Position} for details.
 * [anchor](#anchor)                | String\|Object | Where to anchor the caption box to the position [Default: 'middle-center']. See {@link Anchor} for details.
 * [font](#font)                    | String    | A string describing the font [Default: 'SansSerif, plain, 8']. See {@link Font} for details.
 * [fontColor](#fontColor)          | String    | A string describing the color [Default: 'black']. See {@link Color} for details.
 * [textAlignment](#textAlignment)  | String    | Alignment of caption text: *left*, *center*, or *right* [Default: 'left']
 * [backgroundColor](#font)         | String    | A string describing the background color of the caption [Default: 'white']. See {@link Color} for details.
 * [on](#on)<sup>ic</sup>           | String    | Place the caption relative to the 'canvas' or 'map' [Default: 'canvas']
 * [visible](CGObject.html#visible) | Boolean   | Caption is visible [Default: true]
 * [meta](CGObject.html#meta)       | Object    | [Meta data](tutorial-meta.html) for Caption
 * 
 * <sup>ic</sup> Ignored on Caption creation
 *
 * ### Examples
 *
 * @extends CGObject
 */
class Caption extends CGObject {

  /**
   * Create a new Caption.
   * @param {Viewer} viewer - The viewer.
   * @param {Object} options - [Attributes](#attributes) used to create the caption.
   * @param {Object} [meta] - User-defined [Meta data](../tutorials/details-meta-data.html) to add to the caption.
   */
  constructor(viewer, options = {}, meta = {}) {
    super(viewer, options, meta);
    this.viewer = viewer;
    this._name = utils.defaultFor(options.name, '');
    this.backgroundColor = options.backgroundColor;
    // this.backgroundColor = 'black';
    this.fontColor = utils.defaultFor(options.fontColor, 'black');
    this.textAlignment = utils.defaultFor(options.textAlignment, 'left');
    this.box = new Box(viewer, {
      position: utils.defaultFor(options.position, 'middle-center'),
      anchor: utils.defaultFor(options.anchor, 'middle-center')
    });
    // Setting font will refresh the caption and draw
    this.font = utils.defaultFor(options.font, 'sans-serif, plain, 8');
    this.pluginOptions = options.pluginOptions;
    // FIXME: go through caption initialization and reduce to calles to Refresh (we only need one)
  }

  /**
   * Return the class name as a string.
   * @return {String} - 'Caption'
   */
  toString() {
    return 'Caption';
  }

  /**
   * @member {Viewer} - Get or set the *Viewer*
   */
  get viewer() {
    return this._viewer;
  }

  set viewer(viewer) {
    this._viewer = viewer;
    viewer._captions.push(this);
  }

  get visible() {
    return this._visible;
  }

  set visible(value) {
    // super.visible = value;
    this._visible = value;
    this.viewer.refreshCanvasLayer();
    // this.viewer ? this.viewer.refreshCanvasLayer() : this.refresh();
    // this.refresh();
  }

  /**
   * @member {String} - Get or set where the caption will be relative to. Values: 'map', 'canvas'
   */
  get on() {
    return this.box.on;
  }

  set on(value) {
    this.clear();
    this.box.on = value;
    this.refresh();
  }

  /**
   * @member {String} - Get or set the caption [anchor](Anchor.html) position. 
   */
  get anchor() {
    return this.box.anchor;
  }

  set anchor(value) {
    this.clear();
    this.box.anchor = value;
    this.refresh();
  }

  /**
   * @member {Boolean} - Returns true if the caption is positioned on the map
   */
  get onMap() {
    return this.position.onMap;
  }

  /**
   * @member {Boolean} - Returns true if the caption is positioned on the canvas
   */
  get onCanvas() {
    return this.position.onCanvas;
  }

  /**
   * @member {Context} - Get the Context for drawing.
   * @private
   */
  get ctx() {
    const layer = (this.onMap) ? 'foreground' : 'canvas';
    return this.canvas.context(layer);
  }

  /**
   * @member {String} - Get or set the caption [position](Position.html). 
   */
  get position() {
    return this.box.position;
  }

  set position(value) {
    this.clear();
    this.box.position = value;
    // this.refresh();
    this.viewer.refreshCanvasLayer();
    // FIXME: need to update anchor 
  }

  /**
   * @member {Color} - Get or set the backgroundColor. When setting the color, a string representing the color or a {@link Color} object can be used. For details see {@link Color}.
   */
  get backgroundColor() {
    return this._backgroundColor;
  }

  set backgroundColor(color) {
    // this._backgroundColor.color = color;
    if (color === undefined) {
      this._backgroundColor = new Color(this.viewer.settings.backgroundColor);
    } else if (color.toString() === 'Color') {
      this._backgroundColor = color;
    } else {
      this._backgroundColor = new Color(color);
    }
    this.refresh();
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
    this.refresh();
  }

  /**
   * @member {Color} - Get or set the fontColor. When setting the color, a string representing the color or a {@link Color} object can be used. For details see {@link Color}.
   */
  get fontColor() {
    // return this._fontColor.rgbaString;
    return this._fontColor;
  }

  set fontColor(value) {
    if (value.toString() === 'Color') {
      this._fontColor = value;
    } else {
      this._fontColor = new Color(value);
    }
    this.refresh();
  }

  /**
   * @member {String} - Get or set the text alignment. Possible values are *left*, *center*, or *right*.
   */
  get textAlignment() {
    return this._textAlignment;
  }

  set textAlignment(value) {
    if ( utils.validate(value, ['left', 'center', 'right']) ) {
      this._textAlignment = value;
    }
    this.refresh();
  }

  /**
   * @member {String} - Get or set the text shown for this caption.
   */
  get name() {
    return this._name || '';
  }

  set name(value) {
    this._name = value;
    this.refresh();
  }

  /**
   * @member {String} - Get the name split into an array of lines.
   * @private
   */
  get lines() {
    return this.name.split('\n');
  }

  /**
   * Update caption [attributes](#attributes).
   * See [updating records](../docs.html#s.updating-records) for details.
   * @param {Object} attributes - Object describing the properties to change
   */
  update(attributes) {
    this.viewer.updateCaptions(this, attributes);
  }

  /**
   * Move the map to center the caption. Only works with caption positioned on
   * the map (not the canvas).
   * @param {Number} duration - Duration of move animation
   */
  moveTo(duration=1000) {
    this.position.moveTo(duration);
  }

  /**
   * Recalculates the *Caption* size and position.
   * @private
   */
  refresh() {
    const box = this.box;
    if (!box) { return; }
    this.clear();

    // Padding is half line height/font size
    box.padding = this.font.size / 2;

    // Calculate Caption Width
    const lines = this.lines;
    const fonts = lines.map( () => this.font.css );
    const itemWidths = Font.calculateWidths(this.ctx, fonts, lines);
    const width = d3.max(itemWidths) + (box.padding * 2);

    // Calculate height of Caption
    // - height of each line; plus padding between line; plus padding;
    const lineHeight = this.font.size + box.padding;
    const height = (lineHeight * lines.length) + box.padding;

    box.resize(width, height);

    this.draw();
  }

  /**
   * Fill the background of the caption with the background color.
   * @private
   */
  fillBackground() {
    const box = this.box;
    this.ctx.fillStyle = this.backgroundColor.rgbaString;
    box.clear(this.ctx);
    this.ctx.fillRect(box.x, box.y, box.width, box.height);
  }

  /**
   * Invert the colors of the caption (i.e. backgroundColor and fontColor).
   */
  invertColors() {
    this.update({
      backgroundColor: this.backgroundColor.invert().rgbaString,
      fontColor: this.fontColor.invert().rgbaString
    });
  }

  /**
   * Highlight the caption by drawing a box around it.
   * @param {Color} color - Color of the highlighting outline
   */
  highlight(color = this.fontColor) {
    if (!this.visible) { return; }
    // let ctx = this.canvas.context('background');
    // ctx.fillStyle = color;
    // ctx.fillRect(this.originX, this.originY, this.width, this.height);
    const ctx = this.canvas.context('ui');
    ctx.lineWidth = 1;
    ctx.strokeStyle = color.rgbaString;
    const box = this.box;

    // ctx.strokeRect(box.x, box.y, box.width, box.height);

    const corner = Math.min((box.height / 4), 4);
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.width, box.height, [corner]);
    ctx.stroke();
  }

  /**
   * Returns the x position for drawing the caption text. Depnds on the textAlignment.
   * @private
   */
  textX() {
    const box = this.box;
    if (this.textAlignment === 'left') {
      return box.leftPadded;
    } else if (this.textAlignment === 'center') {
      return box.centerX;
    } else if (this.textAlignment === 'right') {
      return box.rightPadded;
    }
  }

  /**
   * Clear the box containing this caption.
   */
  clear() {
    this.box.clear(this.ctx);
  }

  /**
   * Draw the caption
   */
  draw() {
    if (!this.visible) { return; }
    const ctx = this.ctx;
    const box = this.box;

    // Update the box origin if relative to the map
    box.refresh();

    this.fillBackground();
    // ctx.textBaseline = 'top';
    ctx.textBaseline = 'alphabetic'; // The default baseline works best across canvas and svg
    ctx.font = this.font.css;
    ctx.textAlign = this.textAlignment;
    // Draw Text Label
    ctx.fillStyle = this.fontColor.rgbaString;
    // ctx.fillText(this.name, box.paddedX, box.paddedY);

    const lineHeight = (box.height - box.padding) / this.lines.length;
    // let lineY = box.paddedY;
    let lineY = box.y + lineHeight;
    for (let i = 0, len = this.lines.length; i < len; i++) {
      ctx.fillText(this.lines[i], this.textX(), lineY);
      lineY += lineHeight;
    }
  }


  /**
   * Remove caption
   */
  remove() {
    // const viewer = this.viewer;
    // viewer._captions = viewer._captions.remove(this);
    // viewer.clear('canvas');
    // viewer.refreshCanvasLayer();
    this.viewer.removeCaptions(this);
  }


  /**
   * Move this caption to a new index in the array of Viewer captions.
   * @param {Number} newIndex - New index for this caption (0-based)
   */
  move(newIndex) {
    const currentIndex = this.viewer.captions().indexOf(this);
    this.viewer.moveCaption(currentIndex, newIndex);
  }


  /**
   * Returns JSON representing the object
   */
  toJSON(options = {}) {
    const json = {
      name: this.name,
      position: this.position.toJSON(options),
      textAlignment: this.textAlignment,
      font: this.font.string,
      fontColor: this.fontColor.rgbaString,
      backgroundColor: this.backgroundColor.rgbaString,
      // visible: this.visible
    };
    if (this.position.onMap) {
      json.anchor = this.anchor.toJSON();
    }
    // Optionally add default values
    if (!this.visible || options.includeDefaults) {
      json.visible = this.visible;
    }
    if (this.pluginOptions) {
      json.pluginOptions = this.pluginOptions;
    }
    return json;
  }

}

export default Caption;


