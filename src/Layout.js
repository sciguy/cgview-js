// FIXME: Use delegate for layout format
//   - move zoomFactor to layout
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

import LayoutCircular from './LayoutCircular';
import LayoutLinear from './LayoutLinear';
import utils from './Utils';
import * as d3 from 'd3';

// NOTES:
//  - _adjustProportions is called when components: dividers, backbone, tracks/slots
//      - change in number, visibility or thickness
//      - layout format changes
//      - max/min slot thickness change
//      - initial/max map thickness proportion
//  - updateLayout is called when
//      - proportions are updated
//      - every draw loop only if the zoom level has changed

  /**
   * Layout controls how everything is draw on the map.
   * It also determines the best size for the tracks so they fit on the map.
   * See [Map Scales](../tutorials/details-map-scales.html) for details on
   * circular and linear layouts.
   */
class Layout {

  /**
   * Create a the Layout
   */
  constructor(viewer) {
    this._viewer = viewer;

    // _fastMaxFeatures is the maximum number of features allowed to be drawn in fast mode.
    this._fastMaxFeatures = 1000;
    // FIXME: move to settings
    // this._minSlotThickness = CGV.defaultFor(data.minSlotThickness, 1);
    // this._maxSlotThickness = CGV.defaultFor(data.maxSlotThickness, 50);
    this._minSlotThickness = 1;
    this._maxSlotThickness = 50;
    // Default values. These will be overridden by the values in Settings.
    this._maxMapThicknessProportion = 0.5;
    this._initialMapThicknessProportion = 0.1;

    // Setup scales
    this._scale = {};

    this._adjustProportions();
  }

  toString() {
    return 'Layout';
  }

  // FIXME: make all these convience properties like in the delegates
  //  - this will clear up the documentation and reduce the lines of unexciting code
  /**
   * @member {Viewer} - Get the *Viewer*
   */
  get viewer() {
    return this._viewer;
  }


  /** * @member {Canvas} - Get the *Canvas*
   */
  get canvas() {
    return this.viewer.canvas;
  }

  /** * @member {Number} - Get the canvas width
   */
  get width() {
    return this.canvas.width;
  }

  /** * @member {Number} - Get the canvas height
   */
  get height() {
    return this.canvas.height;
  }

  /** * @member {Sequence} - Get the *Sequence*
   */
  get sequence() {
    return this.viewer.sequence;
  }

  /** * @member {Backbone} - Get the *Backbone*
   */
  get backbone() {
    return this.viewer.backbone;
  }

  /**
   * @member {Object} - Return an object that contains the 3 [D3 Continuous Scales](https://github.com/d3/d3-scale#continuous-scales) used by CGView.
   * See [Map Scales](../tutorials/details-map-scales.html) for details.
   *
   * Scale | Description
   * ------|------------
   *  x    | Convert between the canvas x position (0 is left side of canvas) and map x position (center of map).
   *  y    | Convert between the canvas y position (0 is top side of canvas) and map y position (center of map).
   *  bp - circular | Convert between bp and radians (Top of map is 1 bp and -π/2).
   *  bp - linear   | Convert between bp and distance on x-axis
   */
  // ```js
  // // Examples:
  // // For a map with canvas width and height of 600. Before moving or zooming the map.
  // canvas.scale.x(0)          // 300
  // canvas.scale.y(0)          // 300
  // canvas.scale.x.invert(300) // 0
  // canvas.scale.y.invert(300) // 0
  // // For a map with a length of 1000
  // canvas.scale.bp(1)        // -π/2
  // canvas.scale.bp(250)      // 0
  // canvas.scale.bp(500)      // π/2
  // canvas.scale.bp(750)      // π
  // canvas.scale.bp(1000)     // 3π/2
  // canvas.scale.bp(1000)     // 3π/2
  // canvas.scale.bp.invert(π) // 750
  // ```
  get scale() {
    return this._scale;
  }

  get delegate() {
    return this._delegate;
  }

  /**
   * @member {Canvas} - Get or set the layout type: linear or circular.
   */
  get type() {
    return this.delegate && this.delegate.type;
  }

  set type(value) {
    // Determine map center bp before changing layout
    const centerBp = this.delegate && this.canvas.bpForCanvasCenter();
    const layoutChanged = Boolean(this.delegate && this.type !== value);
    if (value === 'linear') {
      this._delegate = new LayoutLinear(this);
    } else if (value === 'circular') {
      this._delegate = new LayoutCircular(this);
    } else {
      throw 'Layout type must be one of the following: linear, circular';
    }
    this._adjustProportions();
    this.updateScales(layoutChanged, centerBp);
  }

  /** * @member {Number} - Get the distance from the backbone to the inner/bottom edge of the map.
   */
  get bbInsideOffset() {
    return this._bbInsideOffset;
  }

  /** * @member {Number} - Get the distance from the backbone to the outer/top edge of the map.
   */
  get bbOutsideOffset() {
    return this._bbOutsideOffset;
  }

  /** * @member {Number} - Get the distance from the center of the map to the inner/bottom edge of the map.
   */
  get centerInsideOffset() {
    return this._bbInsideOffset + this.backbone.adjustedCenterOffset;
  }

