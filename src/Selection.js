//////////////////////////////////////////////////////////////////////////////
// Selection
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
import CGRange from './CGRange';

/**
 * The Selection object controls feature selection from viewer interactions.
 *
 * <a name="attributes"></a>
 * ### Attributes
 *
 * Attribute           | Type    | Description
 * --------------------|---------|------------
 * [enabled](#enabled) | Boolean | Select features from clicks and clear with Escape [Default: false]
 */
class Selection {

  /**
   * Create a Selection object.
   * @param {Viewer} viewer - The viewer
   * @param {Object} options - [Attributes](#attributes) used to create the selection object.
   */
  constructor(viewer, options = {}) {
    this.viewer = viewer;
    this._handleKeydown = this.handleKeydown.bind(this);
    this._marquee = undefined;
    this._suppressClick = false;
    this.enabled = utils.defaultFor(options.enabled, false);
  }

  /**
   * Return the class name as a string.
   * @return {String} - 'Selection'
   */
  toString() {
    return 'Selection';
  }

  /**
   * @member {Boolean} - Get or set whether selection interactions are enabled.
   */
  get enabled() {
    return this._enabled;
  }

  set enabled(value) {
    const enabled = Boolean(value);
    if (this._enabled === enabled) { return; }
    const initialized = this._enabled !== undefined;
    this._enabled = enabled;
    if (enabled) {
      this.attach();
    } else {
      this.detach();
    }
    if (initialized) {
      this.viewer.trigger('selection-update', { attributes: { enabled } });
    }
  }

  /**
   * Enable viewer selection interactions.
   */
  attach() {
    this.viewer.off('.cgv-selection');
    this.viewer.on('mousedown.cgv-selection', (event) => this.enabled && this.handleMousedown(event));
    this.viewer.on('mousemove.cgv-selection', (event) => this.enabled && this.handleMousemove(event));
    this.viewer.on('mouseup.cgv-selection', (event) => this.enabled && this.handleMouseup(event));
    this.viewer.on('click.cgv-selection', (event) => this.enabled && this.handleClick(event));
    document.removeEventListener('keydown', this._handleKeydown);
    document.addEventListener('keydown', this._handleKeydown);
  }

  /**
   * Disable viewer selection interactions.
   */
  detach() {
    this.viewer.off('.cgv-selection');
    this._marquee = undefined;
    this._suppressClick = false;
    document.removeEventListener('keydown', this._handleKeydown);
  }

  /**
   * Update selection [attributes](#attributes).
   * See [updating records](../docs.html#s.updating-records) for details.
   * @param {Object} attributes - Object describing the properties to change
   */
  update(attributes) {
    const previousEnabled = this.enabled;
    this.viewer.updateRecords(this, attributes, {
      recordClass: 'Selection',
      validKeys: ['enabled']
    });
    if (!Object.prototype.hasOwnProperty.call(attributes, 'enabled') || previousEnabled === this.enabled) {
      this.viewer.trigger('selection-update', { attributes });
    }
  }

  /**
   * Select the clicked feature, or clear selection when no feature is clicked.
   * Shift-click adds to the existing selection.
   * @param {Object} event - Event-like object from EventMonitor.
   */
  handleClick(event = {}) {
    if (!this.enabled) { return; }
    if (this._suppressClick) {
      this._suppressClick = false;
      return;
    }
    const feature = this.featureFromEvent(event);
    if (!feature) {
      this.clear();
      return;
    }
    const append = Boolean(event.d3 && event.d3.shiftKey);
    this.select(feature, { append });
  }

  /**
   * Start marquee selection from empty map space while Shift is pressed.
   * @param {Object} event - Event-like object from EventMonitor.
   */
  handleMousedown(event = {}) {
    if (!this.enabled) { return; }
    if (!this.canStartMarquee(event)) { return; }
    this._marquee = {
      startBp: event.bp,
      stopBp: event.bp,
      stopBpUnwrapped: event.bp,
      dragged: false,
      initialSelectedFeatures: new Set(this.selectedFeatures()),
      selectedFeatures: new Set()
    };
    if (event.d3.preventDefault) {
      event.d3.preventDefault();
    }
  }

  /**
   * Return whether a mousedown event should start marquee selection.
   * @param {Object} event - Event-like object from EventMonitor.
   * @return {Boolean}
   */
  canStartMarquee(event = {}) {
    const marqueeStartElementTypes = [undefined, 'feature', 'label', 'plot', 'backbone', 'contig'];
    const shiftKeyDown = Boolean(event.d3 && event.d3.shiftKey);
    return Boolean(this.enabled && shiftKeyDown && marqueeStartElementTypes.includes(event.elementType));
  }

