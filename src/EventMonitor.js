//////////////////////////////////////////////////////////////////////////////
// EventMonitor
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
import * as d3 from 'd3';

/**
 * EventMonitor sets up mouse click and movement event handlers on the CGView canvas.
 *
 * CGView event contents (based on mouse position):
 *
 * Property   | Description
 * -----------|-----------------------------------------------
 *  bp        | Base pair
 *  centerOffset | Distance from center of the map. For a circular map, this is the radius, while for a linear map, it's the distance from the backbone.
 *  elementType | One of: 'legendItem', 'caption', 'feature', 'plot', 'backbone', 'contig', 'label', or undefined
 *  element   | The element (e.g, a feature), if there is one.
 *  slot      | Slot (if there is one). Track can be accessed from the slot (<em>slot.track</em>).
 *  score     | Score for element (e.g. feature, plot), if available.
 *  canvasX   | Position on the canvas X axis, where the origin is the top-left. See [scales](../tutorials/details-map-scales.html) for details.
 *  canvasY   | Position on the canvas Y axis, where the origin is the top-left. See [scales](../tutorials/details-map-scales.html) for details.
 *  mapX      | Position on the map domain X axis, where the origin is the center of the map. See [scales](../tutorials/details-map-scales.html) for details.
 *  mapY      | Position on the map domain Y axis, where the origin is the center of the map. See [scales](../tutorials/details-map-scales.html) for details.
 *  d3        | The d3 event object.
 *
 * ### Examples
 * ```js
 * // Log the feature name when clicked
 * cgv.on('click', (event) => {
 *   if (event.elementType === 'feature') {
 *     console.log(`Feature '${event.element.name}' was clicked`);
 *   }
 * });
 *
 * // Log the base pair position of the mouse as it moves
 * cgv.on('mousemove', (event) => {
 *   console.log(`BP: ${event.bp}`);
 * });
 * ```
 */
class EventMonitor {

  /**
   * Adds event handlers for mouse clicks, presses, releases, and movement
   */
  // NOTE: - a mouse property will be updated with every mouse move
  //       - This will be aliased to Viewer.mouse
  //       - Eventually add to API but for now private
  constructor(viewer) {
    this._viewer = viewer;

    // Setup Events on the viewer
    this.events = viewer.events;

    this._initializeMousemove();
    this._initializeMouseleave();
    this._initializeMousedown();
    this._initializeMouseup();
    this._initializeClick();
    this._initializeBookmarkShortcuts();
    // this.events.on('mousemove', (e) => {console.log(e.bp)})
    // this.events.on('click', (e) => {console.log(e);});
    // MoveTo On click
    // this.events.on('click', (e) => {
    //   if (e.feature) {
    //     this.viewer.moveTo(e.feature.start, e.feature.stop);
    //   }
    // })

    this.events.on('mousemove', (e) => {
      if (this.viewer.debug && this.viewer.debug.data.position) {
        this.viewer.debug.data.position.xy = `${Math.round(e.mapX)}, ${Math.round(e.mapY)}`;
        this.viewer.debug.data.position.bp = utils.commaNumber(e.bp);
        this.viewer.debug.data.position.element = e.element && e.element.name;
        this.viewer.debug.data.position.score = e.score;
        this.viewer.debug.draw();
      }
    });

    this._legendSwatchClick();
    this._legendSwatchMouseOver();
    // this._highlighterMouseOver();
  }

  /**
   * @member {Viewer} - Get the *Viewer*
   */
  get viewer() {
    return this._viewer;
  }

  /**
   * @member {Canvas} - Get the *Canvas*
   */
  get canvas() {
    return this.viewer.canvas;
  }

  /**
   * @member {Object} - Get the last mouse position on canvas
   * @private
   */
  get mouse() {
    return this._mouse;
  }

  /**
   * Initialize mouse move events under 'cgv' namespace.
   * @private
   */
  _initializeMousemove() {
    const viewer = this.viewer;
    d3.select(this.canvas.node('ui')).on('mousemove.cgv', (d3Event) => {
      const event = this._createEvent(d3Event);
      this._mouse = event;
      viewer.clear('ui');
      this.events.trigger('mousemove', event);
      // this.events.trigger('mousemove', this._createEvent(d3Event));
    });
  }