  /** * @member {Number} - Get the distance from the center of the map to the outer/top edge of the map.
   */
  get centerOutsideOffset() {
    return this._bbOutsideOffset + this.backbone.adjustedCenterOffset;
  }

  /** * @member {Number} - Get an object with stats about slot thickness ratios.
   * @private
   */
  get slotThicknessRatioStats() {
    return this._slotThicknessRatioStats;
  }

  /** * @member {Number} - Get an object with stats about slot proportion of map thickness.
   * @private
   */
  get slotProportionStats() {
    return this._slotProportionStats;
  }

  //////////////////////////////////////////////////////////////////////////
  // Required Delegate Methods
  //////////////////////////////////////////////////////////////////////////

  /**
   * @typedef {Object} Point
   * @property {number} x The X Coordinate
   * @property {number} y The Y Coordinate
   */

  /**
   * Returns the point on the canvas for the given *bp* and *centerOffset*.
   * @param {Number} bp - Basepair
   * @param {Number} [centerOffset={@link Backbone#adjustedCenterOffset Backbone.adjustedCenterOffset}] - Distance from the center of the map. For a circular map, this is the radius, while for a linear map, it's the distance from the backbone.
   *
   * @returns {Point} - The point on the canvas.
   */
  pointForBp(...args) {
    return this.delegate.pointForBp(...args);
  }

  /**
   * Returns the basepair corresponding to the given *point* on the canvas.
   * @param {Point} point - Point on the canvas.
   *
   * @returns {Number} - The basepair.
   */
  bpForPoint(...args) {
    return this.delegate.bpForPoint(...args);
  }

  /**
   * Returns the Center Offset for the given *point* on the canvas.
   * Center offset is the distance from the center of the map.
   * For a circular map, this is the radius, while for a linear map, it's the distance from the backbone.
   * @param {Point} point - Point on the canvas.
   *
   * @returns {Number} - Center Offset
   */
  centerOffsetForPoint(...args) {
    return this.delegate.centerOffsetForPoint(...args);
  }

  /**
   * Returns the X and Y scale domains for the given *bp* and *zoomFactor*.
   * @param {Number} bp - Basepair
   * @param {Number} [zoomFactor=Current viewer zoom factor] - The zoom factor used to calculate the domains
   *
   * @returns {Array} - The X and Y scale domains in the form of [[X1, X2], [Y1, Y2]].
   */
  domainsFor(...args) {
    return this.delegate.domainsFor(...args);
  }

  /**
   * Adjust the scale.bp.range. This methods is mainly required for Linear maps and is called
   * when ever the zoomFactor is changed. For circular maps, it only needs to be called when
   * initializing the bp scale.
   * @param {Boolean} initialize - Only used by Circular maps.
   * @private
   */
  adjustBpScaleRange(...args) {
    return this.delegate.adjustBpScaleRange(...args);
  }

  /**
   * Return the CGRange for the sequence visisible at the given *centerOffset*.
   * The *margin* is a distance in pixels added on to the Canvas size when
   * calculating the CGRange.
   * @param {Number} centerOffset - The distance from the center of them map.
   * @param {Number} OLDmargin - An amount (in pixels) added to the Canvas in all dimensions.
   * @param {Object} options - margin: An amount (in pixels) added to the Canvas in all dimensions (Default: 0)
   *                         - float:  Return the range basepairs as a floats (default: false)
   *
   * @returns {CGRange} - the visible range.
   */
  // visibleRangeForCenterOffset(offset, margin = 0) {
  // visibleRangeForCenterOffset(...args) {
  visibleRangeForCenterOffset(centerOffset, options = {}) {
    const defaultOptions = { margin: 0, float: false };
    return this.delegate.visibleRangeForCenterOffset(centerOffset, {...defaultOptions, ...options});
  }

  /**
   * Return the maximum thickness of the map. Depends on the dimensions of the Canvas.
   * @returns {Number}
   * @private
   */
  maxMapThickness() {
    return this.delegate.maxMapThickness();
  }

  /**
   * The number of pixels per basepair along the given *centerOffset*.
   * @param {Number} [centerOffset={@link Backbone#adjustedCenterOffset Backbone.adjustedCenterOffset}] - Distance from the center of the map. For a circular map, this is the radius, while for a linear map, it's the distance from the backbone.
   * @return {Number} - Pixels per basepair.
   */
  pixelsPerBp(...args) {
    return this.delegate.pixelsPerBp(...args);
  }

  /**
   * Returns the clock position (1-12) for the supplied bp.
   * For example, the top of the map would be 12, the bottom would be 6 and
   * the right side of a circular map will be 3.
   * @param {Number} bp - Basepair position on the map.
   * @param {Boolean} invers - When true, give the opposite clock position (e.g. 6 instead of 12).
   *
   * @returns {Number} - An integer between 1 and 12.
   */
  clockPositionForBp(...args) {
    return this.delegate.clockPositionForBp(...args);
  }

