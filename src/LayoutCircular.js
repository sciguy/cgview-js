//////////////////////////////////////////////////////////////////////////////
// Layout for Circular Maps
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

import { line } from 'd3';
import CGRange from './CGRange';
import utils from './Utils';

/**
 * This Layout is in control of handling and drawing the map as a circle
 */
class LayoutCircular {

  /**
   * Create a Layout
   * @private
   */
  constructor(layout) {
    this._layout = layout;
  }

  toString() {
    return 'LayoutCircular';
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
    return 'circular';
  }

  //////////////////////////////////////////////////////////////////////////
  // Required Delegate Methods
  //////////////////////////////////////////////////////////////////////////

  // Return point on Canvas.
  // centerOffset is the radius for circular maps
  pointForBp(bp, centerOffset = this.backbone.adjustedCenterOffset) {
    const radians = this.scale.bp(bp);
    const x = this.scale.x(0) + (centerOffset * Math.cos(radians));
    const y = this.scale.y(0) + (centerOffset * Math.sin(radians));
    return {x: x, y: y};
  }

  // Options: float - return bp as a float (default is rounded)
  bpForPoint(point, options = {}) {
    const mapX = this.scale.x.invert(point.x);
    const mapY = this.scale.y.invert(point.y);
    const bpFloat = this.scale.bp.invert( utils.angleFromPosition(mapX, mapY) );
    return options.float ? bpFloat : Math.round(bpFloat);
    // return Math.round( this.scale.bp.invert( utils.angleFromPosition(mapX, mapY) ) );
  }


  centerOffsetForPoint(point) {
    // return Math.sqrt( (point.x * point.x) + (point.y * point.y) );
    const mapX = this.scale.x.invert(point.x);
    const mapY = this.scale.y.invert(point.y);
    return Math.sqrt( (mapX * mapX) + (mapY * mapY) );
  }

  // Return the X and Y domains for a bp and zoomFactor
  // Offset: Distances of map center from backbone
  //   0: backbone centered
  //   Minus: backbone moved down from canvas center
  //   Positive: backbone move up from canvas center
  domainsFor(bp, zoomFactor = this.viewer.zoomFactor, bbOffset = 0) {
    const halfRangeWidth = this.scale.x.range()[1] / 2;
    const halfRangeHeight = this.scale.y.range()[1] / 2;

    const centerOffset = (this.backbone.centerOffset * zoomFactor) - bbOffset;
    const centerPt = this._mapPointForBp(bp, centerOffset);

    // const yOffset = this.viewer._yOffset ? this.viewer._yOffset : 0;

    const x = bp ? centerPt.x : 0;
    const y = bp ? centerPt.y : 0;
    // const y = (bp ? centerPt.y : 0) - yOffset;

    return [ x - halfRangeWidth, x + halfRangeWidth, y + halfRangeHeight, y - halfRangeHeight];
  }

  // Zoom Factor does not affect circular bp scale so we only need
  // to set this once on initialization
  // Note that since the domain will be from 1 to length,
  // the range goes from the top of the circle to 1 bp less
  // than the top of the circle.
  adjustBpScaleRange(initialize = false) {
    if (initialize) {
      const radiansPerBp = (2 * Math.PI) / this.sequence.length;
      const rangeStart = -1 / 2 * Math.PI;
      const rangeStop = (3 / 2 * Math.PI) - radiansPerBp;
      this.scale.bp.range([rangeStart, rangeStop]);
    }
  }


  // TODO if undefined, see if centerOffset is visible
  // visibleRangeForCenterOffset(centerOffset, margin = 0) {
  visibleRangeForCenterOffset(centerOffset, options = {}) {
    // const ranges = this._visibleRangesForRadius(centerOffset, margin);
    const margin = options.margin || 0;
    const ranges = this._visibleRangesForRadius(centerOffset, options);
    if (ranges.length === 2) {
      return new CGRange(this.sequence.mapContig, ranges[0], ranges[1]);
    } else if (ranges.length > 2) {
      return new CGRange(this.sequence.mapContig, ranges[0], ranges[ranges.length - 1]);
    } else if ( (centerOffset - margin) > this._maximumVisibleRadius() ) {
      return undefined;
    } else if ( (centerOffset + margin) < this._minimumVisibleRadius() ) {
      return undefined;
    } else {
      return new CGRange(this.sequence.mapContig, 1, this.sequence.length);
    }
    // } else {
    //   return undefined
    // }
  }

