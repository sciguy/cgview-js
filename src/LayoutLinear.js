//////////////////////////////////////////////////////////////////////////////
// Layout for Linear Maps
//////////////////////////////////////////////////////////////////////////////

/**
 * CGView.js – Interactive Circular Genome Viewer
 * Copyright © 2016–2025 Jason R. Grant
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

import CGRange from './CGRange';
import utils from './Utils';

/**
 * This Layout is in control of handling and drawing the map as a line
 */
class LayoutLinear {

  /**
   * Create a Layout
   * @private
   */
  constructor(layout) {
    this._layout = layout;
  }

  toString() {
    return 'LayoutLinear';
  }

  // Convenience properties
  get layout() { return this._layout; }
  get viewer() { return this.layout.viewer; }
  get canvas() { return this.layout.canvas; }
  get backbone() { return this.layout.backbone; }
  get sequence() { return this.layout.sequence; }
  get scale() { return this.layout.scale; }
  get width() { return this.layout.width; }
  get height() { return this.layout.height; }

  get type() {
    return 'linear';
  }

  //////////////////////////////////////////////////////////////////////////
  // Required Delegate Methods
  //////////////////////////////////////////////////////////////////////////

  pointForBp(bp, centerOffset = this.backbone.adjustedCenterOffset) {
    const x = this.scale.x(this.scale.bp(bp));
    const y = this.scale.y(centerOffset);
    return {x: x, y: y};
  }

  // NOTE: only the X coordinate of the point is required
  // Options: float - return bp as a float (default is rounded)
  bpForPoint(point, options = {}) {
    const mapX = this.scale.x.invert(point.x);
    const bpFloat = this.scale.bp.invert(mapX);
    return options.float ? bpFloat : Math.round(bpFloat);
    // return Math.round( this.scale.bp.invert( mapX) );
  }

  centerOffsetForPoint(point) {
    // return point.y;
    return this.scale.y.invert(point.y);
  }

  // Return the X and Y domains for a bp and zoomFactor
  // Offset: Distances of map center from backbone
  //   0: backbone centered
  //   Minus: backbone moved down from canvas center
  //   Positive: backbone move up from canvas center
  domainsFor(bp, zoomFactor = this.viewer.zoomFactor, bbOffset = 0) {
    const halfRangeWidth = this.scale.x.range()[1] / 2;
    const halfRangeHeight = this.scale.y.range()[1] / 2;

    // _mapPointForBp requires the bp scale be first altered for the zoom level
    const origScaleBp = this.scale.bp.copy();

    const rangeHalfWidth2 = this.canvas.width * zoomFactor / 2;
    this.scale.bp.range([-rangeHalfWidth2, rangeHalfWidth2]);

    const centerPt = this._mapPointForBp(bp, (this.backbone.centerOffset - bbOffset));
    // Return to the original scale
    this.scale.bp = origScaleBp;
    const x = bp ? centerPt.x : 0;
    const y = bp ? centerPt.y : 0;

    return [ x - halfRangeWidth, x + halfRangeWidth, y + halfRangeHeight, y - halfRangeHeight];
  }

  // Does not need the initial argument
  adjustBpScaleRange() {
    const rangeHalfWidth = this.canvas.width * this.viewer.zoomFactor / 2;
    this.scale.bp.range([-rangeHalfWidth, rangeHalfWidth]);
  }

  // TODO if undefined, see if centerOffset is visible
  // visibleRangeForCenterOffset(centerOffset, margin = 0) {
  visibleRangeForCenterOffset(centerOffset, options = {} ) {
    const margin = options.margin || 0;
    const domainX = this.scale.x.domain();
    const startFloat = this.scale.bp.invert(domainX[0] - margin);
    const endFloat = this.scale.bp.invert(domainX[1] + margin);
    const start = (options.float) ? startFloat : Math.floor(startFloat);
    const end = (options.float) ? endFloat : Math.ceil(endFloat);
    // const start = Math.floor(this.scale.bp.invert(domainX[0] - margin));
    // const end = Math.ceil(this.scale.bp.invert(domainX[1] + margin));
    // const start = this.scale.bp.invert(domainX[0] - margin);
    // const end = this.scale.bp.invert(domainX[1] + margin);
    return new CGRange(this.sequence.mapContig,
      Math.max(start, 1),
      Math.min(end, this.sequence.length));
  }