  /**
   * Estimate of the zoom factor, if the viewer was only showing the given *bpLength*
   * as a portion of the total length.
   * @param {Number} bpLength - Length in basepairs.
   * @returns {Number} - Zoom Factor
   * @private
   */
  zoomFactorForLength(...args) {
    return this.delegate.zoomFactorForLength(...args);
  }

  /**
   * Return the initial maximum space/thickness to draw the map around the backbone.
   * This is usually some fraction of the viewer dimensions.
   * @returns {Number}
   * @private
   */
  initialWorkingSpace() {
    return this.delegate.initialWorkingSpace();
  }

  /**
   * Set the backbone centerOffset based on the approximate inside and outside
   * thickness of the map.
   * @param {Number} insideThickness - The thickness of the inside of the map. From
   *   the backbone down (linear) or towards the center (circular).
   * @param {Number} outsideThickness - The thickness of the outside of the map. From
   *   the backbone up (linear) or towards the outside (circular).
   *   @private
   */
  updateInitialBackboneCenterOffset(...args) {
    this.delegate.updateInitialBackboneCenterOffset(...args);
  }

  /**
   * Return an the backbone center offset adjusted for the zoom level.
   * @param {Number} centerOffset - The backbone initial centerOffset.
   * @returns {Number} adjustedCenterOffset
   */
  adjustedBackboneCenterOffset(...args) {
    return this.delegate.adjustedBackboneCenterOffset(...args);
  }

  // FIXME: update arguments
  /**
   * Adds a lineTo path to the given *layer*. Path does not draw. It only adds lineTo and optionally moveTo
   * commands to the context for the given *layer*.
   * @param {String} layer - The name of the canvas layer to add the path.
   * @param {Number} centerOffset - This distance from the center of the Map.
   * @param {Number} startBp - The start position in basepairs.
   * @param {Number} stopBp - The stop position in basepairs.
   * @param {Boolean} [anticlockwise=false] - For circular maps the default direction is clockwise. Set this to true to draw arcs, anticlockwise.
   * @param {String} [startType='moveTo'] - How the path should be started. Allowed values:
   * <br /><br />
   *  - moveTo:  *moveTo* start; *lineTo* stop
   *  - lineTo: *lineTo* start; *lineTo* stop
   *  - noMoveTo:  ingore start; *lineTo* stop
   */
  path(...args) {
    this.delegate.path(...args);
  }

  // Returns appropriate center point for captions
  // e.g. center of circlular map or right below linear map
  centerCaptionPoint() {
    return this.delegate.centerCaptionPoint();
  }

  // TODO: docs
  /**
   * Draw the center line.
   */
  drawCenterLine() {
    this.delegate.drawCenterLine();
  }

  //////////////////////////////////////////////////////////////////////////
  // Common methods for current layouts: linear, circular
  //  - These methods may have to be altered if additional layouts are added
  //////////////////////////////////////////////////////////////////////////

  // NOTES:
  //  - 3 scenarios
  //    - scales have not been initialized so simple center the map
  //    - scales already initialized and layout has not changed
  //      - keep the map centered as the scales change
  //    - layout changed
  //      - based on zoom will the whole map be in the canvas (determine from radius for the zoom)
  //        - if so: center the map
  //        - if not: center the map on the backbone at the bp that was the linear center
  updateScales(layoutChanged, bp) {
    if (!this.sequence) { return; }
    bp = bp && this.sequence.constrain(bp);
    const canvas = this.canvas;
    const scale = this.scale;

    // BP Scale
    scale.bp = d3.scaleLinear()
      .domain([1, this.sequence.length]);
    // The argument 'true' only affects the circular version of this method
    this.adjustBpScaleRange(true);
    this.viewer._updateZoomMax();

    // X/Y Scales
    if (layoutChanged) {
      // Deleting the current scales will cause the map to be centered
      scale.x = undefined;
      scale.y = undefined;
      this._updateScaleForAxis('x', canvas.width);
      this._updateScaleForAxis('y', canvas.height);
      // At larger zoom levels and when a bp was given, center the map on that bp
      const zoomFactorCutoff = 1.25;
      if (this.viewer.zoomFactor > zoomFactorCutoff && bp) {
        this.viewer.zoomTo(bp, this.viewer.zoomFactor, {duration: 0});
      }
    } else {
      // The canvas is being resized or initialized
      this._updateScaleForAxis('x', canvas.width);
      this._updateScaleForAxis('y', canvas.height);
    }
  }

  // The center of the zoom will be the supplied bp position on the backbone.
  // The default bp will be based on the center of the canvas.
  zoom(zoomFactor, bp = this.canvas.bpForCanvasCenter()) {
    // Center of zoom before zooming
    const {x: centerX1, y: centerY1} = this.pointForBp(bp);

    zoomFactor = utils.constrain(zoomFactor, this.viewer.minZoomFactor, this.viewer.maxZoomFactor);

    // Update the d3.zoom transform.
    // Only need to do this if setting Viewer.zoomFactor. The zoom transform is set
    // automatically when zooming via d3 (ie. in Viewer-Zoom.js)
    d3.zoomTransform(this.canvas.node('ui')).k = zoomFactor;

    // Update zoom factor
    this.viewer._zoomFactor = zoomFactor;

    // Update the BP scale, currently this is only needed for the linear layout
    this.adjustBpScaleRange();

    // Center of zoom after zooming
    // pointForBp is on the backbone by default
    const {x: centerX2, y: centerY2} = this.pointForBp(bp);

    // Find differerence in x/y and translate the domains
    const dx = centerX1 - centerX2;
    const dy = centerY2 - centerY1;
    this.translate(dx, -dy);
  }

