//////////////////////////////////////////////////////////////////////////////
// Plot Renderer
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
 * Draws line plots as stable, screen-aware contours. Plot positions describe
 * where a score changes, so dense samples are aggregated using genomic
 * overlap rather than array-entry counts. All geometry is expressed through
 * Canvas, which keeps circular, linear, bitmap, and SVG output consistent.
 * @private
 */
class PlotRenderer {

  constructor(plot) {
    this.plot = plot;
  }

  get viewer() { return this.plot.viewer; }
  get positions() { return this.plot.positions; }
  get scores() { return this.plot.scores; }
  get baseline() { return this.plot.baseline; }

  draw(canvas, slotRadius, slotThickness, range, fast = false) {
    const geometry = this._plotGeometry(canvas, slotRadius, slotThickness, range, fast);
    if (geometry.samples.length === 0) { return; }
    if (this.plot.colorNegative.rgbaString === this.plot.colorPositive.rgbaString) {
      this._drawLinePath(canvas, geometry, this.plot.colorPositive, undefined, fast);
    } else {
      this._drawLinePath(canvas, geometry, this.plot.colorPositive, 'positive', fast);
      this._drawLinePath(canvas, geometry, this.plot.colorNegative, 'negative', fast);
    }
  }

  _plotGeometry(canvas, slotRadius, slotThickness, range, fast = false) {
    const axisRange = this.plot.axisMax - this.plot.axisMin;
    const safeAxisRange = Number.isFinite(axisRange) && axisRange > 0 ? axisRange : 1;
    const baselineRadius = slotRadius - (slotThickness / 2) +
      (slotThickness * (this.baseline - this.plot.axisMin) / safeAxisRange);
    const binSize = this._plotBinSize(canvas, slotRadius, fast);
    return {
      samples: this._samplesForRange(range, binSize),
      start: range.start,
      stop: range.stop,
      baselineRadius,
      slotThickness,
      axisRange: safeAxisRange,
    };
  }

  _plotBinSize(canvas, slotRadius, fast = false) {
    const pixelsPerBp = canvas.pixelsPerBp(slotRadius);
    if (!Number.isFinite(pixelsPerBp) || pixelsPerBp <= 0) { return 1; }
    const bpPerPixel = 1 / pixelsPerBp;
    if (bpPerPixel <= 1) { return 1; }
    const fullBinSize = Math.pow(2, Math.floor(Math.log2(bpPerPixel)));
    return fast ? fullBinSize * 2 : fullBinSize;
  }

  _samplesForRange(range, binSize) {
    const sequenceLength = this.viewer.sequence.length;
    const segments = range.stop < range.start ?
      [[range.start, sequenceLength], [1, range.stop]] :
      [[range.start, range.stop]];
    const samples = [];

    for (let i = 0; i < segments.length; i++) {
      const segmentSamples = this._samplesForSegment(segments[i][0], segments[i][1], binSize);
      for (let j = 0; j < segmentSamples.length; j++) {
        const sample = segmentSamples[j];
        const previous = samples[samples.length - 1];
        if (!previous || previous.bp !== sample.bp) {
          samples.push(sample);
        } else {
          samples[samples.length - 1] = sample;
        }
      }
    }
    return samples;
  }

  _samplesForSegment(start, stop, binSize) {
    if (stop < start) { return []; }
    if (stop === start) {
      const summary = this._scoreSummary(start, stop);
      return [{bp: start, ...summary}];
    }

    const samples = [];
    const startSummary = this._scoreSummary(start, start);
    samples.push({bp: start, ...startSummary});

    let scoreIndex = utils.indexOfValue(this.positions, start, false);
    const firstBin = Math.floor((start - 1) / binSize);
    const lastBin = Math.floor((stop - 1) / binSize);
    for (let bin = firstBin; bin <= lastBin; bin++) {
      const binStart = Math.max(start, 1 + (bin * binSize));
      const binStop = Math.min(stop, 1 + ((bin + 1) * binSize));
      if (binStop <= binStart) { continue; }
      const bp = (binStart + binStop) / 2;
      if (bp <= start || bp >= stop) { continue; }
      const summary = this._scoreSummaryFromIndex(binStart, binStop, scoreIndex);
      scoreIndex = summary.index;
      samples.push({bp, mean: summary.mean, min: summary.min, max: summary.max});
    }

    const stopSummary = this._scoreSummary(stop, stop);
    samples.push({bp: stop, ...stopSummary});
    return samples;
  }

  _scoreSummary(start, stop) {
    const index = utils.indexOfValue(this.positions, start, false);
    const summary = this._scoreSummaryFromIndex(start, stop, index);
    return {mean: summary.mean, min: summary.min, max: summary.max};
  }

