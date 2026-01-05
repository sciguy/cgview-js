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
 * Ranges are always in a clockise direction.
 * The start is always less than the stop position with following exception.
 * Since the genomes are circular, if the genome contains a single contig
 * (i.e., Sequence.hasMultipleContigs is false) it's possibe for the range to
 * loop around (i.e., that stop can be less than the start).
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
   */
  constructor(contig, start, stop) {
    this._contig = contig;
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
   * @member {Number} - Get or set the range start. Start must be less than
   * Stop unless the contig represents the entire map, in which case,
   * wrapping is allowed. The value will be constrained between the 1 and the
   * contig length.
   */
  get start() {
    return this._start;
  }

  set start(value) {
    // this._start = Number(value);
    // this._start = CGV.constrain(value, 1, this.stop || this.contig.length);
    const stop = this.isWrappingAllowed ? this.contig.length : (this.stop || this.contig.length);
    this._start = utils.constrain(value, 1, stop);
  }

  /**
   * @member {Number} - Get or set the range stop. Stop must be greater than
   * Start unless the contig represents the entire map, in which case,
   * wrapping is allowed. The value will be constrained between the 1 and the
   * contig length.
   */
  get stop() {
    return this._stop;
  }

  set stop(value) {
    // this._stop = Number(value);
    // this._stop = CGV.constrain(value, this.start || 1, this.contig.length);
    const start = this.isWrappingAllowed ? 1 : (this.start || 1);
    this._stop = utils.constrain(value, start, this.contig.length);
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

  // Should this return "this" if 
  get onMap() {
    return new CGRange(this.sequence.mapContig, this.mapStart, this.mapStop);
  }

  /**
   * @member {Number} - Get the length of the range.
   */
  get length() {
    if (this.stop >= this.start) {
      return this.stop - this.start + 1;
    } else {
      return this.contig.length + (this.stop - this.start) + 1;
    }
  }

  /**
   * @member {Number} - Get the middle of the range.
   */
  get middle() {
    // Subtract 0.5 from the start like we do in Canvas.drawElement
    // So the middle of a 1 bp range will be itself.
    const _middle = this.start - 0.5 + (this.length / 2);
    if (_middle > this.contig.length) {
      return (_middle - this.contig.length);
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
   * Convert the *value* to be between the 1 and the contig length.
   * Values will be constrained to the contig unless the Map Sequence only contains a single contig,
   * in which case, values bigger or smaller than the sequence length will be wrappeed around.
   * For example, if sequence length is 1000 and _value_ is 1200,
   * a value of 200 will be returned.
   * @param {Number} value - The number to normalize.
   * @return {Number}
   */
  normalize(value) {
    if (this.sequence.hasMultipleContigs) {
      // Multiple Contigs. Values are constrained between one and contig length.
      return utils.constrain(value, 1, this.contig.length);
    } else {
      // Single Contig. Wrapping possible.
      let rotations;
      if (value > this.sequenceLength) {
        rotations = Math.floor(value / this.sequenceLength);
        return (value - (this.sequenceLength * rotations) );
      } else if (value < 1) {
        rotations = Math.ceil(Math.abs(value / this.sequenceLength));
        return (this.sequenceLength * rotations) + value;
      } else {
        return value;
      }
    }
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
   * Return true if the contig length is the same as the sequence length.
   * If so, then the range can wrap around (i.e., that stop position can be less than the start).
   * @return {Boolean}
   * @private
   */
  isWrappingAllowed() {
    // return (!this.sequence.hasMultipleContigs && this.contig.length === this.sequence.length);
    return (this.contig === this.sequence.mapContig);
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
    return new CGRange(this.contig, this.start, this.stop);
  }

  /**
   * Returns true if the range overlaps with *range2*.
   * @param {Range} range2 - The range with which to test overlap.
   * @return {Boolwan}
   */
  overlapsMapRange(range2) {
    // return (this.contains(range2.start) || this.contains(range2.stop) || range2.contains(this.start));
    return (this.containsMapBp(range2.mapStart) || this.containsMapBp(range2.mapStop) || range2.containsMapBp(this.mapStart));
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