  translate(dx, dy) {
    const domainX = this.scale.x.domain();
    const domainY = this.scale.y.domain();
    this.scale.x.domain([domainX[0] - dx, domainX[1] - dx]);
    this.scale.y.domain([domainY[0] + dy, domainY[1] + dy]);
  }


  //////////////////////////////////////////////////////////////////////////
  // Methods for determining offsets and Drawing
  // FIXME: Organized better
  //////////////////////////////////////////////////////////////////////////

  _updateSlotThicknessRatioStats(slots = this.visibleSlots()) {
    const thicknessRatios = slots.map( s => s.thicknessRatio );
    this._slotThicknessRatioStats = {
      min: d3.min(thicknessRatios),
      max: d3.max(thicknessRatios),
      sum: d3.sum(thicknessRatios)
    };
  }

  _updateSlotProportionStats(slots = this.visibleSlots()) {
    const proportions = slots.map( s => s.proportionOfMap );
    this._slotProportionStats = {
      min: d3.min(proportions),
      max: d3.max(proportions),
      sum: d3.sum(proportions)
    };
  }

  // position: 'inside', 'outside'
  _trackNonSlotSpace(track, position = 'inside') {
    const dividers = this.viewer.dividers;

    const slots = track.slots().filter( s =>  s.visible && s[position] );

    // const visibleSlots = track.slots().filter( s =>  s.visible );
    // const slots = visibleSlots.filter( s =>  s[position] );

    let space = 0;
    if (slots.length > 0) {
      // Add track start and end divider spacing
      space += dividers.track.adjustedSpacing * 2;
      // Add track divider thickness
      space += dividers.track.adjustedThickness;
      // Add slot divider spacing and thickness
      const slotDividerCount = slots.length - 1;
      space += slotDividerCount * ((dividers.slot.adjustedSpacing * 2) + dividers.slot.adjustedThickness);
    }
    return space;
    // return 3;
  }

  // Returns the space (in pixels) of everything but the slots
  // i.e. dividers, spacing, and backbone
  // position: 'inside', 'outside', 'both'
  // Note: the backbone is only included if position is 'both'
  _nonSlotSpace(position = 'both') {
    let space = 0;
    const visibleTracks = this.tracks().filter( t =>  t.visible );
    for (let i = 0, len = visibleTracks.length; i < len; i++) {
      const track = visibleTracks[i];
      if (position === 'both') {
        space += this._trackNonSlotSpace(track, 'inside');
        space += this._trackNonSlotSpace(track, 'outside');
      } else {
        space += this._trackNonSlotSpace(track, position);
      }
    }
    if (position === 'both') {
      space += this.backbone.adjustedThickness;
    }

    // console.log('_nonSlotSpace', position, space);
    return space;
  }

  _findSpace(visibleSlots, spaceType = 'min') {
    visibleSlots = visibleSlots || this.visibleSlots();
    const findMinSpace = (spaceType === 'min');
    const minSlotThickness = this.minSlotThickness;
    const maxSlotThickness = this.maxSlotThickness;
    const minThicknessRatio = this.slotThicknessRatioStats.min;
    const maxThicknessRatio = this.slotThicknessRatioStats.max;
    // let space = this._nonSlotSpace(visibleSlots);
    let space = this._nonSlotSpace();
    // If the min and max slot thickness range is too small for the min/max thickness ratio,
    // we have to scale the ratios
    const scaleRatios = (minSlotThickness / minThicknessRatio * maxThicknessRatio > maxSlotThickness);
    for (let i = 0, len = visibleSlots.length; i < len; i++) {
      const slot = visibleSlots[i];
      // Add Slot thickness based on thicknessRatio and min/max slot thickness
      if (scaleRatios) {
        space += utils.scaleValue(slot.thicknessRatio,
          {min: minThicknessRatio, max: maxThicknessRatio},
          {min: minSlotThickness, max: maxSlotThickness});
      } else {
        if (findMinSpace) {
          space += slot.thicknessRatio * minSlotThickness / minThicknessRatio;
        } else {
          space += slot.thicknessRatio * maxSlotThickness / maxThicknessRatio;
        }
      }
    }
    return space;
  }

  _minSpace(visibleSlots) {
    return this._findSpace(visibleSlots, 'min');
  }

  _maxSpace(visibleSlots) {
    return this._findSpace(visibleSlots, 'max');
  }

