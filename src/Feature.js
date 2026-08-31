//////////////////////////////////////////////////////////////////////////////
// Feature
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
import CGRange from './CGRange';
import Label from './Label';
import Contig from './Contig';
import utils from './Utils';

/**
 * A Feature is a region on the map with a start and stop position.
 *
 * ### Action and Events
 *
 * Action                                  | Viewer Method                                  | Feature Method      | Event
 * ----------------------------------------|------------------------------------------------|---------------------|-----
 * [Add](../docs.html#adding-records)      | [addFeatures()](Viewer.html#addFeatures)       | -                   | features-add
 * [Update](../docs.html#updating-records) | [updateFeatures()](Viewer.html#updateFeatures) | [update()](#update) | features-update
 * [Remove](../docs.html#removing-records) | [removeFeatures()](Viewer.html#removeFeatures) | [remove()](#remove) | features-remove
 * [Read](../docs.html#reading-records)    | [features()](Viewer.html#features)             | -                   | -
 *
 * <a name="attributes"></a>
 * ### Attributes
 *
 * Attribute                        | Type     | Description
 * ---------------------------------|----------|------------
 * [name](#name)                    | String   | Name of feature
 * [type](#type)                    | String   | Feature type (e.g. CDS, rRNA, etc)
 * [legend](#legend)                | String\|LegendItem | Name of legendItem or the legendItem itself
 * [source](#source)                | String   | Source of the feature
 * [tags](#tags)                    | String\|Array | A single string or an array of strings associated with the feature as tags
 * [contig](#contig)                | String\|Contig | Name of contig or the contig itself
 * [start](#start)<sup>rc</sup>     | Number   | Start base pair on the contig. Ignored if locations are present.
 * [stop](#stop)<sup>rc</sup>       | Number   | Stop base pair on the contig. Ignored if locations are present.
 * [locations](#locations)          | Array    | Array of locations (start, stop) on the contig (e.g. [[1, 100], [200, 300]]).
 * [mapStart](#mapStart)<sup>ic</sup> | Number   | Start base pair on the map (converted to contig position). Ignored if locations are present.
 * [mapStop](#mapStop)<sup>ic</sup> | Number   | Stop base pair on the map (converted to contig position). Ignored if locations are present.
 * [strand](#strand)                | String   | Strand the features is on [Default: 1]
 * [score](#score)                  | Number   | Score associated with the feature
 * [favorite](#favorite)            | Boolean  | Feature is a favorite [Default: false]
 * [selected](#selected)            | Boolean  | Feature is selected [Default: false]
 * [visible](CGObject.html#visible) | Boolean  | Feature is visible [Default: true]
 * [meta](CGObject.html#meta)       | Object   | [Meta data](../tutorials/details-meta-data.html) for Feature
 * [qualifiers](#qualifiers)        | Object   | Qualifiers associated with the feature (from GenBank/EMBL) [Default: {}]
 * [translation](#translation)      | String   | Static translation of the feature. If set, this will be used instead of translating the sequence.
 * 
 * <sup>rc</sup> Required on Feature creation
 * <sup>ic</sup> Ignored on Record creation
 *
 * Implementation notes:
 *   - The feature range is the range on the contig
 *   - Feature.mapRange is the range on the Sequence.mapContig
 *   - If there is only one contig in the map, then Feature.mapRange === Feature.range
 *   - Feature.start/stop are positions on the contig
 *   - Feature mapStart/mapStop are position on Sequence.mapContig
 *   - If no contig is provided, the default contig will be Sequence.mapContig
 *     - Whenever mapContig is updated/regenerated the feature will be moved to the new mapContig
 *     - Features on the mapContig are able to span contigs
 *     - If contigs are rearranged, a mapContig feature will stay at the same position (start/stop)
 *
 * @extends CGObject
 */
class Feature extends CGObject {

