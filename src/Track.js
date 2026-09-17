//////////////////////////////////////////////////////////////////////////////
// Track
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
import CGArray from './CGArray';
import Slot from './Slot';
import utils from './Utils';

// TODO: - Instead of check for features or plot. There could be a data attribute which
//         will point to features or a plot.

/**
 * The Track represents what data should be displayed and how it should be laid out.
 *
 * ### Action and Events
 *
 * Action                                    | Viewer Method                              | Track Method        | Event
 * ------------------------------------------|--------------------------------------------|---------------------|-----
 * [Add](../docs.html#s.adding-records)      | [addTracks()](Viewer.html#addTracks)       | -                   | tracks-add
 * [Update](../docs.html#s.updating-records) | [updateTracks()](Viewer.html#updateTracks) | [update()](#update) | tracks-update
 * [Remove](../docs.html#s.removing-records) | [removeTracks()](Viewer.html#removeTracks) | [remove()](#remove) | tracks-remove
 * [Reorder](../docs.html#s.reordering-records) | [moveTrack()](Viewer.html#moveTrack)    | [move()](#move)     | tracks-moved
 * [Read](../docs.html#s.reading-records)    | [tracks()](Viewer.html#tracks)             | -                   | -
 *
 * <a name="attributes"></a>
 * ### Attributes
 *
 * Attribute                         | Type      | Description
 * ----------------------------------|-----------|------------
 * [name](#name)                     | String    | Name of track [Default: "Unknown"]
 * [dataType](#dataType)             | String    | Type of data shown by the track: plot, feature [Default: feature]
 * [dataMethod](#dataMethod)         | String    | Methods used to extract/connect to features or a plot: sequence, source, type, tag [Default: source]
 * [dataKeys](#dataKeys)             | String\|Array | Values used by dataMethod to extract features or a plot.
 * [position](#position)             | String    | Feature tracks: inside, outside, around, or along [Default: around]. Plot tracks: inside or outside; set explicitly. The old feature-track value 'both' is an alias for 'around'.
 * [separateFeaturesBy](#separateFeaturesBy) | String    | How features should be separated: none, strand, readingFrame, type, legend [Default: strand]
 * [thicknessRatio](#thicknessRatio) | Number    | Thickness of track compared to other tracks [Default: 1]
 * [computedInitialSlotThickness](#computedInitialSlotThickness) | Number | Read-only thickness in pixels per visible slot at zoom factor 1, computed using the current canvas dimensions, ratios, and settings.
 * [loadProgress](#loadProgress)     | Number    | Number between 0 and 100 indicating progress of track loading. Used internally by workers.
 * [drawOrder](#drawOrder)           | String    | Order to draw features in: position, score [Default: position]
 * [favorite](#favorite)<sup>ic</sup> | Boolean  | Optional application flag set with update(); not saved to JSON or used for drawing.
 * [visible](CGObject.html#visible)  | Boolean   | Track is visible [Default: true]
 * [meta](CGObject.html#meta)        | Object    | [Meta data](../tutorials/details-meta-data.html) for Track
 *
 * <sup>ic</sup> Ignored on Track creation
 *
 * ### Examples
 *
 * @extends CGObject
 */
class Track extends CGObject {

  /**
   * Create a new track.
   * @param {Viewer} viewer - The viewer
   * @param {Object} options - [Attributes](#attributes) used to create the track.
   * @param {Object} [meta] - User-defined [Meta data](../tutorials/details-meta-data.html) to add to the track.
   */
  constructor(viewer, data = {}, meta = {}) {
    super(viewer, data, meta);
    this.viewer = viewer;
    this._plot;
    this._features = new CGArray();
    this._slots = new CGArray();
    this.name = utils.defaultFor(data.name, 'Unknown');
    this.separateFeaturesBy = utils.defaultFor(data.separateFeaturesBy, 'strand');
    this.drawOrder = utils.defaultFor(data.drawOrder, 'position');
    this.dataType = utils.defaultFor(data.dataType, 'feature');
    this.dataMethod = utils.defaultFor(data.dataMethod, 'source');
    this.dataKeys = data.dataKeys;
    this.dataOptions = data.dataOptions || {};
    this.position = utils.defaultFor(data.position, 'around');
    const thicknessRatio = Number(utils.defaultFor(data.thicknessRatio, 1));
    this._thicknessRatio = Number.isFinite(thicknessRatio) && thicknessRatio > 0 ? thicknessRatio : 1;
    this._loadProgress = 0;
    this.refresh();
  }