  /**
   * Calculate the backbone centerOffset and slot proportions based on the Viewer size and
   * the number of slots. Note, that since this will usually move the map
   * backbone for circular maps, it also recenters the map backbone If the 
   * zoomFactor is above 2.
   * @private
   */
  _adjustProportions() {
    const viewer = this.viewer;
    if (viewer.loading) { return; }
    const visibleSlots = this.visibleSlots();
    this._updateSlotThicknessRatioStats(visibleSlots);
    // The initial maximum amount of space for drawing slots, backbone, dividers, etc
    const workingSpace = this.initialWorkingSpace();
    // Minimum Space required (based on minSlotThickness)
    const minSpace = this._minSpace(visibleSlots);
    // May need to scale slots, backbone, dividers and spacing to fit everything
    const thicknessScaleFactor = Math.min(workingSpace / minSpace, 1);
    // Calculate nonSlotSpace
    // const nonSlotSpace = this._nonSlotSpace() * thicknessScaleFactor;
    // let slotSpace = (workingSpace * thicknessScaleFactor) - nonSlotSpace;

    // FIXME: Issues with negative slot space for above. Try this for now:
    // I really need to rethink this
    // NOTE: Mulitplying by the zoomFactor was causing an issue when adding tracks at a zoom level close to max
    //       Removing the zoomFactor seems to fix the issue. Keep an eye on this.
    // const minSize = this.initialWorkingSpace() * viewer.zoomFactor;
    const minSize = this.initialWorkingSpace();
    const mapThickness = Math.min(minSize, this.maxMapThickness());
    const slotSpace = mapThickness;
    // console.log(workingSpace, slotSpace, thicknessScaleFactor, nonSlotSpace)

    // The sum of the thickness ratios
    const thicknessRatioSum = this.slotThicknessRatioStats.sum;

    let outsideThickness = this._nonSlotSpace('outside');
    let insideThickness = this._nonSlotSpace('inside');

    // Update slot thick proportions
    this.visibleSlots().each( (i, slot) => {
      slot.proportionOfMap = slot.thicknessRatio / thicknessRatioSum;
      const slotThickness = slotSpace * slot.proportionOfMap;
      if (slot.inside) {
        insideThickness += slotThickness;
      } else {
        outsideThickness += slotThickness;
      }
    });
    this._updateSlotProportionStats(visibleSlots);

    this.updateInitialBackboneCenterOffset(insideThickness, outsideThickness);

    this._calculateMaxMapThickness();

    this.updateLayout(true);
    // Recenter map
    if (viewer.zoomFactor > 2) {
      viewer.moveTo(undefined, undefined, {duration: 500});
    }
  }
  // NOTE:
  // - Also calculate the maxSpace
  //   - then convert to proportion of radius [maxSpaceProportion]
  //   - then use the min(maxSpaceProportion and calculated proportion [slot.thicknessRation / sum slot.thicknessRatio ]
  //   - then assign proportionOfRadius to each slot
  //     - calculated proportion / the min (from above)
  //     - could use scaler here
  // - or drawing slots, dividers, etc should use layout.scaleFactor when drawing
  // console.log({
  //   workingSpace: workingSpace,
  //   minSpace: minSpace,
  //   thicknessScaleFactor: thicknessScaleFactor,
  //   nonSlotSpace: nonSlotSpace,
  //   slotSpace: slotSpace,
  //   // thicknessRatios: thicknessRatios,
  //   thicknessRatioSum: thicknessRatioSum
  // });

  // FIXME: temp while i figure things out
  // - IF this is used, create slotSpace method
  _calculateMaxMapThickness() {
    const viewer = this.viewer;
    const savedZoomFactor = viewer.zoomFactor;
    // Default Map Width
    viewer._zoomFactor = 1;
    this.updateLayout(true);
    const defaultMapWidth =  this.bbOutsideOffset - this.bbInsideOffset;

    let defaultSlotTotalThickness = 0;

    const visibleTracks = this.tracks().filter( t =>  t.visible );
    for (let i = 0, tracksLength = visibleTracks.length; i < tracksLength; i++) {
      const track = visibleTracks[i];
      const slots = track.slots().filter( s => s.visible );
      if (slots.length > 0) {
        for (let j = 0, slotsLength = slots.length; j < slotsLength; j++) {
          const slot = slots[j];
          defaultSlotTotalThickness += slot.thickness;
        }
      }
    }

    // Max Map Width
    viewer._zoomFactor = viewer.maxZoomFactor;
    this.updateLayout(true);
    const computedMaxMapWidth =  this.bbOutsideOffset - this.bbInsideOffset;

    let computedSlotTotalThickness = 0;

    for (let i = 0, tracksLength = visibleTracks.length; i < tracksLength; i++) {
      const track = visibleTracks[i];
      const slots = track.slots().filter( s => s.visible );
      if (slots.length > 0) {
        for (let j = 0, slotsLength = slots.length; j < slotsLength; j++) {
          const slot = slots[j];
          computedSlotTotalThickness += slot.thickness;
        }
      }
    }

    // FIXME: temp
    this._maxMapThicknessZoomFactor = computedSlotTotalThickness / defaultSlotTotalThickness;

    // Restore
    viewer._zoomFactor = savedZoomFactor;

    // console.log(this._nonSlotSpace());
    // console.log(defaultMapWidth, computedMaxMapWidth, computedMaxMapWidth / defaultMapWidth);
    // console.log(defaultSlotTotalThickness, computedSlotTotalThickness, computedSlotTotalThickness / defaultSlotTotalThickness);
  }