  /**
   * Update marquee selection while dragging.
   * @param {Object} event - Event-like object from EventMonitor.
   */
  handleMousemove(event = {}) {
    if (!this.enabled) { return; }
    if (!this._marquee) { return; }
    this.updateMarqueeStop(event.bp);
    this._marquee.dragged = this._marquee.dragged || (this._marquee.stopBpUnwrapped !== this._marquee.startBp);
    this.selectFeaturesInMarquee();
    this.drawMarquee();
  }

  /**
   * Finish marquee selection and clear it from the UI layer.
   * @param {Object} event - Event-like object from EventMonitor.
   */
  handleMouseup(event = {}) {
    if (!this.enabled) { return; }
    if (!this._marquee) { return; }
    if (event.bp !== undefined) {
      this.updateMarqueeStop(event.bp);
    }
    if (this._marquee.dragged) {
      this.selectFeaturesInMarquee();
      this._suppressClick = true;
    }
    this._marquee = undefined;
    this.viewer.clear('ui');
  }

  /**
   * Clear selection when Escape is pressed.
   * @param {KeyboardEvent} event - Keyboard event.
   */
  handleKeydown(event) {
    if (!this.enabled) { return; }
    if (event.key === 'Escape') {
      this.clear();
    }
  }

  /**
   * Return the feature from a click event.
   * @param {Object} event - Event-like object from EventMonitor.
   * @return {Feature|undefined}
   */
  featureFromEvent(event = {}) {
    if (event.elementType === 'feature') {
      return event.element;
    }
    if (event.elementType === 'label') {
      return event.element && event.element.feature;
    }
  }

  /**
   * Select a feature.
   * @param {Feature} feature - Feature to select.
   * @param {Object} options - Selection options.
   * @param {Boolean} options.append - Keep currently selected features selected.
   */
  select(feature, options = {}) {
    const append = utils.defaultFor(options.append, false);
    const updates = {};
    if (!feature.selected) {
      updates[feature.cgvID] = { selected: true };
    }
    if (!append) {
      const selectedFeatures = this.selectedFeatures();
      for (const selectedFeature of selectedFeatures) {
        if (selectedFeature !== feature) {
          updates[selectedFeature.cgvID] = { selected: false };
        }
      }
    }
    this.updateFeatures(updates);
  }

  /**
   * Deselect all selected features.
   */
  clear() {
    const updates = {};
    const selectedFeatures = this.selectedFeatures();
    for (const selectedFeature of selectedFeatures) {
      updates[selectedFeature.cgvID] = { selected: false };
    }
    this.updateFeatures(updates);
  }

  /**
   * Select visible features that overlap the active marquee range.
   */
  selectFeaturesInMarquee() {
    const range = this.marqueeRange();
    if (!range) { return; }
    const updates = {};
    const featuresInRange = new Set();
    const features = this.viewer.features();
    for (const feature of features) {
      if (feature.visible && feature.mapRange.overlapsMapRange(range)) {
        featuresInRange.add(feature);
        if (!feature.selected) {
          updates[feature.cgvID] = { selected: true };
        }
        if (!this._marquee.initialSelectedFeatures.has(feature)) {
          this._marquee.selectedFeatures.add(feature);
        }
      }
    }
    for (const feature of this._marquee.selectedFeatures) {
      if (!featuresInRange.has(feature)) {
        updates[feature.cgvID] = { selected: false };
        this._marquee.selectedFeatures.delete(feature);
      }
    }
    this.updateFeatures(updates);
  }

  /**
   * Update the marquee stop position, preserving circular drag direction.
   * @param {Number} bp - Base pair position under the mouse.
   */
  updateMarqueeStop(bp) {
    if (bp === undefined) { return; }
    if (this.viewer.format === 'linear') {
      this._marquee.stopBp = bp;
      this._marquee.stopBpUnwrapped = bp;
      return;
    }

    const referenceBp = (this._marquee.stopBpUnwrapped === undefined) ? this._marquee.startBp : this._marquee.stopBpUnwrapped;
    const stopBpUnwrapped = this.nearestUnwrappedBp(bp, referenceBp);
    this._marquee.stopBpUnwrapped = stopBpUnwrapped;
    this._marquee.stopBp = this.normalizeMapBp(stopBpUnwrapped);
  }

