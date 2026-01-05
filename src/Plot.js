//////////////////////////////////////////////////////////////////////////////
// Plot
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
import utils from './Utils';
import * as d3 from 'd3';

/**
 * Plots are drawn as a series of arcs.
 *
 * ### Action and Events
 *
 * Action                                  | Viewer Method                            | Plot Method         | Event
 * ----------------------------------------|------------------------------------------|---------------------|-----
 * [Add](../docs.html#adding-records)      | [addPlots()](Viewer.html#addPlots)       | -                   | plots-add
 * [Update](../docs.html#updating-records) | [updatePlots()](Viewer.html#updatePlots) | [update()](#update) | plots-update
 * [Remove](../docs.html#removing-records) | [removePlots()](Viewer.html#removePlots) | [remove()](#remove) | plots-remove
 * [Read](../docs.html#reading-records)    | [plots()](Viewer.html#plots)             | -                   | -
 *
 * <a name="attributes"></a>
 * ### Attributes
 *
 * Attribute                         | Type     | Description
 * ----------------------------------|----------|------------
 * [name](#name)                     | String   | Name of plot
 * [legend](#legend)                 | String\|LegendItem | Name of legendItem or the legendItem itself (sets positive and negative legend)
 * [legendNegative](#legendNegative) | String\|LegendItem | Name of legendItem or the legendItem itself for the plot above the baseline
 * [legendPositive](#legendPositive) | String\|LegendItem | Name of legendItem or the legendItem itself for the plot below the baseline
 * [source](#source)                 | String   | Source of the plot
 * [positions](#positions)<sup>rc,iu</sup> | Array   | Array of base pair position on contig
 * [scores](#scores)<sup>rc,iu</sup> | Array    | Array of scores
 * [baseline](#baseline)             | Number   | Score where the plot goes from negative to positive (in terms of legend)
 * [axisMax](#axisMax)               | Number   | Maximum value for the plot axis
 * [axisMin](#axisMin)               | Number   | Minimum value for the plot axis
 * [favorite](#favorite)             | Boolean  | Plot is a favorite [Default: false]
 * [visible](CGObject.html#visible)  | Boolean  | Plot is visible [Default: true]
 * [meta](CGObject.html#meta)        | Object   | [Meta data](../tutorials/details-meta-data.html) for Plot
 * 
 * <sup>rc</sup> Required on Plot creation
 * <sup>iu</sup> Ignored on Plot update
 *
 * ### Examples
 *
 * @extends CGObject
 */
class Plot extends CGObject {

  /**
   * Create a new Plot.
   * @param {Viewer} viewer - The viewer
   * @param {Object} options - [Attributes](#attributes) used to create the plot
   * @param {Object} [meta] - User-defined [Meta data](../tutorials/details-meta-data.html) to add to the plot.
   */
  constructor(viewer, data = {}, meta = {}) {
    super(viewer, data, meta);
    this.viewer = viewer;
    this.name = data.name;
    this.extractedFromSequence = utils.defaultFor(data.extractedFromSequence, false);
    this.positions = utils.defaultFor(data.positions, []);
    this.scores = utils.defaultFor(data.scores, []);
    this.type = utils.defaultFor(data.type, 'line');
    this.source = utils.defaultFor(data.source, '');
    this.axisMin = utils.defaultFor(data.axisMin, d3.min([0, this.scoreMin]));
    this.axisMax = utils.defaultFor(data.axisMax, d3.max([0, this.scoreMax]));
    this.baseline = utils.defaultFor(data.baseline, 0);

    if (data.legend) {
      this.legendItem  = data.legend;
    }
    if (data.legendPositive) {
      this.legendItemPositive = data.legendPositive;
    }
    if (data.legendNegative) {
      this.legendItemNegative = data.legendNegative;
    }
    const plotID = viewer.plots().indexOf(this) + 1;
    if (!this.legendItemPositive && !this.legendItemNegative) {
      this.legendItem  = `Plot-${plotID}`;
    } else if (!this.legendItemPositive) {
      this.legendItemPositive = this.legendItemNegative;
    } else if (!this.legendItemNegative) {
      this.legendItemNegative = this.legendItemPositive;
    }
  }

  /**
   * Return the class name as a string.
   * @return {String} - 'Plot'
   */
  toString() {
    return 'Plot';
  }

  /**
   * @member {String} - Get or set the name.
   */
  get name() {
    return this._name;
  }

  set name(value) {
    this._name = value;
  }