  /**
   * Create a new feature.
   * @param {Viewer} viewer - The viewer
   * @param {Object} options - [Attributes](#attributes) used to create the feature
   * @param {Object} [meta] - User-defined [Meta data](../tutorials/details-meta-data.html) to add to the feature.
   */
  constructor(viewer, data = {}, meta = {}) {
    super(viewer, data, meta);
    this.viewer = viewer;
    this.type = utils.defaultFor(data.type, '');
    this.source = utils.defaultFor(data.source, '');
    this.tags = data.tags;
    this.favorite = utils.defaultFor(data.favorite, false);
    this.selected = utils.defaultFor(data.selected, false);
    // This will hold the name temporarily until the Label is created
    // Useful if there are errors in contig creation
    this._tempName = data.name;
    // this.contig = data.contig || viewer.sequence.mapContig;
    this.contig = data.contig;
    // this.range = new CGV.CGRange(this.viewer.sequence, Number(data.start), Number(data.stop));
    // this.updateRanges(data.start, data.stop);
    this.strand = utils.defaultFor(data.strand, 1);
    this.score = utils.defaultFor(data.score, 1);
    if (Array.isArray(data.locations)) {
      this.locations = data.locations;
    } else {
      this.updateRanges(data.start, data.stop);
    }
    this.codonStart = data.codonStart;
    this.geneticCode = data.geneticCode;
    this.translation = data.translation;
    this.label = new Label(this, {name: data.name} );
    this.qualifiers = {};
    this.qualifiers = data.qualifiers;
    this._centerOffsetAdjustment = Number(data.centerOffsetAdjustment) || 0;
    this._proportionOfThickness = Number(data.proportionOfThickness) || 1;

    this.extractedFromSequence = utils.defaultFor(data.extractedFromSequence, false);

    this.legendItem  = data.legend;
  }

  /**
   * Return the class name as a string.
   * @return {String} - 'Feature'
   */
  toString() {
    return 'Feature';
  }

  /**
   * @member {type} - Get or set the *type*
   */
  get type() {
    return this._type;
  }

  set type(value) {
    this._type = value;
  }

  /**
   * @member {tag} - Get or set the *tags*
   */
  get tags() {
    return this._tags;
  }

  set tags(value) {
    this._tags = (value == undefined || value === '') ? new CGArray() : new CGArray(value);
  }

  /**
   * @member {String} - Get or set the name via the [Label](Label.html).
   */
  get name() {
    return this.label && this.label.name || this._tempName;
  }

  set name(value) {
    if (this.label) {
      this.label.name = value;
    } else {
      this.label = new Label(this, {name: value} );
    }
  }

  /**
   * @member {qualifiers} - Get or set the *qualifiers*
   */
  get qualifiers() {
    return this._qualifiers;
  }

  set qualifiers(value) {
    if (typeof value === 'object' && value !== null) {
      this._qualifiers = value;
    }
  }

  /**
   * @member {String} - Get or set the Codon start (Default: 1)
   */
  get codonStart() {
    return this._codonStart || 1;
  }

  set codonStart(value) {
    this._codonStart = value;
  }

  /**
   * @member {String} - Get or set the Genetic code used for translation. If no genetic code is set, the default for the map will be used.
   */
  get geneticCode() {
    return this._geneticCode;
  }

  set geneticCode(value) {
    this._geneticCode = value;
  }

  /**
   * @member {Boolean} - Get or set the *extractedFromSequence*. If true, this feature was
   * generated directly from the sequence and will not be saved when exporting to JSON.
   */
  get extractedFromSequence() {
    return this._extractedFromSequence;
  }

  set extractedFromSequence(value) {
    this._extractedFromSequence = value;
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
    viewer._features.push(this);
  }

  get strand() {
    return this._strand;
  }

  set strand(value) {
    if (value === '-' || Number(value) === -1) {
      this._strand = -1;
    } else {
      this._strand = 1;
    }
  }

  /**
   * @member {Number} - Get the *Score*
   */
  get score() {
    return this._score;
  }

  set score(value) {
    if (Number.isNaN(Number(value))) { return; }
    this._score = utils.constrain(Number(value), 0, 1);
  }

  isDirect() {
    return this.strand === 1;
  }

  isReverse() {
    return this.strand === -1;
  }

  /**
   * @member {Range} - Get or set the range of the feature. All ranges
   *   are assumed to be going in a clockwise direction.
   */
  get range() {
    return this._range;
  }

  set range(value) {
    this._range = value;
  }