  /**
   * Return the active marquee selection range.
   * @return {CGRange|undefined}
   */
  marqueeRange() {
    if (!this._marquee) { return; }
    let start = this._marquee.startBp;
    let stop = this._marquee.stopBp;
    if (this.viewer.format === 'linear' && stop < start) {
      [start, stop] = [stop, start];
    } else if (this.viewer.format === 'circular' && this._marquee.stopBpUnwrapped < this._marquee.startBp) {
      [start, stop] = [stop, start];
    }
    return new CGRange(this.viewer.sequence.mapContig, start, stop);
  }

  /**
   * Return the equivalent base pair nearest to a continuous reference position.
   * @param {Number} bp - Wrapped base pair.
   * @param {Number} referenceBp - Continuous base pair position to compare with.
   * @return {Number}
   */
  nearestUnwrappedBp(bp, referenceBp) {
    const length = this.viewer.sequence.mapContig.length;
    const normalizedBp = this.normalizeMapBp(bp);
    const rotations = Math.round((referenceBp - normalizedBp) / length);
    return normalizedBp + (rotations * length);
  }

  /**
   * Normalize a base pair to the map coordinate range.
   * @param {Number} bp - Base pair.
   * @return {Number}
   */
  normalizeMapBp(bp) {
    const length = this.viewer.sequence.mapContig.length;
    return ((((bp - 1) % length) + length) % length) + 1;
  }

  /**
   * Draw the active marquee on the UI layer.
   */
  drawMarquee() {
    const range = this.marqueeRange();
    if (!range) { return; }
    const layout = this.viewer.layout;
    const innerOffset = Math.min(layout.centerInsideOffset, layout.centerOutsideOffset);
    const outerOffset = Math.max(layout.centerInsideOffset, layout.centerOutsideOffset);
    const boundaryPadding = 2;
    const marqueeInnerOffset = innerOffset - boundaryPadding;
    const marqueeOuterOffset = outerOffset + boundaryPadding;
    const width = marqueeOuterOffset - marqueeInnerOffset;
    if (width <= 0) { return; }
    const centerOffset = marqueeInnerOffset + (width / 2);
    const color = 'rgba(0, 120, 215, 0.18)';
    const edgeColor = 'rgba(0, 120, 215, 0.75)';
    const edgeWidth = 1;
    const edgeDashes = [4, 2];

    this.viewer.canvas.drawElement({
      layer: 'ui',
      start: range.start,
      stop: range.stop,
      centerOffset,
      color,
      width,
      decoration: 'arc',
      showShading: false,
      showBorder: false,
      minArcLength: 0
    });
    this.drawMarqueeBoundary(range, marqueeInnerOffset, edgeWidth, edgeColor, edgeDashes);
    this.drawMarqueeBoundary(range, marqueeOuterOffset, edgeWidth, edgeColor, edgeDashes);
    this.viewer.canvas.radiantLine('ui', range.start, marqueeInnerOffset, width, edgeWidth, edgeColor, 'butt', edgeDashes);
    this.viewer.canvas.radiantLine('ui', range.stop, marqueeInnerOffset, width, edgeWidth, edgeColor, 'butt', edgeDashes);
    this.viewer.canvas.context('ui').setLineDash([]);
  }

  /**
   * Draw one dotted marquee boundary along the map.
   * @param {CGRange} range - Base pair range covered by the marquee.
   * @param {Number} centerOffset - Distance from center of map to the boundary.
   * @param {Number} lineWidth - Boundary line width.
   * @param {String} color - Boundary stroke color.
   * @param {Array} dashes - Boundary dash pattern.
   */
  drawMarqueeBoundary(range, centerOffset, lineWidth, color, dashes) {
    const layer = 'ui';
    const ctx = this.viewer.canvas.context(layer);
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineCap = 'butt';
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(dashes);
    this.viewer.canvas.path(layer, centerOffset, range.start, range.stop);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /**
   * Return all selected features.
   * @return {CGArray}
   */
  selectedFeatures() {
    return this.viewer.features().filter((feature) => feature.selected);
  }

  /**
   * Apply selection updates and redraw when the selection changed.
   * @param {Object} updates - Per-feature updates keyed by cgvID.
   */
  updateFeatures(updates, options = {}) {
    if (Object.keys(updates).length === 0) { return; }
    this.viewer.updateFeatures(updates);
    if (utils.defaultFor(options.draw, true)) {
      this.viewer.draw();
    }
  }

  /**
   * Returns JSON representing the object.
   */
  toJSON() {
    return {
      enabled: this.enabled
    };
  }

}

export default Selection;