  /**
   * @member {type} - Get or set the *type*
   */
  get type() {
    return this._type;
  }

  set type(value) {
    if (!utils.validate(value, ['line', 'bar'])) { return }
    this._type = value;
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
    viewer._plots.push(this);
  }

  /**
   * @member {CGArray} - Get or set the positions (bp) of the plot.
   */
  get positions() {
    return this._positions || new CGArray();
  }

  set positions(value) {
    if (value) {
      this._positions = new CGArray(value);
    }
  }

  /**
   * @member {CGArray} - Get or set the scores of the plot. Value should be between 0 and 1.
   */
  get score() {
    return this._score || new CGArray();
  }

  set score(value) {
    if (value) {
      this._score = new CGArray(value);
    }
  }

  /**
   * @member {Number} - Get the number of points in the plot
   */
  get length() {
    return this.positions.length;
  }

  /**
   * @member {Array|Color} - Return an array of the positive and negativ colors [PositiveColor, NegativeColor].
   */
  get color() {
    return [this.colorPositive, this.colorNegative];
  }

  get colorPositive() {
    return this.legendItemPositive.color;
  }

  get colorNegative() {
    return this.legendItemNegative.color;
  }

  /**
   * @member {LegendItem} - Set both the legendItemPositive and
   * legendItemNegative to this legendItem. Get an CGArray of the legendItems: [legendItemPositive, legendItemNegative].
   */
  get legendItem() {
    return new CGArray([this.legendItemPositive, this.legendItemNegative]);
  }

  set legendItem(value) {
    this.legendItemPositive = value;
    this.legendItemNegative = value;
  }

  /**
   * @member {LegendItem} - Alias for [legendItem](plot.html#legendItem)
   */
  get legend() {
    return this.legendItem;
  }

  set legend(value) {
    this.legendItem = value;
  }

  /**
   * @member {LegendItem} - Get or Set both the LegendItem for the positive portion of the plot (i.e. above
   *   [baseline](Plot.html#baseline).
   */
  get legendItemPositive() {
    return this._legendItemPositive;
  }

  set legendItemPositive(value) {
    if (this.legendItemPositive && value === undefined) { return; }
    if (value && value.toString() === 'LegendItem') {
      this._legendItemPositive = value;
    } else {
      this._legendItemPositive = this.viewer.legend.findLegendItemOrCreate(value);
    }
  }

  /**
   * @member {LegendItem} - Get or Set both the LegendItem for the negative portion of the plot (i.e. below
   *   [baseline](Plot.html#baseline).
   */
  get legendItemNegative() {
    return this._legendItemNegative;
  }

  set legendItemNegative(value) {
    if (this.legendItemNegative && value === undefined) { return; }
    if (value && value.toString() === 'LegendItem') {
      this._legendItemNegative = value;
    } else {
      this._legendItemNegative = this.viewer.legend.findLegendItemOrCreate(value);
    }
  }

  /**
   * @member {LegendItem} - Alias for [legendItemPositive](plot.html#legendItemPositive).
   */
  get legendPositive() {
    return this.legendItemPositive;
  }

  set legendPositive(value) {
    this.legendItemPositive = value;
  }

  /**
   * @member {LegendItem} - Alias for [legendItemNegative](plot.html#legendItemNegative).
   */
  get legendNegative() {
    return this.legendItemNegative;
  }

  set legendNegative(value) {
    this.legendItemNegative = value;
  }

  /**
   * @member {Number} - Get or set the plot baseline. This is a value between the axisMin and axisMax
   * and indicates where where the baseline will be drawn. By default this is 0.
   */
  get baseline() {
    return this._baseline;
  }

  set baseline(value) {
    value = Number(value);
    const minAxis = this.axisMin;
    const maxAxis = this.axisMax;
    if (value > maxAxis) {
      this._baseline = maxAxis;
    } else if (value < minAxis) {
      this._baseline = minAxis;
    } else {
      this._baseline = value;
    }
  }

  /**
   * @member {Number} - Get or set the plot minimum axis value. This is a value must be less than
   * or equal to the minimum score.
   */
  get axisMin() {
    return this._axisMin;
  }

  set axisMin(value) {
    value = Number(value);
    const minValue = d3.min([this.scoreMin, this.baseline]);
    this._axisMin = (value > minValue) ? minValue : value;
  }

  /**
   * @member {Number} - Get or set the plot maximum axis value. This is a value must be greater than
   * or equal to the maximum score.
   */
  get axisMax() {
    return this._axisMax;
  }