  /**
   * @member {Range} - Get or set the range of the feature with respect to its contig.
   *   All ranges are assumed to be going in a clockwise direction.
   */
  get mapRange() {
    return this.range.onMap;
  }

  /**
   * @member {Number} - Get or set the start position of the feature in basepair (bp).
   *   All start and stop positions are assumed to be going in a clockwise direction.
   *   This position is relative to the contig the feature is on. If there is only one
   *   contig, this value will be the same as mapStart. Setting the start position does
   *   not work if the feature has multiple locations (use [locations](#locations) instead).
   */
  get start() {
    return this.range.start;
  }

  set start(value) {
    if (!this.hasLocations) {
      this.range.start = value;
    } else {
      console.error('Feature has multiple locations. Use locations to set start position')
    }
  }

  /**
   * @member {Number} - Get or set the stop position of the feature in basepair (bp).
   *   All start and stop positions are assumed to be going in a clockwise direction.
   *   This position is relative to the contig the feature is on. If there is only one
   *   contig, this value will be the same as mapStop. Setting the stop position does
   *   not work if the feature has multiple locations (use [locations](#locations) instead).
   */
  get stop() {
    return this.range.stop;
  }

  set stop(value) {
    if (!this.hasLocations) {
      this.range.stop = value;
    } else {
      console.error('Feature has multiple locations. Use locations to set start position')
    }
  }

  /**
   * @member {Number} - Get or set the start position of the feature in basepair (bp).
   *   All start and stop positions are assumed to be going in a clockwise direction.
   *   Setting the mapStart position does not work if the feature has multiple locations.
   */
  get mapStart() {
    return this.range.mapStart;
  }

  set mapStart(value) {
    // this.range.mapStart = value;
    if (!this.hasLocations) {
      this.range.mapStart = value;
    } else {
      console.error('Feature has multiple locations.')
    }
  }

  /**
   * @member {Number} - Get or set the stop position of the feature in basepair (bp).
   *   All start and stop positions are assumed to be going in a clockwise direction.
   *   Setting the mapStop position does not work if the feature has multiple locations.
   */
  get mapStop() {
    return this.range.mapStop;
  }

  set mapStop(value) {
    // this.range.mapStop = value;
    if (!this.hasLocations) {
      this.range.mapStop = value;
    } else {
      console.error('Feature has multiple locations.')
    }
  }

  /**
   * @member {Number} - Get or set the locations of the feature in basepair (bp).
   *   An array of arrays where each sub-array contains the start and stop positions
   *   (e.g. [[1, 100], [200, 300]]).
   *   All start and stop positions are assumed to be going in a clockwise direction.
   *   Locations shouldn't overlap the origin but can overlap each other (e.g. due to ribosomal slippage).
   *   Locations are ignored unless there is more than one location.
   *   Validations:
   *   - that each array has 2 numbers
   *   - start must be less than stop
   *   TODO:
   *   - order of locations should be checked?
   */
  get locations() {
    return this._locations || [[this.start, this.stop]];
  }

  set locations(value) {
    let locs = [];
    if (Array.isArray(value)) {
      for (const location of value) {
        if (Array.isArray(location) && !isNaN(location[0]) && !isNaN(location[1])) {
          if (location[0] <= location[1]) {
            locs.push([location[0], location[1]]);
          } else {
            console.error('Feature location start must be less than stop: ', value);
            return;
          }
        } else {
          console.error('Feature locations must be an array of arrays of 2 numbers: ', value);
          return;
        }
      }
    } else {
      console.error('Feature locations must be an array of arrays of numbers: ', value);
      return;
    }
    this.updateRanges(locs[0][0], locs[locs.length - 1][1]);
    this._locations = locs;
  }

  /**
   * @member {Number} - Return true if the feature has multiple locations (i.e more than one).
   */
  get hasLocations() {
    return this.locations?.length > 1;
  }

  /**
   * @member {Number} - Get the length of the feature in basepair (bp).
   * If the feature has locations, the length is calculated as the sum of the length of each location.
   * Otherwise, the length is the same as the range (i.e. stop - start + 1).
   * To get the full length of the feature on the map, use [fullLength](#fullLength).
   */
  get length() {
    let length = 0;
    if (this.hasLocations) {
      for (const location of this.locations) {
        // NOTE: locations should never overlap origin so we can probably simplify this without ranges
        let range = new CGRange(this.contig, location[0], location[1]);
        length += range.length;
      }
    } else {
      // No locations or only one location
      length = this.fullLength
    }
    return length
  }

