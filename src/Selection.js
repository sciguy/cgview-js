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

/**
 * The Selection object controls feature selection from viewer interactions.
 *
 * <a name="attributes"></a>
 * ### Attributes
 *
 * Attribute           | Type    | Description
 * --------------------|---------|------------
 * [enabled](#enabled) | Boolean | Select features from clicks and clear with Escape [Default: true]
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
    this.enabled = utils.defaultFor(options.enabled, true);
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
    this._enabled = enabled;
    if (enabled) {
      this.attach();
    } else {
      this.detach();
    }
  }

  /**
   * Enable viewer selection interactions.
   */
  attach() {
    this.viewer.off('click.cgv-selection');
    this.viewer.on('click.cgv-selection', (event) => this.handleClick(event));
    document.removeEventListener('keydown', this._handleKeydown);
    document.addEventListener('keydown', this._handleKeydown);
  }

  /**
   * Disable viewer selection interactions.
   */
  detach() {
    this.viewer.off('click.cgv-selection');
    document.removeEventListener('keydown', this._handleKeydown);
  }

  /**
   * Update selection [attributes](#attributes).
   * See [updating records](../docs.html#s.updating-records) for details.
   * @param {Object} attributes - Object describing the properties to change
   */
  update(attributes) {
    this.viewer.updateRecords(this, attributes, {
      recordClass: 'Selection',
      validKeys: ['enabled']
    });
    this.viewer.trigger('selection-update', { attributes });
  }

  /**
   * Select the clicked feature, or clear selection when no feature is clicked.
   * Shift-click adds to the existing selection.
   * @param {Object} event - Event-like object from EventMonitor.
   */
  handleClick(event = {}) {
    const feature = this.featureFromEvent(event);
    if (!feature) {
      this.clear();
      return;
    }
    const append = Boolean(event.d3 && event.d3.shiftKey);
    this.select(feature, { append });
  }

  /**
   * Clear selection when Escape is pressed.
   * @param {KeyboardEvent} event - Keyboard event.
   */
  handleKeydown(event) {
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
  updateFeatures(updates) {
    if (Object.keys(updates).length === 0) { return; }
    this.viewer.updateFeatures(updates);
    this.viewer.draw();
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