  // FIXME: temp with above
  // adjustedBBOffsetFor(bbOffset) {
  //   const viewer = this.viewer;
  //   const backbone = viewer.backbone;
  //   const maxMapThicknessZoomFactor = this._maxMapThicknessZoomFactor;
  //   const zoomFactor = (viewer.zoomFactor > maxMapThicknessZoomFactor) ? maxMapThicknessZoomFactor : viewer.zoomFactor;
  //   return (bbOffset * zoomFactor) + (backbone.adjustedThickness - backbone.thickness);
  // }

  // Calculate centerOffset for the supplied mapOffset
  // - Positive (+ve) mapOffsets are the distance from the outer/top edge of the map.
  // - Negative (-ve) mapOffsets are the distance from the inner/bottom edge of the map.
  centerOffsetForMapOffset(mapOffset) {
    return mapOffset + ( (mapOffset >= 0) ? this.centerOutsideOffset : this.centerInsideOffset );
  }

  // Calculate centerOffset for the supplied bbOffsetPercent:
  // -    0: center of backbone
  // -  100: outside/top edge of map
  // - -100: inside/bottom edge of map
  centerOffsetForBBOffsetPercent(bbOffsetPercent) {
    const bbOffset = this.backbone.adjustedCenterOffset;
    if (bbOffsetPercent === 0) {
      return bbOffset;
    } else if (bbOffsetPercent > 0) {
      return bbOffset + (bbOffsetPercent / 100 * this.bbOutsideOffset);
    } else if (bbOffsetPercent < 0) {
      return bbOffset - (bbOffsetPercent / 100 * this.bbInsideOffset);
    }
  }


  tracks(term) {
    return this.viewer.tracks(term);
  }

  slots(term) {
    return this.viewer.slots(term);
  }

  visibleSlots(term) {
    return this.slots().filter( s => s.visible && s.track.visible ).get(term);
  }

  slotForCenterOffset(offset) {
    const slots = this.visibleSlots();
    let slot;
    for (let i = 0, len = slots.length; i < len; i++) {
      if (slots[i].containsCenterOffset(offset)) {
        slot = slots[i];
        break;
      }
    }
    return slot;
  }

  get slotLength() {
    return this._slotLength || 0;
  }

  get fastMaxFeatures() {
    return this._fastMaxFeatures;
  }

  get fastFeaturesPerSlot() {
    return this._fastFeaturesPerSlot;
  }

  /**
   * Get or set the max slot thickness.
   */
  get maxSlotThickness() {
    return this._maxSlotThickness;
  }

  set maxSlotThickness(value) {
    this._maxSlotThickness = Number(value);
    this._adjustProportions();
  }

  /**
   * Get or set the min slot thickness.
   */
  get minSlotThickness() {
    return this._minSlotThickness;
  }

  set minSlotThickness(value) {
    this._minSlotThickness = Number(value);
    this._adjustProportions();
  }

  /**
   * Get or set the initial map thickness as a proportion of a viewer dimension
   * (height for linear maps, minimum dimension for circular maps). The initial
   * map thickness is at a zoomFactor of 1.
   */
  get initialMapThicknessProportion() {
    return this._initialMapThicknessProportion;
  }

  set initialMapThicknessProportion(value) {
    this._initialMapThicknessProportion = Number(value);
    this._adjustProportions();
  }

  /**
   * Get or set the maximum map thickness as a proportion of a viewer dimension
   * (height for linear maps, minimum dimension for circular maps).
   */
  get maxMapThicknessProportion() {
    return this._maxMapThicknessProportion;
  }

  set maxMapThicknessProportion(value) {
    this._maxMapThicknessProportion = Number(value);
    this._adjustProportions();
  }

  // Draw everything but the slots and their features.
  // e.g. draws backbone, dividers, ruler, labels, progress
  drawMapWithoutSlots(fast) {
    const viewer = this.viewer;
    const backbone = viewer.backbone;
    const canvas = this.canvas;
    // let startTime = new Date().getTime();

    viewer.clear('map');
    viewer.clear('ui');
    // Note: we clear the foreground in the drawForeground method

    if (viewer.messenger.visible) {
      viewer.messenger.close();
    }

    // All Text should have base line top
    // FIXME: contexts
    // ctx.textBaseline = 'top';

    // Draw Backbone
    backbone.draw(fast);

    // Recalculate the slot offsets and thickness if the zoom level has changed
    this.updateLayout();

    // Divider rings
    viewer.dividers.draw();
    // Ruler
    const rulerOffsetAdjustment = viewer.dividers.track.adjustedThickness;
    viewer.ruler.draw(this.centerInsideOffset - rulerOffsetAdjustment, this.centerOutsideOffset + rulerOffsetAdjustment);
    // Labels
    if (viewer.annotation.visible) {
      viewer.annotation.draw(this.centerInsideOffset, this.centerOutsideOffset, fast);
    }

    // Draw foreground layer (centerLine, captions/legend on map)
    this.drawForeground();

    // Progess
    this.drawProgress();

    // Note: now done in Canvas
    // if (canvas._testDrawRange) {
    //   const ctx = canvas.context('canvas');
    //   ctx.strokeStyle = 'grey';
    //   ctx.rect(0, 0, canvas.width, canvas.height);
    //   ctx.stroke();
    // }

    // Slots timout
    this._slotIndex = 0;
    if (this._slotTimeoutID) {
      clearTimeout(this._slotTimeoutID);
      this._slotTimeoutID = undefined;
    }
  }