  /**
   * @member {Number} - Get the length of the feature in basepair (bp) using only the
   * start and stop positions. This is the same as the range length.
   * To get the length of the feature based on sub locations, use [length](#length).
   */
  get fullLength() {
    return this.range.length;
  }


  /**
   * @member {String} - Get or set the feature label.
   */
  get label() {
    return this._label;
  }

  set label(value) {
    this._label = value;
  }

  /**
   * @member {String} - Get or set the feature as a favorite.
   */
  get favorite() {
    return Boolean(this._favorite);
  }

  set favorite(value) {
    this._favorite = value;
  }

  /**
   * @member {Boolean} - Get or set the feature as selected.
   */
  get selected() {
    return Boolean(this._selected);
  }

  set selected(value) {
    this._selected = value;
  }

  /**
   * @member {String} - Get or set the color. TODO: reference COLOR class
   */
  get color() {
    // return (this.legendItem) ? this.legendItem.swatchColor : this._color;
    return this.legendItem.swatchColor;
  }

  /**
   * @member {String} - Get the decoration.
   */
  get decoration() {
    // return (this.legendItem && this.legendItem.decoration || 'arc')
    return (this.legendItem.decoration || 'arc');
  }

  get directionalDecoration() {
    if (this.decoration === 'arrow') {
      return this.strand === 1 ? 'clockwise-arrow' : 'counterclockwise-arrow';
    } else if (this.decoration === 'score') {
      return 'arc';
    } else {
      return this.decoration;
    }
  }

  /**
   * @member {LegendItem} - Get or set the LegendItem. The LegendItem can be set with a LegendItem object
   *   or with the name of a legenedItem.
   */
  get legendItem() {
    return this._legendItem;
  }

  set legendItem(value) {
    if (this.legendItem && value === undefined) { return; }
    if (value && (value.toString() === 'LegendItem') && value !== 'LegendItem') {
      this._legendItem  = value;
    } else {
      this._legendItem  = this.viewer.legend.findLegendItemOrCreate(value);
    }
  }

  /**
   * @member {LegendItem} - Alias for [legendItem](Feature.html#legendItem).
   */
  get legend() {
    return this.legendItem;
  }

  set legend(value) {
    this.legendItem = value;
  }

  /**
   * @member {Contig} - Get or set the Contig. The Contig can be set with a Contig object
   *   or with the name of a Contig.
   */
  get contig() {
    return this._contig;
  }

  set contig(value) {
    const oldContig = this._contig;
    let newContig;
    if (value === undefined || value === this.sequence.mapContig) {
      // this._contig = undefined;
      newContig = this.sequence.mapContig;
      // If feature was on a contig update the positions
      if (oldContig) {
      }
    } else if (value && (value.toString() === 'Contig') && value !== 'Contig') {
      // this._contig  = value;
      newContig = value;
    } else {
      const contig = this.viewer.sequence.contigs(value);
      // const contig = this.viewer.sequence.contigs().filter( c => c.id && c.id.toLowerCase() === value.toLowerCase() )[0];
      if (contig) {
        // this._contig  = contig;
        newContig = contig;
      } else {
        console.error(`Feature '${this.name}' could not find contig '${value}'`)
        return;
      }
    }
    if (oldContig !== newContig) {
      // Add feature to new Contig
      if (newContig) {
        newContig._features.push(this);
      }
      // Remove feature from old Contig
      if (oldContig) {
        Contig.removeFeatures(this);
      }
    }
    // Must be done after calling Contig.removeFeatures()
    this._contig = newContig;
    if (oldContig) {
      // FIXME: adjust start/stop if the new contig is shorter than old contig
      // and the position needs to be constrained. Try to keep the same length.
      if (newContig.isMapContig) {
        this.updateRanges(this.mapStart, this.mapStop);
      } else {
        this.updateRanges(this.start, this.stop);
      }
    }
  }