  set axisMax(value) {
    value = Number(value);
    const maxValue = d3.max([this.scoreMax, this.baseline]);
    this._axisMax = (value < maxValue) ? maxValue : value;
  }

  get scoreMax() {
    return d3.max(this.scores);
  }

  get scoreMin() {
    return d3.min(this.scores);
  }

  get scoreMean() {
    return d3.mean(this.scores);
  }

  get scoreMedian() {
    return d3.median(this.scores);
  }

  /**
   * @member {Boolean} - Get or set the *extractedFromSequence*. This  plot is
   * generated directly from the sequence and does not have to be saved when exported JSON.
   */
  get extractedFromSequence() {
    return this._extractedFromSequence;
  }

  set extractedFromSequence(value) {
    this._extractedFromSequence = value;
  }


  /**
   * Highlights the tracks the plot is on. An optional track can be provided,
   * in which case the plot will only be highlighted on the track.
   * @param {Track} track - Only highlight the feature on this track.
   */
  highlight(track) {
    if (!this.visible) { return; }
    this.canvas.clear('ui');
    if (track && track.plot === this) {
      track.highlight();
    } else {
      this.tracks().each( (i, t) => t.highlight());
    }
  }

  /**
   * Update plot [attributes](#attributes).
   * See [updating records](../docs.html#s.updating-records) for details.
   * @param {Object} attributes - Object describing the properties to change
   */
  update(attributes) {
    this.viewer.updatePlots(this, attributes);
  }

  tracks(term) {
    const tracks = new CGArray();
    this.viewer.tracks().each( (i, track) => {
      if (track.plot === this) {
        tracks.push(track);
      }
    });
    return tracks.get(term);
  }

  /**
   * Remove the Plot from the viewer, tracks and slots
   */
  remove() {
    this.viewer.removePlots(this);
  }

  scoreForPosition(bp) {
    const index = utils.indexOfValue(this.positions, bp);
    if (index === 0 && bp < this.positions[index]) {
      return undefined;
    } else {
      return this.scores[index];
    }
  }


  draw(canvas, slotRadius, slotThickness, fast, range) {
    // let startTime = new Date().getTime();
    if (!this.visible) { return; }
    if (this.colorNegative.rgbaString === this.colorPositive.rgbaString) {
      this._drawPath(canvas, slotRadius, slotThickness, fast, range, this.colorPositive);
    } else {
      this._drawPath(canvas, slotRadius, slotThickness, fast, range, this.colorPositive, 'positive');
      this._drawPath(canvas, slotRadius, slotThickness, fast, range, this.colorNegative, 'negative');
    }
    // console.log("Plot Time: '" + utils.elapsedTime(startTime) );
  }