  /**
   * Clear transient hover state when the pointer leaves the Viewer.
   * A final mousemove is not guaranteed when the pointer exits quickly.
   * @private
   */
  _initializeMouseleave() {
    const viewer = this.viewer;
    d3.select(this.canvas.node('ui')).on('mouseleave.cgv', (d3Event) => {
      this._mouse = undefined;
      viewer.clear('ui');
      this.events.trigger('mouseleave', {d3: d3Event});
    });
  }

  /**
   * Initialize mouse down events under 'cgv' namespace.
   * @private
   */
  _initializeMousedown() {
    d3.select(this.canvas.node('ui')).on('mousedown.cgv', (d3Event) => {
      this.events.trigger('mousedown', this._createEvent(d3Event));
    });
  }

  /**
   * Initialize mouse up events under 'cgv' namespace.
   * @private
   */
  _initializeMouseup() {
    d3.select(this.canvas.node('ui')).on('mouseup.cgv', (d3Event) => {
      this.events.trigger('mouseup', this._createEvent(d3Event));
    });
  }

  /**
   * Initialize clicks events under 'cgv' namespace.
   * @private
   */
  _initializeClick() {
    d3.select(this.canvas.node('ui')).on('click.cgv', (d3Event) => {
      // If the canvas is clicked, stop any animations
      this.viewer.stopAnimate();
      this.events.trigger('click', this._createEvent(d3Event));
    });
  }

  // FIXME: need to be able to turn this off
  // FIXME: there should be an option to turn this off, if it interferes with other program UI
  _initializeBookmarkShortcuts() {
    const ignoredTagsRegex = /^(input|textarea|select|button)$/i;
    document.addEventListener('keypress', (e) => {
      if (ignoredTagsRegex.test(e.target.tagName)) { return; }
      if (e.target.isContentEditable) { return; }
      const bookmark = this.viewer.bookmarkByShortcut(e.key);
      if (bookmark) {
        bookmark.moveTo();
        this.viewer.trigger('bookmarks-shortcut', bookmark);
      }
    });
  }

  /**
   * Create an event object that will be return on mouse clicks and movement
   * @param {Object} d3Event - a d3 event object
   * @private
   */
  _createEvent(d3Event) {
    if (this.viewer.loading) { return {}; }
    const scale = this.viewer.layout.scale;
    const canvasX = d3Event.offsetX;
    const canvasY = d3Event.offsetY;
    const mapX = scale.x.invert(canvasX);
    const mapY = scale.y.invert(canvasY);
    const centerOffset = this.viewer.layout.centerOffsetForPoint({x: canvasX, y: canvasY});
    const slot = this.viewer.layout.slotForCenterOffset(centerOffset);
    const bp = this.canvas.bpForPoint({x: canvasX, y: canvasY});

    const {elementType, element} = this._getElement(slot, bp, centerOffset, canvasX, canvasY);

    let score;
    if (elementType === 'plot') {
      score = element.scoreForPosition(bp).toFixed(2)
    } else {
      score = element && element.score;
    }

    return {
      bp: bp,
      centerOffset: centerOffset,
      slot: slot,
      elementType: elementType,
      element: element,
      score: score,
      canvasX: canvasX,
      canvasY: canvasY,
      mapX: mapX,
      mapY: mapY,
      d3: d3Event
    };
  }