  /**
   * Moves the feature, if it's on the mapContig, to the appropriate contig
   * based on the start position. This may truncate the feature if it does not 
   * fit completely
   * @private
   */
  moveToContig() {
    if (this.contig.isMapContig) {
      const contig = this.sequence.contigForBp(this.start);
      const start = this.start - contig.lengthOffset;
      const stop = this.stop - contig.lengthOffset;
      this.update({contig, start, stop});
    }
  }

  /**
   * Moves the feature, if it's on the mapContig, to the appropriate contig
   * based on the start position. This may truncate the feature if it does not 
   * fit completely
   * @private
   */
  moveToMapContig() {
    if (!this.contig.isMapContig) {
      this.contig = undefined;
    }
  }

  /**
   * Update feature [attributes](#attributes).
   * See [updating records](../docs.html#s.updating-records) for details.
   * @param {Object} attributes - Object describing the properties to change
   */
  update(attributes) {
    this.viewer.updateFeatures(this, attributes);
  }

  /**
   * Updates the feature range using the given *start* and *stop* positions.
   * If the feature is on a contig, the positions should be in relation to the contig.
   * @param {Number} start - Start position (bp).
   * @param {Number} stop - Stop position (bp).
   * @private
   */
  // updateRanges(start, stop) {
  //   start = Number(start);
  //   stop = Number(stop);
  //   const sequence = this.sequence;
  //   let globalStart = start;
  //   let globalStop = stop;
  //   if (this.contig) {
  //     // Create range as global bp position and
  //     // contigRange as given start/stop positions
  //     globalStart = sequence.bpForContig(this.contig, start);
  //     globalStop = sequence.bpForContig(this.contig, stop);
  //     this.contigRange = new CGV.CGRange(sequence, start, stop);
  //   }
  //   this.range = new CGV.CGRange(sequence, globalStart, globalStop);
  // }
  updateRanges(start, stop) {
    start = Number(start);
    stop = Number(stop);
    const contig = this.contig || this.sequence.mapContig;
    this.range = new CGRange(contig, start, stop);
  }

  // Draw the feature on the map either as a single range or as multiple locations
  // Multiple locations are drawn as separate ranges with connectors between them
  // Currently all the connectors will be drawn if the feature is visible in any slot
  // TODO: Only draw connectors if attached to a visible location
  draw(layer, slotCenterOffset, slotThickness, visibleRange, options = {}) {
    if (!this.visible) { return; }
    const canvas = this.canvas;
    if (this.hasLocations) {
      const connectors = [];
      // Draw each location
      // for (const location of this.locations) {
      for (let i = 0; i < this.locations.length; i++) {
        const location = this.locations[i];
        const range = new CGRange(this.contig, location[0], location[1]);
        const newOptions = {...options};
        if (this.decoration === 'arrow') {
          if (this.isDirect() && i !== this.locations.length - 1) {
            newOptions.directionalDecoration = 'arc';
          } else if (this.isReverse() && i !== 0) {
            newOptions.directionalDecoration = 'arc';
          }
        }
        this.drawRange(range, layer, slotCenterOffset, slotThickness, visibleRange, newOptions);
      }
      for (let i = 0; i < this.locations.length - 1; i++) {
        const location = this.locations[i];
        const nextLocation = this.locations[i + 1];
        if (nextLocation) {
          // Skip connectors if the locations overlap
          if ((location[1] <= nextLocation[1]) && (location[1] >= nextLocation[0])) {
            continue;
          }
          connectors.push([location[1]+1, nextLocation[0]-1]);
        }
      }
      // Draw connectors
      // Connector width is 5% of the feature thickness
      const connectorWidth = this.adjustedWidth(slotThickness) * 0.05;
      const color = options.color || this.color;
      const showShading = options.showShading;
      const minArcLength = this.legendItem.minArcLength;
      for (const connector of connectors) {
        const start = connector[0] + this.contig.lengthOffset;
        const stop = connector[1] + this.contig.lengthOffset;
        canvas.drawElement({layer, start, stop,
          centerOffset: this.adjustedCenterOffset(slotCenterOffset, slotThickness),
          color: color.rgbaString, width: connectorWidth, decoration: 'arc', showShading, minArcLength,
          selected: this.selected});
      }
    } else {
      this.drawRange(this.mapRange, layer, slotCenterOffset, slotThickness, visibleRange, options);
    }
  }