  maxMapThickness() {
    // return this.viewer.minDimension / 2;
    return this.viewer.minDimension * this.layout._maxMapThicknessProportion;
  }

  pixelsPerBp(centerOffset = this.backbone.adjustedCenterOffset) {
    return (centerOffset * 2 * Math.PI) / this.sequence.length;
  }

  clockPositionForBp(bp, inverse = false) {
    const radians = this.scale.bp(bp);
    return utils.clockPositionForAngle( inverse ? (radians + Math.PI) : radians );
  }

  zoomFactorForLength(bpLength) {
    // Use viewer width as estimation arc length
    const arcLength = this.viewer.width;
    const zoomedRadius = arcLength / (bpLength / this.sequence.length * Math.PI * 2);
    return zoomedRadius / this.backbone.centerOffset;
  }

  initialWorkingSpace() {
    // return 0.25 * this.viewer.minDimension;
    return this.viewer.minDimension * this.layout._initialMapThicknessProportion;
  }

  // Calculate the backbone centerOffset (radius) so that the map is centered between the
  // circle center and the edge of the canvas (minDimension)
  updateInitialBackboneCenterOffset(insideThickness, outsideThickness) {
    // midRadius is the point between the circle center and the edge of the canvas
    // on the minDimension.
    const midRadius = this.viewer.minDimension * 0.25;
    // Minimum extra space inside of map
    const insideBuffer = 40; 
    // The mid radius has to have enough space for the inside thickness
    const adjustedMidRadius = Math.max(midRadius, insideThickness + insideBuffer)
    this.backbone.centerOffset = adjustedMidRadius - ((outsideThickness - insideThickness) / 2);
  }

  adjustedBackboneCenterOffset(centerOffset) {
    return centerOffset * this.viewer._zoomFactor;
  }

  path(layer, centerOffset, startBp, stopBp, anticlockwise = false, startType = 'moveTo') {
    // FIXME: change canvas to this where appropriate
    const canvas = this.canvas;
    const ctx = canvas.context(layer);
    const scale = this.scale;

    // Features less than 1000th the length of the sequence are drawn as straight lines
    const rangeLength = anticlockwise ? canvas.sequence.lengthOfRange(stopBp, startBp) : canvas.sequence.lengthOfRange(startBp, stopBp);
    if ( rangeLength < (canvas.sequence.length / 1000)) {
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
    } else {
      // ctx.arc(scale.x(0), scale.y(0), centerOffset, scale.bp(startBp), scale.bp(stopBp), anticlockwise);

      // console.log(startBp, stopBp)
      // console.log(scale.bp(startBp))
      // console.log(scale.bp(stopBp))

      // This code is required to draw SVG images correctly
      // SVG can not handle arcs drawn as circles
      // So for arcs that are close to becoming full circles, 
      // they are split into 2 arcs
      if ( (rangeLength / canvas.sequence.length) > 0.95) {
        const startRads = scale.bp(startBp);
        const stopRads = scale.bp(stopBp);
        let midRads = startRads + ((stopRads - startRads) / 2);
        // 1 bp of cushion is given to prevent calling this when start and stop are the same
        // but floating point issues cause one to be larger than the other
        if ( (startBp > (stopBp+1) && !anticlockwise) || (startBp < (stopBp-1) && anticlockwise) ) {
          // Mid point is on opposite side of circle
          midRads += Math.PI;
        }
        ctx.arc(scale.x(0), scale.y(0), centerOffset, startRads, midRads, anticlockwise);
        ctx.arc(scale.x(0), scale.y(0), centerOffset, midRads, stopRads, anticlockwise);
      } else {
        ctx.arc(scale.x(0), scale.y(0), centerOffset, scale.bp(startBp), scale.bp(stopBp), anticlockwise);
      }

    }
  }

  centerCaptionPoint() {
    return this.pointForBp(0, 0);
  }