  _scoreSummaryFromIndex(start, stop, startIndex) {
    let index = startIndex;
    while (index < this.scores.length - 1 && this.positions[index + 1] <= start) {
      index++;
    }
    const initialScore = this._validScore(this.scores[index]);
    if (stop <= start) {
      return {mean: initialScore, min: initialScore, max: initialScore, index};
    }

    let cursor = start;
    let weightedTotal = 0;
    let totalWeight = 0;
    let minimum = initialScore;
    let maximum = initialScore;
    while (cursor < stop) {
      while (index < this.scores.length - 1 && this.positions[index + 1] <= cursor) {
        index++;
      }
      const score = this._validScore(this.scores[index]);
      const nextChange = this.positions[index + 1] === undefined ? stop : this.positions[index + 1];
      const intervalStop = Math.min(stop, nextChange);
      const weight = intervalStop - cursor;
      if (weight > 0) {
        weightedTotal += score * weight;
        totalWeight += weight;
        minimum = Math.min(minimum, score);
        maximum = Math.max(maximum, score);
        cursor = intervalStop;
      } else if (index >= this.scores.length - 1) {
        const remainingWeight = stop - cursor;
        weightedTotal += score * remainingWeight;
        totalWeight += remainingWeight;
        cursor = stop;
      } else {
        index++;
      }
    }

    return {
      mean: totalWeight > 0 ? weightedTotal / totalWeight : initialScore,
      min: minimum,
      max: maximum,
      index,
    };
  }

  _validScore(score) {
    const numericScore = Number(score);
    return Number.isFinite(numericScore) ? numericScore : this.baseline;
  }

  _drawLinePath(canvas, geometry, color, orientation, fast = false) {
    const ctx = canvas.context('map');
    const fillColor = color.copy();
    fillColor.opacity *= 0.92;

    ctx.save();
    this._drawPlotFill(ctx, canvas, geometry, fillColor, orientation);
    if (!fast && this.viewer.settings.showPlotOutline) {
      const contourColor = color.copy();
      if (contourColor.relativeLuminance < 0.08) {
        contourColor.lighten(0.12);
      } else {
        contourColor.darken(0.12);
      }
      contourColor.opacity *= 0.9;
      this._drawPlotContour(ctx, canvas, geometry, contourColor, orientation);
    }
    ctx.restore();
  }

  _drawPlotFill(ctx, canvas, geometry, color, orientation) {
    const segments = this._activeSegments(geometry.samples, orientation);
    if (segments.length === 0) { return; }

    ctx.beginPath();
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const start = segment[0];
      const stop = segment[segment.length - 1];
      const baselineStart = canvas.pointForBp(start.bp, geometry.baselineRadius);
      const baselineStop = canvas.pointForBp(stop.bp, geometry.baselineRadius);
      ctx.moveTo(baselineStart.x, baselineStart.y);
      for (let j = 0; j < segment.length; j++) {
        const point = this._plotPoint(canvas, geometry, segment[j].bp, segment[j].mean);
        ctx.lineTo(point.x, point.y);
      }
      ctx.lineTo(baselineStop.x, baselineStop.y);
      canvas.path('map', geometry.baselineRadius, stop.bp, start.bp, true, 'noMoveTo');
      ctx.closePath();
    }
    ctx.fillStyle = color.rgbaString;
    ctx.fill();
  }

  _drawPlotContour(ctx, canvas, geometry, color, orientation) {
    const segments = this._activeSegments(geometry.samples, orientation);
    if (segments.length === 0) { return; }

    ctx.beginPath();
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const startPoint = this._plotPoint(canvas, geometry, segment[0].bp, segment[0].mean);
      ctx.moveTo(startPoint.x, startPoint.y);
      for (let j = 1; j < segment.length; j++) {
        const sample = segment[j];
        const point = this._plotPoint(canvas, geometry, sample.bp, sample.mean);
        ctx.lineTo(point.x, point.y);
      }
    }
    ctx.strokeStyle = color.rgbaString;
    ctx.lineWidth = 0.65;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  _activeSegments(samples, orientation) {
    if (samples.length === 0) { return []; }
    if (orientation === undefined) { return [samples]; }

    const segments = [];
    let segment;
    let previous = samples[0];
    let previousActive = this._keepPoint(previous.mean, orientation);
    if (previousActive) {
      segment = [previous];
    }

    for (let i = 1; i < samples.length; i++) {
      const sample = samples[i];
      const active = this._keepPoint(sample.mean, orientation);
      if (active && !previousActive) {
        segment = [this._baselineCrossing(previous, sample)];
      }
      if (active) {
        segment.push(sample);
      } else if (previousActive) {
        segment.push(this._baselineCrossing(previous, sample));
        segments.push(segment);
        segment = undefined;
      }
      previous = sample;
      previousActive = active;
    }
    if (segment) {
      segments.push(segment);
    }
    return segments;
  }

  _baselineCrossing(first, second) {
    const difference = second.mean - first.mean;
    if (difference === 0) { return {bp: second.bp, mean: this.baseline}; }
    const fraction = utils.constrain((this.baseline - first.mean) / difference, 0, 1);
    let bpDifference = second.bp - first.bp;
    if (bpDifference < 0) {
      bpDifference += this.viewer.sequence.length;
    }
    let bp = first.bp + (bpDifference * fraction);
    if (bp > this.viewer.sequence.length) {
      bp -= this.viewer.sequence.length;
    }
    return {bp, mean: this.baseline};
  }

  _plotPoint(canvas, geometry, bp, score) {
    const radius = geometry.baselineRadius +
      ((score - this.baseline) / geometry.axisRange * geometry.slotThickness);
    return canvas.pointForBp(bp, radius);
  }

  _keepPoint(score, orientation) {
    if (orientation === undefined) {
      return true;
    } else if (orientation === 'positive' && score > this.baseline) {
      return true;
    } else if (orientation === 'negative' && score < this.baseline) {
      return true;
    }
    return false;
  }

}

export default PlotRenderer;