  // To add a fast mode use a step when creating the indices
  _drawPath(canvas, slotRadius, slotThickness, fast, range, color, orientation) {
    const ctx = canvas.context('map');
    const positions = this.positions;
    const scores = this.scores;
    // This is the difference in radial pixels required before a new arc is draw
    // const radialDiff = fast ? 1 : 0.5;
    // let radialDiff = 0.5;

    const sequenceLength = this.viewer.sequence.length;

    const startIndex = utils.indexOfValue(positions, range.start, false);
    let stopIndex = utils.indexOfValue(positions, range.stop, false);
    // Change stopIndex to last position if stop is between 1 and first position
    if (stopIndex === 0 && range.stop < positions[stopIndex]) {
      stopIndex = positions.length - 1;
    }
    const startPosition = startIndex === 0 ? positions[startIndex] : range.start;
    let stopPosition = range.stop;
    // console.log(startPosition + '..' + stopPosition)

    // let startScore = startIndex === 0 ? this.baseline : scores[startIndex];
    let startScore = scores[startIndex];

    startScore = this._keepPoint(startScore, orientation) ? startScore : this.baseline;

    ctx.beginPath();

    // Calculate baseline Radius
    // const baselineRadius = slotRadius - (slotThickness / 2) + (slotThickness * this.baseline);
    const axisRange = this.axisMax - this.axisMin;
    const baselineRadius = slotRadius - (slotThickness / 2) + (slotThickness * (this.baseline - this.axisMin)/axisRange);

    // Move to the first point
    const startPoint = canvas.pointForBp(startPosition, baselineRadius);
    ctx.moveTo(startPoint.x, startPoint.y);

    let savedR = baselineRadius + ((startScore - this.baseline) * slotThickness);
    let savedPosition = startPosition;

    let score, currentPosition;
    // const crossingBaseline = false;
    // const drawNow = false;
    let step = 1;
    if (fast) {
      // When drawing fast, use a step value scaled to base-2
      const positionsLength = this.countPositionsFromRange(startPosition, stopPosition);
      const maxPositions = 4000;
      const initialStep = positionsLength / maxPositions;
      if (initialStep > 1) {
        step = utils.base2(initialStep);
      }
    }

    this.positionsFromRange(startPosition, stopPosition, step, (i) => {
      // Handle Origin in middle of range
      if (i === 0 && startIndex !== 0) {
        canvas.path('map', savedR, savedPosition, sequenceLength, false, 'lineTo');
        savedPosition = 1;
        savedR = baselineRadius;
      }

      // NOTE: In the future the radialDiff code (see bottom) could be used to improve speed of NON-fast
      // drawing. However, there are a few bugs that need to be worked out
      score = scores[i];
      currentPosition = positions[i];
      canvas.path('map', savedR, savedPosition, currentPosition, false, 'lineTo');
      if ( this._keepPoint(score, orientation) ) {
        // savedR = baselineRadius + ((score - this.baseline) * slotThickness);
        savedR = baselineRadius + ((score - this.baseline)/axisRange * slotThickness);
        // savedR = baselineRadius + ((((score - axisMin)/axisRange) - this.baseline) * slotThickness);
        // return ((to.max - to.min) * (value - from.min) / (from.max - from.min)) + to.min;
      } else {
        savedR = baselineRadius;
      }
      savedPosition = currentPosition;
    });

    // Change stopPosition if between 1 and first position
    if (stopIndex === positions.length - 1 && stopPosition < positions[0]) {
      stopPosition = sequenceLength;
    }
    // Finish drawing plot to stop position
    canvas.path('map', savedR, savedPosition, stopPosition, false, 'lineTo');
    const endPoint = canvas.pointForBp(stopPosition, baselineRadius);
    ctx.lineTo(endPoint.x, endPoint.y);
    // Draw plot anticlockwise back to start along baseline
    canvas.path('map', baselineRadius, stopPosition, startPosition, true, 'noMoveTo');
    ctx.fillStyle = color.rgbaString;
    ctx.fill();

    // ctx.strokeStyle = 'black';
    // TODO: draw stroked line for sparse data
    // ctx.lineWidth = 0.05;
    // ctx.lineWidth = 1;
    // ctx.strokeStyle = color.rgbaString;
    // ctx.stroke();
  }


  // If the positive and negative legend are the same, the plot is drawn as a single path.
  // If the positive and negative legend are different, two plots are drawn:
  // - one above the baseline (positive)
  // - one below the baseline (negative)
  // This method checks if a point should be kept based on it's score and orientation.
  // If no orientation is provided, a single path will be drawn and all the points are kept.
  _keepPoint(score, orientation) {
    if (orientation === undefined) {
      return true;
    } else if (orientation === 'positive' && score > this.baseline) {
      return true;
    } else if (orientation === 'negative' && score < this.baseline ) {
      return true;
    }
    return false;
  }

  positionsFromRange(startValue, stopValue, step, callback) {
    const positions = this.positions;
    let startIndex = utils.indexOfValue(positions, startValue, true);
    const stopIndex = utils.indexOfValue(positions, stopValue, false);
    // This helps reduce the jumpiness of feature drawing with a step
    // The idea is to alter the start index based on the step so the same
    // indices should be returned. i.e. the indices should be divisible by the step.
    if (startIndex > 0 && step > 1) {
      startIndex += step - (startIndex % step);
    }
    if (stopValue >= startValue) {
      // Return if both start and stop are between values in array
      if (positions[startIndex] > stopValue || positions[stopIndex] < startValue) { return; }
      for (let i = startIndex; i <= stopIndex; i += step) {
        callback.call(positions[i], i, positions[i]);
      }
    } else {
      // Skip cases where the the start value is greater than the last value in array
      if (positions[startIndex] >= startValue) {
        for (let i = startIndex, len = positions.length; i < len; i += step) {
          callback.call(positions[i], i, positions[i]);
        }
      }
      // Skip cases where the the stop value is less than the first value in array
      if (positions[stopIndex] <= stopValue) {
        for (let i = 0; i <= stopIndex; i += step) {
          callback.call(positions[i], i, positions[i]);
        }
      }
    }
    return positions;
  }