  /**
   * Optional application flag accepted by [update()](#update). It is not
   * initialized from creation data, saved to JSON, or used for drawing.
   * @member {Boolean|undefined} Track#favorite
   */

  /**
   * Return the class name as a string.
   * @return {String} - 'Track'
   */
  toString() {
    return 'Track';
  }

  /**
   * @member {Viewer} - Get the *Viewer*
   */
  get viewer() {
    return this._viewer;
  }

  set viewer(viewer) {
    if (this.viewer) {
      // TODO: Remove if already attached to Viewer
    }
    this._viewer = viewer;
    viewer._tracks.push(this);
  }


  set visible(value) {
    // super.visible = value;
    this._visible = value;
    if (this.layout) {
      this.layout._adjustProportions();
    }
  }

  get visible() {
    // return super.visible
    return this._visible;
  }

  /**
   * @member {String} - Alias for getting the name. Useful for querying CGArrays.
   */
  get id() {
    return this.name;
  }

  /**
   * @member {String} - Get or set the *name*.
   */
  get name() {
    return this._name;
  }

  set name(value) {
    this._name = value;
  }

  /** * @member {Viewer} - Get the *Layout*
   */
  get layout() {
    return this.viewer.layout;
  }


  /**
   * @member {String} - Get or set the *drawOrder*. Must be one of 'position' or 'score' [Default: 'position']
   * - position: Features are drawn in the (opposite) order they appear in the sequence. From end of strand backwards. This makes the arrow heads apear above features.
   * - score: Features are drawn in order of score (lowest to highest).
   */
  get drawOrder() {
    return this._drawOrder;
  }

  set drawOrder(value) {
    if ( utils.validate(value, ['position', 'score']) ) {
      this._drawOrder = value;
    }
  }

  /**
   * @member {String} - Get or set the *dataType*. Must be one of 'feature' or 'plot' [Default: 'feature']
   */
  get dataType() {
    return this._dataType;
  }

  set dataType(value) {
    if ( utils.validate(value, ['feature', 'plot']) ) {
      this._dataType = value;
    }
  }

  /** * @member {String} - Alias for *dataType*.
   */
  get type() {
    return this.dataType;
    // return this.contents.type;
  }

  /**
   * @member {String} - Get or set the *dataMethod* attribute. *dataMethod* describes how the features/plot should be extracted.
   *    Options are 'source', 'type', 'tag', or 'sequence' [Default: 'source']
   */
  get dataMethod() {
    return this._dataMethod;
  }

  set dataMethod(value) {
    if ( utils.validate(value, ['source', 'type', 'tag', 'sequence']) ) {
      this._dataMethod = value;
    }
  }

  /**
   * @member {String} - Get or set the *dataKeys* attribute. *dataKeys* describes which features/plot should be extracted. For example,
   *    if *dataMethod* is 'type', and *dataKeys* is 'CDS', then all features with a type of 'CDS' will be used to create the track.
   *    For *dataMethod* of 'sequence', the following values are possible for *dataKeys*: 'orfs', 'start-stop-codons', 'gc-content', 'gc-skew'.
   */
  get dataKeys() {
    return this._dataKeys;
  }

  set dataKeys(value) {
    this._dataKeys = (value === undefined) ? new CGArray() : new CGArray(value);
  }

  /** * @member {Object} - Get or set the *dataOptions*. The *dataOptions* are passed to the SequenceExtractor.
   */
  get dataOptions() {
    return this._dataOptions;
  }

  set dataOptions(value) {
    this._dataOptions = value;
  }


  /**
   * @member {String} - Get or set separateFeaturesBy. Possible values are 'none', 'strand', 'readingFrame', 'type', or 'legend'.
   */
  get separateFeaturesBy() {
    return this._separateFeaturesBy;
  }

  set separateFeaturesBy(value) {
    if ( utils.validate(value, ['none', 'strand', 'readingFrame', 'type', 'legend']) ) {
      this._separateFeaturesBy = value;
      this.updateSlots();
    }
  }

  /**
   * @member {String} - Get or set the position. Feature tracks accept 'inside',
   * 'outside', 'around', or 'along'; 'both' is a deprecated alias for 'around'.
   * Plot tracks accept 'inside' or 'outside'.
   * The first visible track at 'along' expands as needed to extend 5 pixels
   * beyond each edge of the visible backbone, preserving divider spacing.
   */
  get position() {
    return this._position;
  }