  drawFast() {
    const startTime = new Date().getTime();
    this.drawMapWithoutSlots(true);
    this.drawAllSlots(true);
    this.sequence.draw();
    // Debug
    if (this.viewer.debug) {
      this.viewer.debug.data.time.fastDraw = utils.elapsedTime(startTime);
      this.viewer.debug.draw();
    }
  }

  /**
   * Whether a full-quality canvas draw is still replacing its fast slot
   * preview.
   */
  get fullDrawInProgress() {
    return this._slotTimeoutID !== undefined;
  }

  drawFull() {
    this.drawMapWithoutSlots();
    this.drawAllSlots(true);
    this._drawFullStartTime = new Date().getTime();
    this.drawSlotWithTimeOut(this);
    this.sequence.draw();
  }

  drawExport() {
    this.drawMapWithoutSlots();
    this.drawAllSlots(false);
    this.sequence.draw();
  }

  draw(fast) {
    fast ? this.drawFast() : this.drawFull();
  }

  // Draw foreground layer (centerLine, map-based captions/legend)
  drawForeground() {
    const viewer = this.viewer;
    viewer.clear('foreground');
    // Draw center line for current bp
    viewer.centerLine.draw();
    // Captions positioned on the Map
    for (let i = 0, len = viewer._captions.length; i < len; i++) {
      if (viewer._captions[i].onMap) {
        viewer._captions[i].draw();
      }
    }
    // Legend positioned on the Map
    if (viewer.legend.position.onMap) {
      viewer.legend.draw();
    }
  }

  drawAllSlots(fast) {
    let track, slot;
    // for (let i = 0, trackLen = this._tracks.length; i < trackLen; i++) {
    //   track = this._tracks[i];
    const tracks = this.tracks();
    for (let i = 0, trackLen = tracks.length; i < trackLen; i++) {
      track = tracks[i];
      if (!track.visible) { continue; }
      for (let j = 0, slotLen = track._slots.length; j < slotLen; j++) {
        slot = track._slots[j];
        if (!slot.visible) { continue; }
        slot.draw(this.canvas, fast);
      }
    }
  }

  drawSlotWithTimeOut(layout) {
    const slots = layout.visibleSlots();
    const slot = slots[layout._slotIndex];
    if (!slot) { return; }

    slot.clear();
    // Redraw the Backbone if this is the first slot and the slot is 'along' the backbone
    if (layout._slotIndex === 0 && slot.position === 'along') {
      this.backbone.draw();
    }

    slot.draw(layout.canvas);
    layout._slotIndex++;
    if (layout._slotIndex < slots.length) {
      layout._slotTimeoutID = setTimeout(layout.drawSlotWithTimeOut, 0, layout);
    } else {
      layout._slotTimeoutID = undefined;
      if (layout.viewer.debug) {
        layout.viewer.debug.data.time.fullDraw = utils.elapsedTime(layout._drawFullStartTime);
        layout.viewer.debug.draw();
      }
      // if (typeof complete === 'function') { complete.call() }
    }
  }

  // position must be: 'inside' or 'outside'
  _updateLayoutFor(position = 'inside') {
    const viewer = this.viewer;
    const dividers = viewer.dividers;
    const direction = (position === 'outside') ? 1 : -1;
    let bbOffset = this.backbone.adjustedThickness / 2;
    // let bbOffset = 0;
    // Distance between slots
    const slotGap = (dividers.slot.adjustedSpacing * 2) + dividers.slot.adjustedThickness;
    const visibleTracks = this.tracks().filter( t =>  t.visible );
    for (let i = 0, tracksLength = visibleTracks.length; i < tracksLength; i++) {
      const track = visibleTracks[i];
      const slots = track.slots().filter( s => s.visible && s[position] );
      if (slots.length > 0) {
        bbOffset += dividers.track.adjustedSpacing;
        for (let j = 0, slotsLength = slots.length; j < slotsLength; j++) {
          const slot = slots[j];
          const slotThickness = this._calculateSlotThickness(slot.proportionOfMap);
          slot._thickness = slotThickness;

          if (i === 0 && slot.position === 'along') {
            bbOffset = 0;
          } else {
            bbOffset += (slotThickness / 2);
          }
          // bbOffset += (slotThickness / 2);

          slot._bbOffset = direction * bbOffset;

          bbOffset += (slotThickness / 2);
          if (j === (slotsLength - 1)) {
            // Last slot for track - Use track divider
            bbOffset += dividers.track.adjustedSpacing;
            dividers.addBbOffset(direction * (bbOffset + (dividers.track.adjustedThickness / 2)), 'track');
            bbOffset += dividers.track.adjustedThickness;
          } else {
            // More slots for track - Use slot divider
            dividers.addBbOffset(direction * (bbOffset + (slotGap / 2)), 'slot');
            bbOffset += slotGap;
          }
        }
      }
    }
    return direction * bbOffset;
  }