  maxMapThickness() {
    // return this.viewer.height / 2;
    return this.viewer.height * this.layout._maxMapThicknessProportion;
  }

  // For linear maps the pixels per bp is independent of the centerOffset
  pixelsPerBp(centerOffset = this.backbone.adjustedCenterOffset) {
    const scaleBp = this.scale.bp;
    const range = scaleBp.range();
    return  (range[1] - range[0]) / (scaleBp.invert(range[1]) - scaleBp.invert(range[0]));
  }

  clockPositionForBp(bp, inverse = false) {
    return inverse ? 6 : 12;
  }

  zoomFactorForLength(bpLength) {
    return this.sequence.length / bpLength;
  }

  initialWorkingSpace() {
    // return 0.25 * this.viewer.minDimension;
    return this.viewer.minDimension * this.layout._initialMapThicknessProportion;
  }

  // The backbone will be the center of the map
  updateInitialBackboneCenterOffset(insideThickness, outsideThickness) {
    this.backbone.centerOffset = 0;
  }

  adjustedBackboneCenterOffset(centerOffset) {
    return centerOffset;
  }

  path(layer, centerOffset, startBp, stopBp, anticlockwise = false, startType = 'moveTo') {
    const canvas = this.canvas;
    const ctx = canvas.context(layer);

    // FIXME: have option to round points (could use for divider lines)
    const p2 = this.pointForBp(stopBp, centerOffset);
    if (startType === 'lineTo') {
      const p1 = this.pointForBp(startBp, centerOffset);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
    } else if (startType === 'moveTo') {
      const p1 = this.pointForBp(startBp, centerOffset);
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
    } else if (startType === 'noMoveTo') {
      ctx.lineTo(p2.x, p2.y);
    }
  }

  centerCaptionPoint() {
    const bp = this.sequence.length / 2;
    // FIXME: this should be calculated based on the thickness of the slots
    return this.pointForBp(bp , -200);
  }

  drawCenterLine() {
    const viewer = this.viewer;
    const canvas = this.canvas;
    const ruler = this.viewer.ruler;
    const centerLine = viewer.centerLine;
    // Setup
    const color = centerLine.color.rgbaString;
    const ctx = canvas.context('foreground');
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = centerLine.thickness;
    // ctx.lineCap = 'round'
    ctx.setLineDash(centerLine.dashes);

    // Center line (using bpFloat)
    const bp = utils.constrain(viewer.bpFloat, 1, this.sequence.length);
    // const x = this.scale.x(this.scale.bp(viewer.bp));
    const x = this.scale.x(this.scale.bp(bp));
    ctx.beginPath();
    // ctx.moveTo(x, 0);
    // ctx.lineTo(x, viewer.height);
    ctx.moveTo(x, viewer.height);
    const lineLength =  this.layout.centerOutsideOffset + ruler.spacing;
    const endPt = this.pointForBp(bp, lineLength);
    // ctx.lineTo(endPt.x, endPt.y);
    ctx.lineTo(x, endPt.y);

    ctx.stroke();

    // Reset dashes
    ctx.setLineDash([]);
  }

  //////////////////////////////////////////////////////////////////////////
  // Helper Methods
  //////////////////////////////////////////////////////////////////////////

  // Return map point (map NOT canvas coordinates) for given bp and centerOffset.
  // centerOffset is the distance from the backbone.
  _mapPointForBp(bp, centerOffset = this.backbone.adjustedCenterOffset) {
    const x = this.scale.bp(bp);
    const y = centerOffset;
    return {x: x, y: y};
  }


}

export default LayoutLinear;