  // set position(value) {
  //   if ((this.type === 'feature' && utils.validate(value, ['inside', 'outside', 'both', 'along'])) ||
  //       (this.type === 'plot' && utils.validate(value, ['inside', 'outside']))) {
  //     this._position = value;
  //     this.updateSlots();
  //   }
  // }
  set position(value) {
    if (this.type === 'feature') {
      // Deprecated value
      if (value === 'both') {
        console.warn("[CGView] track.position 'both' is deprecated and will be removed in v1.9. Use 'around' instead.");
        value = 'around';
      }

      if (utils.validate(value, ['inside', 'outside', 'around', 'along'])) {
        this._position = value;
        this.updateSlots();
      }
      return;
    }

    if (this.type === 'plot') {
      if (utils.validate(value, ['inside', 'outside'])) {
        this._position = value;
        this.updateSlots();
      }
    }
  }

  /**
   * @member {Plot} - Get the plot associated with this track
   */
  get plot() {
    return this._plot;
  }

  /**
   * @member {Number} - Get or set the load progress position (integer between 0 and 100)
   */
  get loadProgress() {
    return this._loadProgress;
  }

  set loadProgress(value) {
    this._loadProgress = value;
    // this.viewer.trigger('track-load-progress-changed', this);
  }

  /**
   * @member {Number} - Return the number of features or plot points contained in this track.
   */
  get itemCount() {
    if (this.type === 'plot') {
      return (this.plot) ? this.plot.length : 0;
    } else if (this.type === 'feature') {
      return this.features().length;
    } else {
      return 0;
    }
  }

  /**
   * @member {Number} - Get or set the slot size as a ratio to all other slots.
   * Finite positive numbers (including numeric strings) are accepted. Invalid
   * or unchanged values do not recalculate layout. Updates apply immediately.
   */
  get thicknessRatio() {
    return this._thicknessRatio;
  }

  set thicknessRatio(value) {
    const ratio = Number(value);
    if (!Number.isFinite(ratio) || ratio <= 0 || ratio === this._thicknessRatio) { return; }
    this._thicknessRatio = ratio;
    this.layout._adjustProportions({duration: 0});
  }

  /**
   * @member {Number|undefined} - Read-only thickness in pixels per visible slot
   * at zoom factor 1, computed using the current canvas dimensions, ratios, and settings.
   * Excludes dividers and spacing. All visible slots in a track have the same
   * thickness. This getter does not change the
   * view or store a second thickness. Returns undefined while loading, for a
   * hidden/removed track, or when the track has no visible slots. Current
   * rendered thickness is available as slot.thickness. Along-backbone clearance
   * can increase rendered thickness beyond this ratio-based allocation.
   */
  get computedInitialSlotThickness() {
    if (this.viewer.loading) { return undefined; }
    return this.layout._slotThicknessesAt(1).find(entry => entry.slot.track === this)?.thickness;
  }