  /**
   * Split a map range into one or two non-wrapping coordinate segments.
   * @private
   */
  _linearMapSegments(range) {
    const start = range.mapStart;
    const stop = range.mapStop;
    return start <= stop ? [[start, stop]] : [[start, this.sequence.length], [1, stop]];
  }

  /**
   * Merge overlapping or adjacent linear coordinate segments.
   * @private
   */
  _mergeLinearSegments(segments) {
    const sorted = segments.slice().sort((first, second) => first[0] - second[0]);
    const merged = [];
    for (const segment of sorted) {
      const previous = merged[merged.length - 1];
      if (previous && segment[0] <= previous[1] + 1) {
        previous[1] = Math.max(previous[1], segment[1]);
      } else {
        merged.push(segment.slice());
      }
    }
    return merged;
  }

  /**
   * Return the portions of a feature range that are near the visible range.
   * Both inputs are split at the map origin before intersection, so a drawing
   * margin can never extend a feature past its real coordinates.
   * @private
   */
  _drawSegmentsForRange(range, visibleRange, margin = 100) {
    const mapLength = this.sequence.length;
    if (visibleRange.isMapLength()) {
      return this._linearMapSegments(range);
    }

    // Almost every draw takes this path. Keep the ordinary non-wrapping case
    // allocation-light; splitting and merging are reserved for origin wraps.
    if (range.mapStart <= range.mapStop && visibleRange.mapStart <= visibleRange.mapStop) {
      const start = Math.max(range.mapStart, Math.max(1, visibleRange.mapStart - margin));
      const stop = Math.min(range.mapStop, Math.min(mapLength, visibleRange.mapStop + margin));
      return start <= stop ? [[start, stop]] : [];
    }

    const featureSegments = this._linearMapSegments(range);
    const visibleSegments = this._mergeLinearSegments(
      this._linearMapSegments(visibleRange).map(([start, stop]) => [
        Math.max(1, start - margin),
        Math.min(mapLength, stop + margin),
      ])
    );
    const intersections = [];
    for (const [featureStart, featureStop] of featureSegments) {
      for (const [visibleStart, visibleStop] of visibleSegments) {
        const start = Math.max(featureStart, visibleStart);
        const stop = Math.min(featureStop, visibleStop);
        if (start <= stop) {
          intersections.push([start, stop]);
        }
      }
    }
    return this._mergeLinearSegments(intersections);
  }

  /**
   * Do not place an arrowhead at a clipping boundary. The segment containing
   * the feature's biological endpoint retains the directional decoration.
   * @private
   */
  _decorationForDrawSegment(decoration, segment, range) {
    if (decoration === 'clockwise-arrow' && segment[1] !== range.mapStop) {
      return 'arc';
    }
    if (decoration === 'counterclockwise-arrow' && segment[0] !== range.mapStart) {
      return 'arc';
    }
    return decoration;
  }

  drawRange(range, layer, slotCenterOffset, slotThickness, visibleRange, options = {}) {
    const drawSegments = this._drawSegmentsForRange(range, visibleRange);
    if (drawSegments.length === 0) { return; }

    const canvas = this.canvas;
    const color = options.color || this.color;
    const directionalDecoration = options.directionalDecoration || this.directionalDecoration;
    const showShading = options.showShading;
    const minArcLength = this.legendItem.minArcLength;
    const centerOffset = this.adjustedCenterOffset(slotCenterOffset, slotThickness);
    const width = this.adjustedWidth(slotThickness);
    for (const segment of drawSegments) {
      canvas.drawElement({
        layer, start: segment[0], stop: segment[1],
        centerOffset,
        color: color.rgbaString, width,
        decoration: this._decorationForDrawSegment(directionalDecoration, segment, range),
        showShading, minArcLength,
        selected: this.selected,
      });
    }
  }

