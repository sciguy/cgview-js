//////////////////////////////////////////////////////////////////////////////
// CGRange
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
 * A CGRange contains a start and stop position (in base pair) on a sequence contig.
 * Ranges are always in a clockwise direction. A stop before the start wraps
 * within the owning contig, independently of its topology or the map format.
 *
 * ### Ranges and Map Coordinates
 *
 * Range start and stop positions are in relation to the contig the range is
 * on. To get the positions in relation to the entire map, use
 * [mapStart](#mapStart) and [mapStop](#mapStop).
 *
 */
class CGRange {

  /**
   * Create a CGRange
   *
   * @param {Sequence} contig - The contig that contains the range. The contig provides the contig length
   * @param {Number} start - The start position.
   * @param {Number} stop - The stop position.
   * @param {Object} [options] - Internal projection options.
   * @param {Number[]} [options.bounds] - Inclusive wrap boundaries in contig coordinates.
   */
  constructor(contig, start, stop, options = {}) {
    this._contig = contig;
    this._bounds = options.bounds;
    this.start = start;
    this.stop = stop;
  }

  /**
   * @member {Sequence} - Get the sequence.
   */
  get contig() {
    return this._contig;
  }

  /**
   * @member {Sequence} - Get the sequence.
   */
  get sequence() {
    return this.contig.sequence;
  }

  // /**
  //  * @member {Number} - Get the sequence length
  //  */
  // get sequenceLength() {
  //   return this.sequence.length;
  // }

  /**
   * @member {Number} - Get or set the range start, constrained to its wrap boundaries.
   */
  get start() {
    return this._start;
  }

  set start(value) {
    this._start = utils.constrain(value, this._boundStart, this._boundStop);
  }

  /**
   * @member {Number} - Get or set the range stop, constrained to its wrap boundaries.
   */
  get stop() {
    return this._stop;
  }

  set stop(value) {
    this._stop = utils.constrain(value, this._boundStart, this._boundStop);
  }

  /**
   * @member {Number} - Get or set the range start using the entire map coordinates.
   */
  get mapStart() {
    // return this._start;
    return this.start + this.contig.lengthOffset;
  }

  set mapStart(value) {
    // this._start = Number(value);
    this.start = value - this.contig.lengthOffset;
  }

  /**
   * @member {Number} - Get or set the range stop using the entire map coordinates.
   */
  get mapStop() {
    // return this._stop;
    return this.stop + this.contig.lengthOffset;
  }

  set mapStop(value) {
    // this._stop = Number(value);
    this.stop = value - this.contig.lengthOffset;
  }

  get _boundStart() {
    return this._bounds ? this._bounds[0] : 1;
  }

  get _boundStop() {
    return this._bounds ? this._bounds[1] : this.contig.length;
  }

  /**
   * @member {CGRange} - A copy in map coordinates that retains its original wrap boundaries.
   */
  get onMap() {
    const offset = this.contig.lengthOffset;
    return new CGRange(this.sequence.mapContig, this.mapStart, this.mapStop, {
      bounds: [this._boundStart + offset, this._boundStop + offset],
    });
  }

  /**
   * @member {CGRange[]} - Non-wrapping map segments in clockwise traversal order.
   * Returns new ranges without modifying this range or its contig.
   * @example range.mapRanges.map(segment => [segment.start, segment.stop]);
   */
  get mapRanges() {
    const mapContig = this.sequence.mapContig;
    const offset = this.contig.lengthOffset;
    return this.isWrapped() ? [
      new CGRange(mapContig, this.mapStart, this._boundStop + offset),
      new CGRange(mapContig, this._boundStart + offset, this.mapStop),
    ] : [new CGRange(mapContig, this.mapStart, this.mapStop)];
  }

  /**
   * Whether this range wraps at the whole map's boundaries. Does not infer topology.
   * @returns {Boolean} True when the wrap domain covers the map. No side effects.
   */
  isMapDomain() {
    const offset = this.contig.lengthOffset;
    return this._boundStart + offset === 1 && this._boundStop + offset === this.sequence.length;
  }

  /**
   * @member {Number} - Get the length of the range.
   */
  get length() {
    if (this.stop >= this.start) {
      return this.stop - this.start + 1;
    } else {
      return (this._boundStop - this._boundStart + 1) + (this.stop - this.start) + 1;
    }
  }

  /**
   * @member {Number} - Get the middle of the range.
   */
  get middle() {
    // Subtract 0.5 from the start like we do in Canvas.drawElement
    // So the middle of a 1 bp range will be itself.
    const _middle = this.start - 0.5 + (this.length / 2);
    if (_middle > this._boundStop) {
      return (_middle - (this._boundStop - this._boundStart + 1));
    } else {
      return _middle;
    }
  }

  /**
   * Return true if the range length is over half the length of the
   * sequence length
   * @return {Boolean}
   */
  overHalfMapLength() {
    return this.length > (this.sequence.length / 2);
  }

  /**
   * Wrap the *value* within this range's coordinate domain.
   * For example, if sequence length is 1000 and _value_ is 1200,
   * a value of 200 will be returned.
   * @param {Number} value - The number to normalize.
   * @return {Number}
   */
  normalize(value) {
    const length = this._boundStop - this._boundStart + 1;
    return ((value - this._boundStart) % length + length) % length + this._boundStart;
  }

  /**
   * Return the *start* of the range plus the *value*.
   * @param {Number} - Number to add.
   * @return {Number}
   */
  getStartPlus(value) {
    return this.normalize(this.start + value);
  }

  /**
   * Return the *stop* of the range plus the *value*.
   * @param {Number} - Number to add.
   * @return {Number}
   */
  getStopPlus(value) {
    return this.normalize(this.stop + value);
  }

  /**
   * Return true if the range length is the same as the map sequence length
   * @return {Boolean}
   */
  isMapLength() {
    return (this.length === this.sequence.length);
  }

  /**
   * Ranges may wrap within their coordinate domain regardless of biological topology.
   * @return {Boolean}
   * @private
   */
  isWrappingAllowed() {
    return true;
  }

  /**
   * Return true if the range wraps around the end of the contig (ie. the stop is less than the start position)
   * @return {Boolean}
   */
  isWrapped() {
    return (this.stop < this.start);
  }

  /**
   * Return true if the *position* in inside the range using map coordinates.
   * @param {Number} position - The position to check if it's in the range.
   * @return {Boolean}
   */
  containsMapBp(position) {
    const offset = this.contig.lengthOffset;
    if (position < this._boundStart + offset || position > this._boundStop + offset) { return false; }
    if (this.stop >= this.start) {
      // Typical Range
      return (position >= this.mapStart && position <= this.mapStop);
    } else {
      // Range spans origin
      return (position >= this.mapStart || position <= this.mapStop);
    }
  }

  /**
   * Returns a copy of the Range.
   * @return {Range}
   */
  copy() {
    return new CGRange(this.contig, this.start, this.stop, {bounds: this._bounds?.slice()});
  }

  /**
   * Returns true if the range overlaps with *range2*.
   * @param {Range} range2 - The range with which to test overlap.
   * @return {Boolwan}
   */
  overlapsMapRange(range2) {
    if (!this.isWrapped() && !range2.isWrapped()) {
      return this.mapStart <= range2.mapStop && this.mapStop >= range2.mapStart;
    }
    const otherSegments = range2.mapRanges;
    return this.mapRanges.some(segment => otherSegments.some(other =>
      segment.start <= other.stop && segment.stop >= other.start));
  }

  /**
   * Merge with the supplied range to give the biggest possible range.
   * This may produce unexpected results of the ranges do not overlap.
   * Both ranges must be on the same contig. If not, the CGRange calling
   * this method will be returned.
   * @param {Range} range2 - The range to merge with.
   * @return {Range}
   */
  // NOTE:
  // - ONLY used in Ruler.updateTicks to merge innerRange with outerRange
  mergeWithRange(range2) {
    if (range2.contig !== this.contig) {
      return this;
    }
    const range1 = this;
    const range3 = new CGRange(this.contig, range1.start, range2.stop);
    const range4 = new CGRange(this.contig, range2.start, range1.stop);
    const ranges = [range1, range2, range3, range4];
    let greatestLength = 0;
    let rangeLength, longestRange;
    for (let i = 0, len = ranges.length; i < len; i++) {
      rangeLength = ranges[i].length;
      if (rangeLength > greatestLength) {
        greatestLength = rangeLength;
        longestRange = ranges[i];
      }
    }
    return longestRange;
  }

}

export default CGRange;