  drawCenterLine() {
    const viewer = this.viewer;
    const canvas = this.canvas;
    const ruler = this.viewer.ruler;
    const centerLine = viewer.centerLine;

    // Setup
    const color = centerLine.color.rgbaString;
    const centerPt = this.pointForBp(0, 0);
    const ctx = canvas.context('foreground');
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = centerLine.thickness;
    // ctx.lineCap = 'round'
    ctx.setLineDash(centerLine.dashes);

    // Center point
    if (viewer.zoomFactor < 4 && centerLine.color.opacity == 1) {
      ctx.beginPath();
      ctx.arc(centerPt.x, centerPt.y, centerLine.thickness, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Center line (Radiant)
    let lineLength, centerOffset;
    if (viewer.zoomFactor < 4) {
      centerOffset = 0;
      lineLength =  this.layout.centerOutsideOffset + ruler.spacing;
    } else {
      const maxLength = viewer.maxDimension * 2
      const fullLength =  this.layout.centerOutsideOffset + ruler.spacing;
      lineLength = Math.min(fullLength, maxLength);
      centerOffset = Math.max(fullLength - lineLength, 0);
      // console.log(centerOffset, fullLength, lineLength)
    }
    canvas.radiantLine('foreground', viewer.bpFloat, centerOffset, lineLength, centerLine.thickness, centerLine.color.rgbaString, 'butt', centerLine.dashes);
    // Reset dashes
    ctx.setLineDash([]);
  }

  //////////////////////////////////////////////////////////////////////////
  // Helper Methods
  //////////////////////////////////////////////////////////////////////////

  // Return map point (map NOT canvas coordinates) for given bp and centerOffset.
  // centerOffset is the radius for circular maps
  _mapPointForBp(bp, centerOffset = this.backbone.adjustedCenterOffset) {
    const radians = this.scale.bp(bp);
    const x = centerOffset * Math.cos(radians);
    const y = -centerOffset * Math.sin(radians);
    return {x: x, y: y};
  }

  _centerVisible() {
    const x = this.scale.x(0);
    const y = this.scale.y(0);
    return (x >= 0 &&
            x <= this.width &&
            y >= 0 &&
            y <= this.height);
  }

  /**
   * Return the distance between the circle center and the farthest corner of the canvas
   */
  _maximumVisibleRadius() {
    // Maximum distance on x axis between circle center and the canvas 0 or width
    const maxX = Math.max( Math.abs(this.scale.x.invert(0)), Math.abs(this.scale.x.invert(this.width)) );
    // Maximum distance on y axis between circle center and the canvas 0 or height
    const maxY = Math.max( Math.abs(this.scale.y.invert(0)), Math.abs(this.scale.y.invert(this.height)) );
    // Return the hypotenuse
    return Math.sqrt( (maxX * maxX) + (maxY * maxY) );
  }

  _minimumVisibleRadius() {
    if (this._centerVisible()) {
      // Center is visible so the minimum radius has to be 0
      return 0;
    } else if ( utils.oppositeSigns(this.scale.x.invert(0), this.scale.x.invert(this.width)) ) {
      // The canvas straddles 0 on the x axis, so the minimum radius is the distance to the closest horizontal line
      return Math.min( Math.abs(this.scale.y.invert(0)), Math.abs(this.scale.y.invert(this.height)));
    } else if ( utils.oppositeSigns(this.scale.y.invert(0), this.scale.y.invert(this.height)) ) {
      // The canvas straddles 0 on the y axis, so the minimum radius is the distance to the closest vertical line
      return Math.min( Math.abs(this.scale.x.invert(0)), Math.abs(this.scale.x.invert(this.width)));
    } else {
      // Closest corner of the canvas
      // Minimum distance on x axis between circle center and the canvas 0 or width
      const minX = Math.min( Math.abs(this.scale.x.invert(0)), Math.abs(this.scale.x.invert(this.width)) );
      // Minimum distance on y axis between circle center and the canvas 0 or height
      const minY = Math.min( Math.abs(this.scale.y.invert(0)), Math.abs(this.scale.y.invert(this.height)) );
      // Return the hypotenuse
      return Math.sqrt( (minX * minX) + (minY * minY) );
    }
  }

  // _visibleRangesForRadius(radius, margin = 0) {
  _visibleRangesForRadius(radius, options = {}) {
    const margin = options.margin || 0;
    const angles = utils.circleAnglesFromIntersectingRect(radius,
      this.scale.x.invert(0 - margin),
      this.scale.y.invert(0 - margin),
      this.width + (margin * 2),
      this.height + (margin * 2)
    );
    if (options.float) {
      return angles.map( a => this.scale.bp.invert(a) );
    } else {
      return angles.map( a => Math.round(this.scale.bp.invert(a)) );
    }
  }

}

export default LayoutCircular;