  /**
   * Returns an object with the *element* and *elementType* for the given *slot*, *bp*, and *centerOffset*.
   * ElementType can be one of the following: 'plot', 'feature', 'label', 'legendItem', 'captionItem', 'contig', 'backbone'
   * @param {Slot}  slot - the slot for the event.
   * @param {Number}  bp - the bp for the event.
   * @param {Number}  centerOffset - the centerOffset for the event.
   *
   * @returns {Object} Obejct with properties: element and elementType
   * @private
   */
  _getElement(slot, bp, centerOffset, canvasX, canvasY) {
    let elementType, element;

    // Check Legend
    const legend = this.viewer.legend;
    if (legend.visible && legend.box.containsPt(canvasX, canvasY)) {
      for (let i = 0, len = legend.items().length; i < len; i++) {
        const item = legend.items()[i];
        if (item._textContainsPoint({x: canvasX, y: canvasY})) {
          elementType = 'legendItem';
          element = item;
        }
      }
    }

    // Check Captions
    if (!elementType) {
      const captions = this.viewer.captions();
      for (let i = 0, len = captions.length; i < len; i++) {
        const caption = captions[i];
        if (caption.visible && caption.box.containsPt(canvasX, canvasY)) {
          elementType = 'caption';
          element = caption;
        }
      }
    }

    // Check for feature or plot
    if (!elementType && slot) {
      // If mulitple features are returned, go with the smallest one
      // We use fullLength (to ignore sub locations) here because we want to get the smallest feature
      const features = slot.findFeaturesForBp(bp);
      let feature;
      for (let i = 0, len = features.length; i < len; i++) {
        const currentFeature = features[i];
        if (currentFeature.visible) {
          if (!feature || (currentFeature.fullLength < feature.fullLength)) {
            feature = currentFeature;
          }
        }
      }
      if (feature && feature.visible) {
        elementType = 'feature';
        element = feature;
      } else if (slot._plot) {
        elementType = 'plot';
        element = slot._plot;
      }
    }

    // Check for Backbone or Contig
    if (!elementType && this.viewer.backbone.visible && this.viewer.backbone.containsCenterOffset(centerOffset)) {
      const backbone = this.viewer.backbone;
      const sequence = this.viewer.sequence;
      if (sequence.hasMultipleContigs) {
        elementType = 'contig';
        element = sequence.contigForBp(bp);
      } else {
        elementType = 'backbone';
        element = backbone;
      }
    }

    // Check for Labels
    if (!elementType && this.viewer.annotation.visible) {
      const labels = this.viewer.annotation._visibleLabels;
      for (let i = 0, len = labels.length; i < len; i++) {
        const label = labels[i];
        if (label.rect.containsPt(canvasX, canvasY) && label.feature.visible) {
          elementType = 'label';
          element = label;
        }
      }
    }

    return {elementType, element};
  }

  _legendSwatchClick() {
    const viewer = this.viewer;
    this.events.on('click.swatch', (e) => {
      const legend = viewer.legend;
      if (!legend.visible) return;
      const swatchedLegendItems = legend.visibleItems();
      for (let i = 0, len = swatchedLegendItems.length; i < len; i++) {
        if ( swatchedLegendItems[i]._swatchContainsPoint( {x: e.canvasX, y: e.canvasY} ) ) {
          const legendItem = swatchedLegendItems[i];
          legendItem.swatchSelected = true;
          const cp = viewer.colorPicker;
          if (!cp.visible) {
            legend.setColorPickerPosition(cp);
          }
          cp.onChange = function(color) {
            // legendItem.swatchColor = color.rgbaString;
            legendItem.update({swatchColor: color.rgbaString});
            viewer.drawFast();
            // viewer.trigger('legend-swatch-change', legendItem);
          };
          cp.onClose = function() {
            legendItem.swatchSelected = false;
            viewer.drawFull();
            legend.draw();
          };
          cp.setColor(legendItem._swatchColor.rgba);
          cp.open(legendItem);
          break;
        }
      }
    });
  }

  _legendSwatchMouseOver() {
    const viewer = this.viewer;
    this.events.on('mousemove.swatch', (e) => {
      const legend = viewer.legend;
      if (!legend.visible) return;
      const swatchedLegendItems = legend.visibleItems();
      const oldHighlightedItem = legend.highlightedSwatchedItem;
      legend.highlightedSwatchedItem = undefined;
      for (let i = 0, len = swatchedLegendItems.length; i < len; i++) {
        if ( swatchedLegendItems[i]._swatchContainsPoint( {x: e.canvasX, y: e.canvasY} ) ) {
          const legendItem = swatchedLegendItems[i];
          legendItem.swatchHighlighted = true;
          this.canvas.cursor = 'pointer';
          legend.draw();
          break;
        }
      }
      // No swatch selected
      if (oldHighlightedItem && !legend.highlightedSwatchedItem) {
        this.canvas.cursor = 'auto';
        legend.draw();
      }
    });
    this.events.on('mouseleave.swatch', () => {
      const legend = viewer.legend;
      if (!legend.highlightedSwatchedItem) { return; }
      legend.highlightedSwatchedItem = undefined;
      this.canvas.cursor = 'auto';
      legend.draw();
    });
  }

}

export default EventMonitor;
