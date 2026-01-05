//////////////////////////////////////////////////////////////////////////////
// Dividers
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

import Divider from './Divider';
import CGArray from './CGArray';

/**
 * Dividers is a container for the track and slot [divider](Divider.html).
 * They are accessed from the viewer object (e.g. cgv):
 * - cgv.dividers.track - controls spacing/lines between tracks.
 * - cgv.dividers.slot - controls spacing/lines betweens slots within a track.
 *
 * <a name="attributes"></a>
 * ### Attributes
 *
 *  Option                        | Description
 *  ------------------------------|----------------------------
 *  [track](#track)               |  [Divider attributes](Divider.html#attributes) for tracks
 *  [slot](#slot)                 |  [Divider attributes](Divider.html#attributes) for slots
 */
class Dividers {

  /**
   * Create the dividers container
   * @param {Viewer} viewer - The viewer that contains the dividers
   * @param {Object} options - [Attributes](#attributes) used to create the dividers. Passed on slot and track divider.
   * @param {Object} [meta] - User-defined [Meta data](../tutorials/details-meta-data.html) to add to the dividers
   */
  constructor(viewer, options = {}, meta = {}) {
    this.viewer = viewer;

    const keys = Object.keys(options);
    // Both track and slot data is provided
    if (keys.includes('slot') && keys.includes('track')) {
      this._slot = new Divider(viewer, 'slot', options.slot);
      this._track = new Divider(viewer, 'track', options.track);
    } else {
      // Only one of track or slot data is provided. Mirro data.
      if (keys.includes('slot')) {
        this._slot = new Divider(viewer, 'mirrored', options.slot);
        this._track = this.slot;
      } else if (keys.includes('track')) {
        this._track = new Divider(viewer, 'mirrored', options.track);
        this._slot = this.track;
      } else {
        // Neither track or slot data is provided. Create default slot and mirror.
        this._slot = new Divider(viewer, 'mirrored');
        this._track = this.slot;
      }
    }

    this.clearBbOffsets();
    // this.viewer.trigger('settings-update', {attributes: this.toJSON({includeDefaults: true})});
  }

  /**
   * Return the class name as a string.
   * @return {String} - 'Dividers'
   */
  toString() {
    return 'Dividers';
  }

  /**
   * Returns the track divider
   */
  get track() {
    return this._track;
  }

  /**
   * Returns the slot divider
   */
  get slot() {
    return this._slot;
  }

  /**
   * Returns true if the slot and track divider are mirrored
   */
  get dividersMirrored() {
    return this.slot === this.track;
  }

  /**
   * If a dividier is provided, the other divider will be mirroed to the provide one.
   * If no divider is provided, the dividers will no longer be mirrored.
   * @private
   */
  mirrorDivider(divider) {
    if (divider) {
      // Mirror other divider to the one provided
      if (this.slot === divider) {
        this._track = this.slot;
      } else {
        this._slot = this.track;
      }
      this.slot._name = 'mirrored';
    } else {
      // Turn off mirroring
      this._track = new Divider(this.viewer, 'track', this.slot.toJSON());
      this.slot._name = 'slot';
    }

  }

  /**
   * @member {Number} - Returns a CGArray where each element is an object with 2 properties: distance, type. The 'distance' is the divider distance from the backbone. The 'type' is the divider type (e.g. 'slot' or 'track').
   * @private
   */
  get bbOffsets() {
    return this._bbOffsets;
  }

  /**
   * @private
   */
  clearBbOffsets() {
    this._bbOffsets = new CGArray();
  }

  /**
   * @private
   */
  addBbOffset(bbOffset, type) {
    if (['track', 'slot'].includes(type)) {
      this._bbOffsets.push({distance: bbOffset, type: type});
    } else {
      throw 'Divider bbOffset type must be one of "slot" or "track"';
    }
  }

  /**
   * Invert colors of the dividers
   */
  invertColors() {
    if (this.track.mirror) {
      this.track.update({ color: this.track.color.invert().rgbaString });
    } else {
      this.track.update({ color: this.track.color.invert().rgbaString });
      this.slot.update({ color: this.slot.color.invert().rgbaString });
    }
  }

  /**
   * Draw the dividers
   * @private
   */
  draw() {
    const canvas = this.viewer.canvas;
    const backboneOffset = this.viewer.backbone.adjustedCenterOffset;
    // if (!this.visible || this.thickness === 0) { return; }
    for (let i = 0, len = this._bbOffsets.length; i < len; i++) {
      const bbOffset = this._bbOffsets[i];
      if (!this[bbOffset.type].visible) { continue; } 
      const centerOffset = backboneOffset + bbOffset.distance;
      // const visibleRange = canvas.visibleRangeForCenterOffset(centerOffset, 100);
      const visibleRange = canvas.visibleRangeForCenterOffset(centerOffset, { margin: 100 });
      if (visibleRange) {
        canvas.drawElement('map', visibleRange.start, visibleRange.stop, centerOffset, this[bbOffset.type].color.rgbaString, this[bbOffset.type].adjustedThickness);
      }
    }
  }

  /**
   * Returns JSON representing the object
   */
  toJSON(options = {}) {
    if (this.slot === this.track) {
      return {
        slot: this._slot.toJSON(options),
      };
    } else {
      return {
        track: this._track.toJSON(options),
        slot: this._slot.toJSON(options),
      };
    }
  }

}

export default Dividers;