  /**
   * Highlights the feature on every slot it is visible. An optional slot can be provided,
   * in which case the feature will only be highlighted on the slot.
   * @param {Slot} slot - Only highlight the feature on this slot.
   */
  highlight(slot) {
    if (!this.visible) { return; }
    this.canvas.clear('ui');

    if (this.viewer.annotation.visible) {
      this.label._highlight();
    }

    const color = this.color.copy();
    color.highlight();
    if (slot && slot.features().includes(this)) {
      this.draw('ui', slot.centerOffset, slot.thickness, slot.visibleRange, {color: color});
    } else {
      this.viewer.slots().each( (i, slot) => {
        if (slot.features().includes(this)) {
          this.draw('ui', slot.centerOffset, slot.thickness, slot.visibleRange, {color: color});
        }
      });
    }
  }

  // TODO: Not using _centerOffsetAdjustment yet
  // centerOffset by default would be the center of the slot as provided unless:
  // - _centerOffsetAdjustment is not 0
  // - _proportionOfThickness is not 1
  // - legend decoration is score
  adjustedCenterOffset(centerOffset, slotThickness) {
    if (this.legendItem.decoration === 'score') {
      // FIXME: does not take into account proportionOfThickness and centerOffsetAdjustment for now
      return centerOffset - (slotThickness / 2) + (this.score * slotThickness / 2);
    } else {
      if (this._centerOffsetAdjustment === 0 && this._proportionOfThickness === 1) {
        return centerOffset;
      } else if (this._centerOffsetAdjustment === 0) {
        return centerOffset - (slotThickness / 2) + (this._proportionOfThickness * slotThickness / 2);
      } else {
        return centerOffset;
      }
    }
  }

  adjustedWidth(width) {
    if (this.legendItem.decoration === 'score') {
      return this.score * width;
    } else {
      return this._proportionOfThickness * width;
    }
  }

  /**
   * Return an array of the tracks that contain this feature
   * FIXME: this will not return the tracks for features on tracks with 'from' = 'sequence'
   *        - is this a problem??
   */
  tracks(term) {
    const tracks = new CGArray();
    this.viewer.tracks().each( (i, track) => {
      if (track.type === 'feature') {
        if ( (track.dataMethod === 'source' && track.dataKeys.includes(this.source)) ||
             (track.dataMethod === 'type' && track.dataKeys.includes(this.type)) ||
             (track.dataMethod === 'tag' && track.dataKeys.some( k => this.tags.includes(k))) ||
             (track.dataMethod === 'sequence' && this.extractedFromSequence && track.features().includes(this)) ) {
          tracks.push(track);
        }
      }
    });
    return tracks.get(term);
  }

  /**
   * Return an array of the slots that contain this feature
   */
  slots(term) {
    const slots = new CGArray();
    this.tracks().each( (i, track) => {
      track.slots().each( (j, slot) => {
        if (slot.features().includes(this)) {
          slots.push(slot);
        }
      });
    });
    return slots.get(term);
  }

  /**
   * Remove the feature from the viewer, tracks and slots
   */
  remove() {
    this.viewer.removeFeatures(this);
  }

  /**
   * Zoom and pan map to show the feature
   *
   * @param {Number} duration - Length of animation
   * @param {Object} ease - The d3 animation ease [Default: d3.easeCubic]
   */
  moveTo(duration, ease) {
    const buffer = Math.ceil(this.length * 0.05);
    const start = this.sequence.subtractBp(this.mapStart, buffer);
    const stop = this.sequence.addBp(this.mapStop, buffer);
    this.viewer.moveTo(start, stop, {duration, ease});
  }

  // Update tracks, slots, etc associated with feature.
  // Or add feature to tracks and refresh them, if this is a new feature.
  // Don't refresh if bulkImport is true
  //
  refresh() {
    // this.bulkImport = false;
    // Get tracks currently associated with this feature.
    // And find any new tracks that may now need to be associated with this feature
    // (e.g. if the feature source changed, it may now belong to a different track)
    this.viewer.tracks().each( (i, track) => {
      if ( track.features().includes(this) ||
           (track.dataMethod === 'source' && track.dataKeys.includes(this.source) ) ) {
        track.refresh();
      }
    });
  }