  /**
   * Size this track using its existing ratio and the map's sizing settings.
   * Ratio mode is equivalent to update({thicknessRatio: value}), including for
   * hidden or empty tracks; it redistributes space among visible slots.
   * Pixel mode targets every visible slot at zoom 1, preserving neighbouring
   * overview widths. Hidden, removed, loading, and slotless tracks cannot use
   * pixel mode. Shared limits can make some extreme targets incompatible.
   *
   * This is an operation, not a fixed-pixel mode. Resizing the canvas changes
   * overview widths; zoomed widths still follow shared layout limits. Only
   * thicknessRatio and settings are saved. Updates are synchronous, preserve
   * the zoomed focal position, and emit tracks-update and (when changed)
   * settings-update after layout. Call viewer.draw() to render the result.
   * An along-backbone track can render wider than its allocation or shared cap
   * to retain 5 pixels of clearance on each edge of the visible backbone.
   *
   * @param {Number} value - Finite positive ratio or overview pixels per slot.
   * @param {Object} options - An explicit mode is required.
   * @param {String} options.mode - 'ratio' or 'pixels'.
   * @return {Track} This track, for chaining.
   * @throws {TypeError} If mode is missing or unknown.
   * @throws {RangeError} If value is invalid, shared limits prevent the target,
   * or the target would give a circular map a non-positive backbone radius.
   * @throws {Error} If pixel sizing is unavailable for this track.
   * @example
   * track.setThickness(20, {mode: 'pixels'});
   * console.log(track.computedInitialSlotThickness); // 20 per visible slot
   * track.setThickness(2, {mode: 'ratio'});
   * track.viewer.draw();
   */
  setThickness(value, options = {}) {
    if (!['ratio', 'pixels'].includes(options?.mode)) {
      throw new TypeError("Track thickness requires mode: 'ratio' or 'pixels'.");
    }
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError('Track thickness must be a finite positive number.');
    }
    if (options.mode === 'ratio') {
      this.update({thicknessRatio: value});
    } else {
      this.layout._setTrackOverviewThickness(this, value);
    }
    return this;
  }

  /**
   * Update track [attributes](#attributes).
   * See [updating records](../docs.html#s.updating-records) for details.
   * @param {Object} attributes - Object describing the properties to change
   */
  update(attributes) {
    this.viewer.updateTracks(this, attributes);
  }

  /**
   * Remove track
   */
  remove() {
    this.viewer.removeTracks(this);
  }

  /**
   * Move this track to a new index in the array of Viewer tracks.
   * @param {Number} newIndex - New index for this track (0-based)
   */
  move(newIndex) {
    const currentIndex = this.viewer.tracks().indexOf(this);
    this.viewer.moveTrack(currentIndex, newIndex);
  }


  /**
   * Returns an [CGArray](CGArray.html) of Features or a single Feature from all the features in this track.
   * @param {Integer|String|Array} term - See [CGArray.get](CGArray.html#get) for details.
   * @return {CGArray}
   */
  features(term) {
    return this._features.get(term);
  }

  slots(term) {
    return this._slots.get(term);
  }

  /**
   * Returns an [CGArray](CGArray.html) of Features or a single Feature from all the unique features in this track.
   * Unique features are ones that only appear in this track.
   * @param {Integer|String|Array} term - See [CGArray.get](CGArray.html#get) for details.
   * @return {CGArray}
   * @private
   */
  uniqueFeatures(term) {
    const features = new CGArray();
    for (let i = 0, len = this._features.length; i < len; i++) {
      if (this._features[i].tracks().length === 1) {
        features.push(this._features[i]);
      }
    }
    return features.get(term);
  }

  /**
   * Remove a feature or array of features from the track and slots.
   *
   * @param {Feature|Array} features - The Feature(s) to remove.
   */
  removeFeatures(features) {
    features = (features.toString() === 'CGArray') ? features : new CGArray(features);
    // this._features = new CGArray(
    //   this._features.filter( (f) => { return !features.includes(f) })
    // );
    this._features = this._features.filter( f => !features.includes(f) );
    this.slots().each( (i, slot) => {
      slot.removeFeatures(features);
    });
    this.viewer.trigger('track-update', this);
  }

  /**
   * Remove the plot from the track and slots.
   */
  removePlot() {
    this._plot = undefined;
    this.slots().each( (i, slot) => {
      slot.removePlot();
    });
    this.viewer.trigger('track-update', this);
  }

  // NOTE:
  // - features and plots extracted from sequence are empheral and will be removed and readded on refresh
  refresh() {
    const tempPlot = this._plot;
    const tempFeatures = this._features;
    this._features = new CGArray();
    this._plot = undefined;
    if (this.dataMethod === 'sequence') {
      tempPlot?.remove();
      this.viewer.removeFeatures(tempFeatures);
      this.extractFromSequence();
    } else if (this.type === 'feature') {
      this.updateFeatures();
    } else if (this.type === 'plot') {
      this.updatePlot();
    }
    this.updateSlots();
  }

  extractFromSequence() {
    const sequenceExtractor = this.viewer.sequence.sequenceExtractor;
    if (sequenceExtractor) {
      sequenceExtractor.extractTrackData(this, this.dataKeys[0], this.dataOptions);
    } else {
      console.error('No sequence is available to extract features/plots from');
    }
  }

  updateFeatures() {
    // Methods where the feature will contain a single value
    if (this.dataMethod === 'source' || this.dataMethod === 'type') {
      this.viewer.features().each( (i, feature) => {
        if (this.dataKeys.includes(feature[this.dataMethod]) && feature.contig.visible) {
          this._features.push(feature);
        }
      });
    // Methods where the feature will contain an array of values
    } else if (this.dataMethod === 'tag') {
      this.viewer.features().each( (i, feature) => {
        if (this.dataKeys.some( k => feature.tags.includes(k)) && feature.contig.visible) {
          this._features.push(feature);
        }
      });
    }
  }

  updatePlot() {
    if (this.dataMethod === 'source') {
      // Plot with particular Source
      this.viewer.plots().find( (plot) => {
        if (plot.source === this.dataKeys[0]) {
          this._plot = plot;
        }
      });
    }
  }

  updateSlots() {
    if (this.type === 'feature') {
      this.updateFeatureSlots();
    } else if (this.type === 'plot') {
      this.updatePlotSlot();
    }
    this.layout._adjustProportions();
    // this.viewer.trigger('track-update', this);
  }

  updateFeatureSlots() {
    this._slots = new CGArray();
    if (['type', 'legend'].includes(this.separateFeaturesBy)) {
      const features = this.featuresBy(this.separateFeaturesBy);
      // types can be 'type' or 'legend'
      const types = Object.keys(features);
      // Sort by number of features
      types.sort((a, b) => features[b].length - features[a].length);
      for (const type of types) {
        const slot = new Slot(this, {strand: 'direct'});
        slot.replaceFeatures(features[type]);
      }
    } else if (this.separateFeaturesBy === 'readingFrame') {
      const features = this.sequence.featuresByReadingFrame(this.features());
      // Direct Reading Frames
      for (const rf of [1, 2, 3]) {
        const slot = new Slot(this, {strand: 'direct'});
        slot.replaceFeatures(features[`rfPlus${rf}`]);
      }
      // Reverse Reading Frames
      for (const rf of [1, 2, 3]) {
        const slot = new Slot(this, {strand: 'reverse'});
        slot.replaceFeatures(features[`rfMinus${rf}`]);
      }
    } else if (this.separateFeaturesBy === 'strand') {
      const features = this.featuresByStrand();
      // We always want direct strand first (from the outside in)
      const strands = this.position === 'outside' ? ['reverse', 'direct'] : ['direct', 'reverse'];
      // Direct Slot
      let slot = new Slot(this, {strand: strands[0]});
      slot.replaceFeatures(this.position === 'outside' ? features.reverse : features.direct);
      // Reverse Slot
      slot = new Slot(this, {strand: strands[1]});
      slot.replaceFeatures(this.position === 'outside' ? features.direct : features.reverse);
    } else {
      // Combined Slot
      const slot = new Slot(this, {strand: 'direct'});
      slot.replaceFeatures(this.features());
    }
  }

  // FIXME: this should become simply (update)
  // update(attributes = {}) {
  //   this.viewer.updateTracks(this, attributes);
  // }
  triggerUpdate() {
    this.viewer.updateTracks(this);
  }

  featuresByStrand() {
    const features = {};
    features.direct = new CGArray();
    features.reverse = new CGArray();
    this.features().each( (i, feature) => {
      if (feature.strand === -1) {
        features.reverse.push(feature);
      } else {
        features.direct.push(feature);
      }
    });
    return features;
  }

  // Returns an object with keys as the type of feature (e.g. types or legend names) and values as an array of features
  // by: 'type' or 'legend'
  featuresBy(by='type') {
    const features = {};
    this.features().each( (i, feature) => {
      const key = (by === 'legend') ? feature.legend.name : feature[by];
      if (features[key] === undefined) {
        features[key] = new CGArray();
      }
      features[key].push(feature);
    });
    return features;
  }

  // featuresByType() {
  //   const features = {};
  //   this.features().each( (i, feature) => {
  //     const type = feature.type;
  //     if (features[type] === undefined) {
  //       features[type] = new CGArray();
  //     }
  //     features[type].push(feature);
  //   });
  //   return features;
  // }

  // featuresByLegend() {
  //   const features = {};
  //   this.features().each( (i, feature) => {
  //     const legend = feature.legend.name;
  //     if (features[legend] === undefined) {
  //       features[legend] = new CGArray();
  //     }
  //     features[legend].push(feature);
  //   });
  //   return features;
  // }

  updatePlotSlot() {
    this._slots = new CGArray();
    const slot = new Slot(this, {type: 'plot'});
    slot._plot = this._plot;
  }

  highlight(color = '#FFB') {
    if (this.visible) {
      this.slots().each( (i, slot) => {
        slot.highlight(color);
      });
    }
  }

  /**
   * Returns JSON representing the object
   */
  toJSON(options = {}) {
    const json = {
      name: this.name,
      separateFeaturesBy: this.separateFeaturesBy,
      position: this.position,
      thicknessRatio: this.thicknessRatio,
      dataType: this.dataType,
      dataMethod: this.dataMethod
    };
    // DataKeys
    json.dataKeys = (this.dataKeys.length === 1) ? this.dataKeys[0] : [...this.dataKeys];
    // DataOptions
    if (this.dataOptions && Object.keys(this.dataOptions).length > 0) {
      json.dataOptions = this.dataOptions;
    }
    // Optionally add default values
    if (!this.visible || options.includeDefaults) {
      json.visible = this.visible;
    }
    if (this.drawOrder != 'position') {
      json.drawOrder = this.drawOrder;
    }
    // This could be a new Track specific toJSON option
    if (options.includeDefaults) {
      json.loadProgress = this.loadProgress;
    }
    return json;
  }

}

export default Track;