  countPositionsFromRange(startValue, stopValue) {
    const positions = this.positions;
    let startIndex = utils.indexOfValue(positions, startValue, true);
    let stopIndex = utils.indexOfValue(positions, stopValue, false);

    if (startValue > positions[positions.length - 1]) {
      startIndex++;
    }
    if (stopValue < positions[0]) {
      stopIndex--;
    }
    if (stopValue >= startValue) {
      return stopIndex - startIndex + 1;
    } else {
      return (positions.length - startIndex) + stopIndex + 1;
    }
  }

  /**
   * Returns JSON representing the object
   */
  // Options:
  // - excludeData: if true, the scores and positions are not included
  toJSON(options = {}) {
    const json = {
      name: this.name,
      type: this.type,
      baseline: this.baseline,
      source: this.source,
    };
    if (this.legendPositive === this.legendNegative) {
      json.legend = this.legendPositive.name;
    } else {
      json.legendPositive = this.legendPositive.name;
      json.legendNegative = this.legendNegative.name;
    }
    if ( (this.axisMin !== this.scoreMin) || options.includeDefaults) {
      json.axisMin = this.axisMin;
    }
    if ( (this.axisMax !== this.scoreMax) || options.includeDefaults) {
      json.axisMax = this.axisMax;
    }
    if (!options.excludeData) {
      json.positions = this.positions;
      json.scores = this.scores;
    }
    // Optionally add default values
    // Visible is normally true
    if (!this.visible || options.includeDefaults) {
      json.visible = this.visible;
    }
    // Favorite is normally false
    if (this.favorite || options.includeDefaults) {
      json.favorite = this.favorite;
    }
    return json;
  }

}

export default Plot;


// NOTE: radialDiff
// score = scores[i];
// currentPosition = positions[i];
// currentR = baselineRadius + (score - this.baseline) * slotThickness;
//
// if (drawNow || crossingBaseline) {
//   canvas.arcPath('map', savedR, savedPosition, currentPosition, false, 'lineTo');
//   savedPosition = currentPosition;
//   drawNow = false;
//   crossingBaseline = false;
//   if ( this._keepPoint(score, orientation) ) {
//     savedR = currentR;
//   } else {
//     savedR = baselineRadius;
//   }
// if (orientation && ( (lastScore - this.baseline) * (score - this.baseline) < 0)) {
//   crossingBaseline = true;
// }
//
// if ( Math.abs(currentR - savedR) >= radialDiff ){
//   drawNow = true;
// }
// lastScore = score;
// END RadialDiff


// score = scores[i];
// currentPosition = positions[i];
// canvas.arcPath('map', savedR, savedPosition, currentPosition, false, 'lineTo');
// if ( this._keepPoint(score, orientation) ){
//   savedR = baselineRadius + (score - this.baseline) * slotThickness;
// } else {
//   savedR = baselineRadius;
// }
// savedPosition = currentPosition;


//
// score = scores[i];
// currentPosition = positions[i];
// canvas.arcPath('map', savedR, savedPosition, currentPosition, false, 'lineTo');
// currentR = baselineRadius + (score - this.baseline) * slotThickness;
// savedR = currentR;
// savedPosition = currentPosition;
//
//
// positions.eachFromRange(startPosition, stopPosition, step, (i) => {
// if (i === 0) {
//   lastScore = this.baseline;
//   savedPosition = 1;
//   savedR = baselineRadius;
// }
//   lastScore = score;
//   score = scores[i];
//   currentPosition = positions[i];
//   currentR = baselineRadius + (score - this.baseline) * slotThickness;
//   // If going from positive to negative need to save currentR as 0 (baselineRadius)
//   // Easiest way is to check if the sign changes (i.e. multipling last and current score is negative)
//   if (orientation && ( (lastScore - this.baseline) * (score - this.baseline) < 0)) {
//     currentR = baselineRadius;
//     canvas.arcPath('map', currentR, savedPosition, currentPosition, false, true);
//     savedR = currentR;
//     savedPosition = currentPosition;
//   } else if ( this._keepPoint(score, orientation) ){
//     if ( Math.abs(currentR - savedR) >= radialDiff ){
//       canvas.arcPath('map', currentR, savedPosition, currentPosition, false, true);
//       savedR = currentR;
//       savedPosition = currentPosition
//     }
//   } else {
//     savedR = baselineRadius;
//   }
// });