  /**
   * Translate the sequence of this feature.
   *
   * The source of the genetic code used for translation uses the following precedence:
   * geneticCode (provided to translate method) > geneticCode (of Feature) > geneticCode (of Viewer)
   * 
   * Note: if the feature has a translation property, it will be used instead of translating the sequence.
   * - This can be overriden by providing a genetic code to the translate method. This forces the sequence to be translated.
   *
   * @param {Number} geneticCode - Number indicating the genetic code to use for the translation. This will override the any genetic code set for the feature or Viewer.
   * @return {String} - Amino acid sequence
   */
  translate(geneticCode) {
    if (this.translation && !geneticCode) {
      return this.translation;
    } else {
      const code = geneticCode || this.geneticCode || this.viewer.geneticCode;
      const table = this.viewer.codonTables.byID(code);
      return table && table.translate(this.seq, this.start_codon);
    }
  }

  /**
   * @member {qualifiers} - Get or set the *translation*. If set, this translation will be used by [translate()](#translate) instead of translating the sequence
   */
  get translation() {
    return this._translation;
  }

  set translation(value) {
    this._translation = value;
  }

  /**
   * Returns the DNA sequence for the feature.
   * If the feature has multiple locations, the sequence will be concatenated.
   * In some cases (e.g. ribosomal slippage) the locations may overlap.
   * Example: [[1, 100], [100, 200]] will return a sequence of 201 bp.
   * To get the sequence of the feature's fullLenth ignoring sub locations, use [fullSeq](#fullSeq).
   * @return {String} - DNA sequence of feature.
   */
  get seq() {
    let seq = '';
    if (this.hasLocations) {
      for (const location of this.locations) {
        // NOTE: locations should never overlap origin so we can probably simplify this without ranges
        let range = new CGRange(this.contig, location[0], location[1]);
        let locationSeq = this.contig.forRange(range, this.isReverse());
        // Need to add the sequence in the correct order
        seq = this.isReverse() ? locationSeq + seq : seq + locationSeq;
        // seq += this.contig.forRange(range, this.isReverse());
      }
    } else {
      // No locations or only one location
      seq = this.contig.forRange(this.range, this.isReverse());
    }
    return seq
  }

  /**
   * @member {Number} - Get the sequence of the feature using only the
   * start and stop positions (ignores locations).
   * To get sequence of the feature based on sub locations, use [seq](#seq).
   */
  get fullSeq() {
    return this.contig.forRange(this.range, this.isReverse());
  }

  toJSON(options = {}) {
    const json = {
      name: this.name,
      type: this.type,
      start: this.start,
      stop: this.stop,
      strand: this.strand,
      source: this.source,
      legend: this.legend.name
      // score: this.score,
      // visible: this.visible,
      // favorite: this.favorite
    };
    if (this.translation) {
      json.translation = this.translation;
    }
    if (this.codonStart && this.codonStart != 1) {
      json.codonStart = this.codonStart;
    }
    if (this.geneticCode && this.geneticCode != this.viewer.geneticCode) {
      json.geneticCode = this.geneticCode;
    }
    if (this.sequence.hasMultipleContigs && !this.contig.isMapContig) {
      // json.contig = this.contig.id;
      json.contig = this.contig.name;
    }
    // Locations
    if (this.hasLocations) {
      json.locations = this.locations;
    }
    // Tags
    if (this.tags !== undefined) {
      json.tags = (this.tags.length === 1) ? this.tags[0] : [...this.tags];
    }
    // Optionally add default values
    // Visible is normally true
    if (!this.visible || options.includeDefaults) {
      json.visible = this.visible;
    }
    // Score is normally undefined (which defaults to 1)
    if ((this.score !== undefined && this.score !== 1) || options.includeDefaults) {
      json.score = this.score;
    }
    // Favorite is normally false
    if (this.favorite || options.includeDefaults) {
      json.favorite = this.favorite;
    }
    // Selected is normally false
    if (this.selected || options.includeDefaults) {
      json.selected = this.selected;
    }
    // Meta Data (TODO: add an option to exclude this)
    if (Object.keys(this.meta).length > 0) {
      json.meta = this.meta;
    }
    // Qualifiers Data (TODO: maybe add an option to exclude this)
    if (Object.keys(this.qualifiers).length > 0) {
      json.qualifiers = this.qualifiers;
    }
    return json;
  }

}

export default Feature;
