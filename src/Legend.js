//////////////////////////////////////////////////////////////////////////////
// Legend
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
import CGArray from './CGArray';
import LegendItem from './LegendItem';
import Color from './Color';
import Font from './Font';
import Box from './Box';
import utils from './Utils';
import * as d3 from 'd3';

/**
 * The Legend contains the [legendItems](LegendItem.html) for the maps and can be placed anywhere on the canvas or map.
 *
 * ### Action and Events
 *
 * Action                                  | Viewer Method                | Legend Method                  | Event
 * ----------------------------------------|------------------------------|--------------------------------|-----
 * [Update](../docs.html#updating-records) | -                            | [update()](Legend.html#update) | legends-update
 * [Read](../docs.html#reading-records)    | [legend](Viewer.html#legend) | -                              | -
 *
 * <a name="attributes"></a>
 * ### Attributes
 *
 * Attribute                          | Type      | Description
 * -----------------------------------|-----------|------------
 * [position](#position)              | String\|Object | Where to draw the legend [Default: 'top-right']. See {@link Position} for details.
 * [anchor](#anchor)                  | String\|Object | Where to anchor the legend box to the position [Default: 'auto']. See {@link Anchor} for details.
 * [defaultFont](#defaultFont)        | String    | A string describing the default font [Default: 'SansSerif, plain, 8']. See {@link Font} for details.
 * [defaultFontColor](#defaultFontColor) | String    | A string describing the default font color [Default: 'black']. See {@link Color} for details.
 * [defaultMinArcLength](#defaultMinArcLength) | Number    | Default minimum length in pixels to use when drawing arcs. From 0 to 2 pixels [Default: 1]
 * [textAlignment](#textAlignment)    | String    | Alignment of legend text: *left*, or *right* [Default: 'left']
 * [backgroundColor](#font)           | String    | A string describing the background color of the legend [Default: 'white']. See {@link Color} for details.
 * [on](#on)<sup>ic</sup>             | String    | Place the legend relative to the 'canvas' or 'map' [Default: 'canvas']
 * [items](#items)<sup>iu</sup>       | Array     | Array of legend item data.
 * [visible](CGObject.html#visible)   | Boolean   | Legend is visible [Default: true]
 * [meta](CGObject.html#meta)         | Object    | [Meta data](../tutorials/details-meta-data.html)
 * 
 * <sup>ic</sup> Ignored on Legend creation
 * <sup>iu</sup> Ignored on Legend update
 *
 * ### Examples
 *
 * @extends CGObject
 */
class Legend extends CGObject {

  /**
   * Create a new Legend.
   * @param {Viewer} viewer - The viewer
   * @param {Object} options - [Attributes](#attributes) used to create the legend
   * @param {Object} [meta] - User-defined [Meta data](../tutorials/details-meta-data.html) to add to the legend.
   */
  constructor(viewer, options = {}, meta = {}) {
    super(viewer, options, meta);
    this._items = new CGArray();
    this.backgroundColor = options.backgroundColor;
    // FIXME: start using defaultFontColor, etc from JSON
    this.defaultFontColor = utils.defaultFor(options.defaultFontColor, 'black');
    this.textAlignment = utils.defaultFor(options.textAlignment, 'left');
    this.box = new Box(viewer, {
      position: utils.defaultFor(options.position, 'top-right'),
      anchor: utils.defaultFor(options.anchor, 'middle-center')
    });
    // Setting font will refresh legend and draw
    this.defaultFont = utils.defaultFor(options.defaultFont, 'sans-serif, plain, 14');
    this.defaultMinArcLength = utils.defaultFor(options.defaultMinArcLength, 1);

    this.viewer.trigger('legend-update', { attributes: this.toJSON({includeDefaults: true}) });

    if (options.items) {
      this.addItems(options.items);
    }
    // FIXME: should be done whenever an item is added
    this.refresh();
  }

  /**
   * Return the class name as a string.
   * @return {String} - 'Legend'
   */
  toString() {
    return 'Legend';
  }

  get visible() {
    return this._visible;
  }