  /**
   * Updates the bbOffset and thickness of every slot, divider and ruler, only if the zoom level has changed
   * @private
   */
  updateLayout(force) {
    const viewer = this.viewer;
    if (!force && this._savedZoomFactor === viewer._zoomFactor) {
      return;
    } else {
      this._savedZoomFactor = viewer._zoomFactor;
    }
    viewer.dividers.clearBbOffsets();

    this._fastFeaturesPerSlot = this._fastMaxFeatures / this.visibleSlots().length;
    this._bbInsideOffset = this._updateLayoutFor('inside');
    this._bbOutsideOffset = this._updateLayoutFor('outside');
  }

  /**
   * Slot thickness is based on a proportion of the Map thickness.
   * As the viewer is zoomed the slot thickness increases until
   *  - The max map thickness is reached, or
   *  - The slot thickness is greater than the maximum allowed slot thickness
   *  @private
   */
  _calculateSlotThickness(proportionOfMap) {
    const viewer = this.viewer;

    // FIXME: should not be based on adjustedCenterOffset
    // const mapThickness = Math.min(viewer.backbone.adjustedCenterOffset, this.maxMapThickness());
    // TEMP
    // Maybe this should be based on slotSpace from adjust proportions.
    // Should slot space be saved
    // const minSize = this.maxMapThickness() / 6 * viewer.zoomFactor;
    // const minSize = this.testSlotSpace * viewer.zoomFactor;
    const minSize = this.initialWorkingSpace() * viewer.zoomFactor;
    const mapThickness = Math.min(minSize, this.maxMapThickness());

    const maxAllowedProportion = this.maxSlotThickness / mapThickness;
    const slotProportionStats = this.slotProportionStats;
    if (slotProportionStats.max > maxAllowedProportion) {
      if (slotProportionStats.min === slotProportionStats.max) {
        proportionOfMap = maxAllowedProportion;
      } else {
        // SCALE
        // Based on the min and max allowed proportionOf Radii allowed
        const minAllowedProportion = this.minSlotThickness / mapThickness;
        const minMaxRatio = slotProportionStats.max / slotProportionStats.min;
        const minProportionOfMap = maxAllowedProportion / minMaxRatio;
        const minTo = (minProportionOfMap < minAllowedProportion) ? minAllowedProportion : minProportionOfMap;
        proportionOfMap = utils.scaleValue(proportionOfMap,
          {min: slotProportionStats.min, max: slotProportionStats.max},
          {min: minTo, max: maxAllowedProportion});
      }
    }
    return proportionOfMap * mapThickness;
  }

  // When updating scales because the canvas has been resized, we want to
  // keep the map at the same position in the canvas.
  // Axis must be 'x' or 'y'
  // Used to initialize or resize the circle x/y or linear y scale
  _updateScaleForAxis(axis, dimension) {
    const scale = this.scale;
    // Default Fractions to center the map when the scales have not been defined yet
    let f1 = (axis === 'x') ? -0.5 : 0.5;
    let f2 = (axis === 'x') ? 0.5 : -0.5;
    // Save scale domains to keep tract of translation
    if (scale[axis]) {
      const origDomain = scale[axis].domain();
      const origDimension = Math.abs(origDomain[1] - origDomain[0]);
      f1 = origDomain[0] / origDimension;
      f2 = origDomain[1] / origDimension;
    }
    scale[axis] = d3.scaleLinear()
      .domain([dimension * f1, dimension * f2])
      .range([0, dimension]);
    // console.log(scale[axis].domain())
  }

  drawProgress() {
    this.canvas.clear('background');
    let track, slot, progress;
    const visibleTracks = this.tracks().filter( t =>  t.visible );
    for (let i = 0, trackLen = visibleTracks.length; i < trackLen; i++) {
      track = visibleTracks[i];
      progress = track.loadProgress;
      for (let j = 0, slotLen = track._slots.length; j < slotLen; j++) {
        slot = track._slots[j];
        slot.drawProgress(progress);
      }
    }
  }
  //
  // moveTrack(oldIndex, newIndex) {
  //   this._tracks.move(oldIndex, newIndex);
  //   this._adjustProportions();
  // }
  //
  // removeTrack(track) {
  //   this._tracks = this._tracks.remove(track);
  //   this._adjustProportions();
  // }
  //
  // toJSON() {
  //   const json = {
  //     minSlotThickness: this.minSlotThickness,
  //     maxSlotThickness: this.maxSlotThickness,
  //     tracks: []
  //   };
  //   this.tracks().each( (i, track) => {
  //     json.tracks.push(track.toJSON());
  //   });
  //   return json;
  // }


}

export default Layout;