  set visible(value) {
    // super.visible = value;
    this._visible = value;
    this.viewer.refreshCanvasLayer();
    // this.refresh();
  }

  /**
   * @member {Context} - Get the *Context* for drawing.
   * @private
   */
  // FIXME: 
  // - if this is slow we could be set when setting "on" (e.g. this._ctx = ...)
  get ctx() {
    // return this._ctx || this.canvas.context('forground');
    const layer = (this.on === 'map') ? 'foreground' : 'canvas';
    return this.canvas.context(layer);
  }
  //
  // /**
  //  * @member {String} - Alias for getting the position. Useful for querying CGArrays.
  //  */
  // get id() {
  //   return this.position;
  // }

  /**
   * @member {Position} - Get or set the position
   */
  get position() {
    return this.box.position;
  }

  set position(value) {
    this.clear();
    this.box.position = value;
    this.viewer.refreshCanvasLayer();
    // this.refresh();
  }

  /**
   * @member {String} - Get or set where the legend should be position: 'canvas', 'map'
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
   * @member {Anchor} - Get or set legend anchor
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
   * @member {Color} - Get or set the backgroundColor. When setting the color, a string representing the color or a {@link Color} object can be used. For details see {@link Color}.
   */
  get backgroundColor() {
    // TODO set to cgview background color if not defined
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
   * @member {Font} - Get or set the default font. When setting the font, a string representing the font or a {@link Font} object can be used. For details see {@link Font}.
   */
  get defaultFont() {
    return this._defaultFont;
  }

  set defaultFont(value) {
    if (value.toString() === 'Font') {
      this._defaultFont = value;
    } else {
      this._defaultFont = new Font(value);
    }

    // Trigger update events for items with default font
    for (let i = 0, len = this._items.length; i < len; i++) {
      const item = this._items[i];
      if (item.usingDefaultFont) {
        item.update({font: undefined});
      }
    }

    this.refresh();
  }

  /**
   * @member {Color} - Get or set the defaultFontColor. When setting the color, a string representing the color or a {@link Color} object can be used. For details see {@link Color}.
   */
  get defaultFontColor() {
    // return this._fontColor.rgbaString;
    return this._defaultFontColor;
  }

  set defaultFontColor(value) {
    if (value.toString() === 'Color') {
      this._defaultFontColor = value;
    } else {
      this._defaultFontColor = new Color(value);
    }

    // Trigger update events for items with default font color
    for (let i = 0, len = this._items.length; i < len; i++) {
      const item = this._items[i];
      if (item.usingDefaultFontColor) {
        item.update({fontColor: undefined});
      }
    }

    this.refresh();
  }

  /**
   * @member {String} - Get or set the text alignment. Possible values are *left*, or *right*.
   */
  get textAlignment() {
    return this._textAlignment;
  }

  set textAlignment(value) {
    if ( utils.validate(value, ['left', 'right']) ) {
      this._textAlignment = value;
    }
    this.refresh();
  }

  /**
   * @member {Number} - Get or set the defaultMinArcLength for legend items. The value must be between 0 to 2 pixels [Default: 1].
   *   Minimum arc length refers to the minimum size (in pixels) an arc will be drawn.
   *   At some scales, small features will have an arc length of a fraction
   *   of a pixel. In these cases, the arcs are hard to see.
   *   A minArcLength of 0 means no adjustments will be made.
   */
  get defaultMinArcLength() {
    return this._defaultMinArcLength;
  }

  set defaultMinArcLength(value) {
    this._defaultMinArcLength = utils.constrain(Number(value), 0, 2);

    // Trigger update events for items with default font
    for (let i = 0, len = this._items.length; i < len; i++) {
      const item = this._items[i];
      if (item.usingDefaultMinArcLength) {
        item.update({minArcLength: undefined});
      }
    }
  }
  /**
   * @member {LegendItem} - Get or set the selected swatch legendItem
   * @private
   */
  get selectedSwatchedItem() {
    return this._selectedSwatchedItem;
  }

  set selectedSwatchedItem(value) {
    this._selectedSwatchedItem = value;
  }

  /**
   * @member {LegendItem} - Get or set the highlighted swatch legendItem
   * @private
   */
  get highlightedSwatchedItem() {
    return this._highlightedSwatchedItem;
  }

  set highlightedSwatchedItem(value) {
    this._highlightedSwatchedItem = value;
  }

  /**
   * Update legend [attributes](#attributes).
   * See [updating records](../docs.html#s.updating-records) for details.
   * @param {Object} attributes - Object describing the properties to change
   */
  update(attributes) {
    this.viewer.updateRecords(this, attributes, {
      recordClass: 'Legend',
      validKeys: ['on', 'position', 'anchor', 'defaultFont', 'defaultFontColor', 'defaultMinArcLength', 'textAlignment',  'backgroundColor', 'visible']
    });
    this.viewer.trigger('legend-update', { attributes });
  }

  /**
   * @member {CGArray} - Get the 
   */
  /**
   * Returns a [CGArray](CGArray.html) of legendItems or a single legendItem.
   * See [reading records](../docs.html#s.reading-records) for details.
   * @param {Integer|String|Array} term - See [CGArray.get](CGArray.html#get) for details.
   * @return {LegendItem|CGArray}
   */
  items(term) {
    return this._items.get(term);
  }

  /**
   * @member {CGArray} - Get the vidible legendItems
   * @private
   */
  visibleItems(term) {
    return this._items.filter( i => i.visible ).get(term);
  }

  /**
   * Add one or more [legendItems](LegendItem.html) (see [attributes](LegendItem.html#attributes)).
   * See [adding records](../docs.html#s.adding-records) for details
   * @param {Object|Array} data - Object or array of objects describing the legendItems
   * @return {CGArray<LegendItem>} CGArray of added legendItems
   */
  addItems(itemData = []) {
    itemData = CGArray.arrayerize(itemData);
    const items = itemData.map( (data) => new LegendItem(this, data));
    this.viewer.trigger('legendItems-add', items);
    return items;
  }

  /**
   * Remove legendItems.
   * See [removing records](../docs.html#s.removing-records) for details
   * @param {LegendItem|Array} items - legendItem or a array of legendItems to remove
   */
  removeItems(items) {
    items = CGArray.arrayerize(items);
    this._items = this._items.filter( i => !items.includes(i) );
    this.viewer.clear('canvas');
    this.viewer.refreshCanvasLayer();
    // Remove from Objects
    items.forEach( i => i.deleteFromObjects() );
    this.viewer.trigger('legendItems-remove', items);
  }

  /**
   * Update [attributes](LegendItem.html#attributes) for one or more legendItems.
   * See [updating records](../docs.html#s.updating-records) for details.
   * @param {LegendItem|Array|Object} itemsOrUpdates - legendItem, array of legendItems or object describing updates
   * @param {Object} attributes - Object describing the properties to change
   */
  updateItems(itemsOrUpdates, attributes) {
    const { records: items, updates } = this.viewer.updateRecords(itemsOrUpdates, attributes, {
      recordClass: 'LegendItem',
      validKeys: ['name', 'font', 'fontColor', 'drawSwatch',  'swatchColor', 'decoration', 'minArcLength', 'visible']
    });
    this.viewer.trigger('legendItems-update', { items, attributes, updates });
  }

  /**
   * Move a legendItem from one index to a new one
   * @param {Number} oldIndex - Index of legendItem to move (0-based)
   * @param {Number} newIndex - New index for the legendItem (0-based)
   */
  moveItem(oldIndex, newIndex) {
    this._items.move(oldIndex, newIndex);
    this.viewer.trigger('legendItems-moved', {oldIndex: oldIndex, newIndex: newIndex});
    this.refresh();
  }

  /**
   * Move to the Legend position (if it's position on the map)
   * @param {Number} duration - Duration of the animation
   */
  moveTo(duration) {
    this.position.moveTo(duration);
  }

  /**
   * Recalculates the *Legend* size and position.
   * @private
   */
  refresh() {
    const box = this.box;
    if (!box) { return; }
    this.clear();

    let height = 0;
    let maxHeight = 0;

    const visibleItems = this.visibleItems();
    for (let i = 0, len = visibleItems.length; i < len; i++) {
      const item = visibleItems[i];
      const itemHeight = item.height;
      height += itemHeight;
      if (i < len - 1) {
        // Add spacing
        height += (itemHeight / 2);
      }
      if (itemHeight > maxHeight) {
        maxHeight = itemHeight;
      }
    }

    box.padding = maxHeight / 2;
    height += box.padding * 2;

    // Calculate Legend Width
    const itemFonts = visibleItems.map( i => i.font.css );
    const itemNames = visibleItems.map( i => i.name );
    const itemWidths = Font.calculateWidths(this.ctx, itemFonts, itemNames);
    for (let i = 0, len = itemWidths.length; i < len; i++) {
      const item = visibleItems[i];
      if (item.drawSwatch) {
        itemWidths[i] += item.height + (box.padding / 2);
      }
      item._width = itemWidths[i];
    }
    const width = d3.max(itemWidths) + (box.padding * 2);

    box.resize(width, height);

    this.draw();
  }

  /**
   * Sets the position of the [ColorPicker](ColorPicker.html).
   * @private
   */
  setColorPickerPosition(cp) {
    const margin = 5;
    const originX = this.box.x;
    const originY = this.box.y;

    // Default: left of legend and aligned with top
    let pos = {x: originX - cp.width - margin, y: originY + margin};

    const legendWidth = this.box.width;
    const legendHeight = this.box.height;
    if (originX < cp.width) {
      pos.x = originX + legendWidth + margin;
    }
    if ( (this.viewer.height - originY) < cp.height) {
      pos.y = this.box.bottom - cp.height - margin;
    }

    cp.setPosition(pos);
  }

  /**
   * @member {Number} - Get the swatch padding
   * @private
   */
  get swatchPadding() {
    return this.box.padding / 2;
  }

  /**
   * Fills the legend background color
   * @private
   */
  fillBackground() {
    const box = this.box;
    this.ctx.fillStyle = this.backgroundColor.rgbaString;
    this.clear();
    this.ctx.fillRect(box.x, box.y, box.width, box.height);
  }

  /**
   * Invert colors of all legendItems
   */
  invertColors(all = true) {
    this.update({
      backgroundColor: this.backgroundColor.invert().rgbaString,
      defaultFontColor: this.defaultFontColor.invert().rgbaString
    });
    this.items().each( (i, item) => item.invertColors(all) );
  }

  /**
   * Find the legendItem with the provided name or return undefined.
   * @param {String} name - Name of legendItem
   * @return {LegendItem} Returns undefined if not found
   */
  findLegendItemByName(name) {
    if (typeof name !== 'string') { return; }
    // console.log(name)
    return this._items.find( i => name.toLowerCase() === i.name.toLowerCase() );
  }

  /**
   * Find the legendItem with the provided name or create a new legendItem.
   * @param {String} name - Name of legendItem
   * @param {Color} color - Use this color if creating a new legendItem
   * @param {String} decoration - Use this decoration if creating a new legendItem
   * @return {LegendItem}
   *
   */
  findLegendItemOrCreate(name = 'Unknown', color = null, decoration = 'arc') {
    let item = this.findLegendItemByName(name);
    if (!item) {
      const obj = this.viewer.objects(name);
      if (obj && obj.toString() === 'LegendItem') {
        item = obj;
      }
    }
    if (!item) {
      if (!color) {
        const currentColors = this._items.map( i => i.swatchColor );
        // color = Color.getColor(currentColors);
        color = Color.getColor(currentColors).rgbaString;
      }
      item = this.addItems({
        name: name,
        swatchColor: color,
        decoration: decoration
      })[0];
    }
    return item;
  }

  /**
   * Returns a CGArray of LegendItems that only occur for the supplied features.
   * (i.e. the returned LegendItems are not being used for any features (or plots) not provided.
   * This is useful for determining if LegendItems should be deleted after deleting features.
   * @private
   */
  uniqueLegendsItemsFor(options = {}) {
    const selectedFeatures = new Set(options.features || []);
    const selectedPlots = new Set(options.plots || []);
    const uniqueItems = new Set();

    selectedFeatures.forEach( (f) => {
      uniqueItems.add(f.legend);
    });
    selectedPlots.forEach( (p) => {
      uniqueItems.add(p.legendItemPositive);
      uniqueItems.add(p.legendItemNegative);
    });

    const nonSelectedFeatures = new Set();
    this.viewer.features().each( (i, f) => {
      if (!selectedFeatures.has(f)) {
        nonSelectedFeatures.add(f);
      }
    });
    const nonSelectedPlots = new Set();
    this.viewer.plots().each( (i, p) => {
      if (!selectedPlots.has(p)) {
        nonSelectedPlots.add(p);
      }
    });

    nonSelectedFeatures.forEach( (f) => {
      if (uniqueItems.has(f.legend)) {
        uniqueItems.delete(f.legend);
      }
    });
    nonSelectedPlots.forEach( (p) => {
      if (uniqueItems.has(p.legendItemPositive)) {
        uniqueItems.delete(p.legendItemPositive);
      }
      if (uniqueItems.has(p.legendItemNegative)) {
        uniqueItems.delete(p.legendItemNegative);
      }
    });
    return Array.from(uniqueItems);
  }

  /**
   * Clear the box containing the legend
   */
  clear() {
    this.box.clear(this.ctx);
  }

  /**
   * Draw the legend
   * @private
   */
  draw() {
    if (!this.visible) { return; }
    const ctx = this.ctx;

    // Update the box origin if relative to the map
    this.box.refresh();

    this.fillBackground();
    let swatchX;
    ctx.lineWidth = 1;
    // ctx.textBaseline = 'top';
    ctx.textBaseline = 'alphabetic'; // The default baseline works best across canvas and svg
    for (let i = 0, len = this._items.length; i < len; i++) {
      const legendItem = this._items[i];
      if (!legendItem.visible) { continue; }
      const y = legendItem.textY();
      const drawSwatch = legendItem.drawSwatch;
      const swatchWidth = legendItem.swatchWidth;
      ctx.font = legendItem.font.css;
      ctx.textAlign = legendItem.textAlignment;
      if (drawSwatch) {
        // Swatch border color
        if (legendItem.swatchSelected) {
          ctx.strokeStyle = 'black';
        } else if (legendItem.swatchHighlighted) {
          ctx.strokeStyle = 'grey';
        }
        // Draw box around Swatch depending on state
        swatchX = legendItem.swatchX();
        if (legendItem.swatchSelected || legendItem.swatchHighlighted) {
          const border = 2;
          ctx.strokeRect(swatchX - border, y - border, swatchWidth + (border * 2), swatchWidth + (border * 2));
        }
        // Draw Swatch
        ctx.fillStyle = legendItem.swatchColor.rgbaString;
        ctx.fillRect(swatchX, y, swatchWidth, swatchWidth);
      }
      // Draw Text Label
      ctx.fillStyle = legendItem.fontColor.rgbaString;
      // ctx.fillText(legendItem.name, legendItem.textX(), y);
      ctx.fillText(legendItem.name, legendItem.textX(), y + legendItem.height - 1);
    }
  }

  /**
   * Returns JSON representing the object
   */
  toJSON(options = {}) {
    const json = {
      name: this.name,
      position: this.position.toJSON(options),
      textAlignment: this.textAlignment,
      defaultFont: this.defaultFont.string,
      defaultFontColor: this.defaultFontColor.rgbaString,
      defaultMinArcLength: this.defaultMinArcLength,
      backgroundColor: this.backgroundColor.rgbaString,
      items: []
    };
    if (this.position.onMap) {
      json.anchor = this.anchor.toJSON(options);
    }
    // Optionally add default values
    if (!this.visible || options.includeDefaults) {
      json.visible = this.visible;
    }
    this.items().each( (i, item) => {
      json.items.push(item.toJSON(options));
    });
    return json;
  }

}

export default Legend;


