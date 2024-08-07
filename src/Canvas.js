//////////////////////////////////////////////////////////////////////////////
// Canvas
//////////////////////////////////////////////////////////////////////////////

import Color from './Color';
import utils from './Utils';
import * as d3 from 'd3';


/**
 * The canvas object controls the map layers and has methods for drawing and erasing on the layers.
 * Each layer is an HTML canvas element.
 *
 * <a name="layers"></a>
 * ### Layers
 *
 * Layer             | Description
 * ------------------|---------------
 * background        | for drawing behind the map
 * map               | main layer, where the map is drawn
 * foreground        | for drawing in front of the map (e.g. map-based captions/legend, centerLine)
 * canvas            | layer for drawing static components (e.g. canvas-based captions/legend)
 * debug             | layer to draw debug information
 * ui                | layer for capturing interactions
 */
class Canvas {


  /**
   * Create the Canvas object.
   * @param {Viewer} viewer - The viewer
   * @param {d3Element} container - D3 Element where canvas layers will be added
   * @param {Object} options - Possible properties: width [Default: 600], height [Default: 600]
   */
  constructor(viewer, container, options = {}) {
    this._viewer = viewer;
    this.width = utils.defaultFor(options.width, 600);
    this.height = utils.defaultFor(options.height, 600);

    // Create layers
    this.determinePixelRatio(container);
    this._layerNames = ['background', 'map', 'foreground', 'canvas', 'debug', 'ui'];
    this._layers = this.createLayers(container, this._layerNames, this._width, this._height);

    // This value is used to restrict the draw range for testing (see _testDrawRange)
    this._drawRange = 0.4;
  }

  /**
   * @member {Number} - Get the pixel ratio for the canvas.
   */
  get pixelRatio() {
    return this._pixelRatio;
  }

  /**
   * Determines the pixel ratio for the provided d3 element.
   * @param {d3Element} container - D3 Element
   * @private
   */
  determinePixelRatio(container) {
    const testNode = container.append('canvas')
      .style('position',  'absolute')
      .style('top',  0)
      .style('left',  0)
      .attr('width', this._width)
      .attr('height', this._height).node();
    // Check for canvas support
    if (testNode.getContext) {
      // Get pixel ratio and upscale canvas depending on screen resolution
      // http://www.html5rocks.com/en/tutorials/canvas/hidpi/
      this._pixelRatio = utils.getPixelRatio(testNode);
    } else {
      container.html('<h3>CGView requires Canvas, which is not supported by this browser.</h3>');
    }
    d3.select(testNode).remove();
  }

  /**
   * Creates a layer for each element in layerNames.
   * @param {d3Element} container - D3 Element
   * @param {Array} layerNames - Array of layer names
   * @param {Number} width - Width of each layer
   * @param {Number} height - Height of each layer
   * @param {Boolean} scaleLayer - Sclaes the layers basedon the pixel ratio [Default: true]
   * @private
   */
  createLayers(container, layerNames, width, height, scaleLayers = true) {
    const layers = {};

    for (let i = 0, len = layerNames.length; i < len; i++) {
      const layerName = layerNames[i];
      const zIndex = (i + 1) * 10;
      const node = container.append('canvas')
        .classed('cgv-layer', true)
        .classed(`cgv-layer-${layerName}`, true)
        .style('z-index',  zIndex)
        .attr('width', width)
        .attr('height', height).node();

      if (scaleLayers) {
        utils.scaleResolution(node, this.pixelRatio);
      }

      // Set viewer context
      const ctx = node.getContext('2d');

      // Consider this to help make linear horizontal lines cleaner
      // ctx.translate(0.5, 0.5);

      layers[layerName] = { ctx: ctx, node: node };
    }
    return layers;
  }

  /**
   * Resize all layers to a new width and height.
   * @param {Number} width - New width for each layer
   * @param {Number} height - New height for each layer
   */
  resize(width, height) {
    this.width = width;
    this.height = height;
    for (const layerName of this.layerNames) {
      const layerNode = this.layers(layerName).node;
      // Note, here the width/height will take into account the pixelRatio
      layerNode.width = this.width;
      layerNode.height = this.height;
      // Note, here the width/height will be the same as viewer (no pixel ratio)
      layerNode.style.width = `${width}px`;
      layerNode.style.height = `${height}px`;

      utils.scaleResolution(layerNode, this.pixelRatio);
    }
    this.layout.updateScales();
  }

  /**
   * @member {Viewer} - Get the viewer.
   */
  get viewer() {
    return this._viewer;
  }

  /**
   * @member {Layout} - Get the layout.
   */
  get layout() {
    return this.viewer.layout;
  }

  /**
   * @member {Array} - Get the names of the layers.
   */
  get layerNames() {
    return this._layerNames;
  }

  /**
   * @member {Sequence} - Get the sequence.
   */
  get sequence() {
    return this.viewer.sequence;
  }

  /**
   * @member {Number} - Get the width of the canvas. Changing this value will not resize the layers. Use [resize](#resize) instead.
   */
  get width() {
    return this._width;
  }

  set width(width) {
    this._width = width;
  }

  /**
   * @member {Number} - Get the width of the canvas. Changing this value will not resize the layers. Use [resize](#resize) instead.
   */
  get height() {
    return this._height;
  }

  set height(height) {
    this._height = height;
  }

  /**
   * @member {String} - Get or set the cursor style for the mouse when it's on the canvas.
   */
  get cursor() {
    return d3.select(this.node('ui')).style('cursor');
  }

  set cursor(value) {
    d3.select(this.node('ui')).style('cursor', value);
  }

  /**
   * Clear the viewer canvas.
   * @param {String} layerName - Name of layer to clear [Default: 'map']. A special value of 'all' will clear all the layers.
   */
  clear(layerName = 'map') {
    if (layerName === 'all') {
      for (let i = 0, len = this.layerNames.length; i < len; i++) {
        this.clear(this.layerNames[i]);
      }
    } else if (layerName === 'background') {
      const ctx = this.context('background');
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.fillStyle = this.viewer.settings.backgroundColor.rgbaString;
      ctx.fillRect(0, 0, this.width, this.height);
    } else {
      // this.context(layerName).clearRect(0, 0, this.width, this.height);
      if (this._testDrawRange) {
        this.context(layerName).clearRect(0, 0, this.width / this._drawRange, this.height / this._drawRange);
      } else {
        this.context(layerName).clearRect(0, 0, this.width, this.height);
      }
    }
  }

  /**
   * Draws an arc or arrow on the map.
   * @param {String} layer - Name of layer to draw element on
   * @param {Number} start - Start position (bp) of element
   * @param {Number} stop - Stop position (bp) of element
   * @param {Number} centerOffset - Distance form center of map to draw element
   * @param {Color} color - A string describing the color. {@link Color} for details.
   * @param {Number} width - Width of element
   * @param {String} decoration - How the element should be drawn. Values: 'arc', 'clockwise-arrow', 'counterclockwise-arrow', 'none'
   * @param {Boolean} showShading - Should the elment be drawn with shading [Default: value from settings [showShading](Settings.html#showShading)]
   * @private
   */
  // Decoration: arc, clockwise-arrow, counterclockwise-arrow, none
  //
  // - clockwise-arrow (drawn clockwise from arcStartBp; direction = 1):
  //
  //       arcStartBp (feature start)      arcStopBp
  //              |                        |
  //              --------------------------  arrowTipBp
  //              |                          \|
  //              |                           x - arrowTipPt (feature stop)
  //              |                          /
  //              -------------------------x
  //                                       |
  //                                       innerArcStartPt
  //
  // - counterclockwise-arrow (drawn counterclockwise from arcStartBp; direction = -1):
  //
  //                     arcStopBp                      arcStartBp (feature stop)
  //                            |                        |
  //                arrowTipBp   -------------------------
  //                         | /                         |
  //            arrowTipPt - x                           |
  //       (feature start)    \                          |
  //                            x-------------------------
  //                            |
  //                            innerArcStartPt
  //
  // If the zoomFactor gets too large, the arc drawing becomes unstable.
  // (ie the arc wiggle in the map as zooming)
  // So when the zoomFactor is large, switch to drawing lines ([path](#path) handles this).
  drawElement(layer, start, stop, centerOffset, color = '#000000', width = 1, decoration = 'arc', showShading, minArcLength) {
    if (decoration === 'none') { return; }
    const ctx = this.context(layer);
    const settings = this.viewer.settings;
    const shadowFraction = 0.10;
    const shadowColorDiff = 0.15;
    ctx.lineCap = 'butt';
    // ctx.lineJoin = 'round';
    showShading = (showShading === undefined) ? settings.showShading : showShading;

    // When drawing elements (arcs or arrows), the element should be offset by
    // half a bp on each side. This will allow single base features to be
    // drawn. It also reduces ambiguity for where features start/stop.
    // For example, if the start and stop is 10, the feature will be drwan from
    // 9.5 to 10.5.
    start -= 0.5;
    stop += 0.5;

    if (decoration === 'arc') {

      // Adjust feature start and stop based on minimum arc length.
      // Minimum arc length refers to the minimum size (in pixels) an arc will be drawn.
      // At some scales, small features will have an arc length of a fraction
      // of a pixel. In these cases, the arcs are hard to see.
      // A minArcLength of 0 means no adjustments will be made.
      // const minArcLengthPixels = settings.minArcLength;
      const minArcLengthPixels = utils.defaultFor(minArcLength, this.viewer.legend.defaultMinArcLength);
      const featureLengthBp = this.sequence.lengthOfRange(start, stop);
      const minArcLengthBp = minArcLengthPixels / this.pixelsPerBp(centerOffset);
      if ( featureLengthBp < minArcLengthBp ) {
        const middleBP = start + ( featureLengthBp / 2 );
        start = middleBP - (minArcLengthBp / 2);
        stop = middleBP + (minArcLengthBp / 2);
      }

      if (showShading) {
        const shadowWidth = width * shadowFraction;
        // Main Arc
        const mainWidth = width - (2 * shadowWidth);
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = mainWidth;
        this.path(layer, centerOffset, start, stop);
        ctx.stroke();

        const shadowOffsetDiff = (mainWidth / 2) + (shadowWidth / 2);
        ctx.lineWidth = shadowWidth;
        // Highlight
        ctx.beginPath();
        ctx.strokeStyle = new Color(color).lighten(shadowColorDiff).rgbaString;
        this.path(layer, centerOffset + shadowOffsetDiff, start, stop);
        ctx.stroke();

        // Shadow
        ctx.beginPath();
        ctx.strokeStyle = new Color(color).darken(shadowColorDiff).rgbaString;
        this.path(layer, centerOffset - shadowOffsetDiff, start, stop);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        this.path(layer, centerOffset, start, stop);
        ctx.stroke();
      }
    }

    // Looks like we're drawing an arrow
    if (decoration === 'clockwise-arrow' || decoration === 'counterclockwise-arrow') {
      // Determine Arrowhead length
      // Using width which changes according zoom factor upto a point
      const arrowHeadLengthPixels = width * settings.arrowHeadLength;
      const arrowHeadLengthBp = arrowHeadLengthPixels / this.pixelsPerBp(centerOffset);

      // If arrow head length is longer than feature length, adjust start and stop
      const featureLength = this.sequence.lengthOfRange(start, stop);
      if ( featureLength < arrowHeadLengthBp ) {
        const middleBP = start + ( featureLength / 2 );
        // Originally, the feature was adjusted to be the arrow head length.
        // However, this caused an issue with SVG drawing because the arc part of
        // the arrow would essentially be 0 bp. Drawing an arc of length 0 caused weird artifacts.
        // So here we add an additional 0.1 bp to the adjusted length.
        const adjustedFeatureHalfLength = (arrowHeadLengthBp + 0.1) / 2;
        start = middleBP - adjustedFeatureHalfLength;
        stop = middleBP + adjustedFeatureHalfLength;
      }

      // Set up drawing direction
      const arcStartBp = (decoration === 'clockwise-arrow') ? start : stop;
      const arrowTipBp = (decoration === 'clockwise-arrow') ? stop : start;
      const direction = (decoration === 'clockwise-arrow') ? 1 : -1;

      // Calculate important points
      const halfWidth = width / 2;
      const arcStopBp = arrowTipBp - (direction * arrowHeadLengthBp);
      const arrowTipPt = this.pointForBp(arrowTipBp, centerOffset);
      const innerArcStartPt = this.pointForBp(arcStopBp, centerOffset - halfWidth);

      if (showShading) {
        const halfMainWidth =  width * (0.5 - shadowFraction);
        const shadowPt = this.pointForBp(arcStopBp, centerOffset - halfMainWidth);

        // Main Arrow
        ctx.beginPath();
        ctx.fillStyle = color;
        this.path(layer, centerOffset + halfMainWidth, arcStartBp, arcStopBp, direction === -1);
        ctx.lineTo(arrowTipPt.x, arrowTipPt.y);
        ctx.lineTo(shadowPt.x, shadowPt.y);
        this.path(layer, centerOffset - halfMainWidth, arcStopBp, arcStartBp, direction === 1, 'noMoveTo');
        ctx.closePath();
        ctx.fill();

        // Highlight
        const highlightPt = this.pointForBp(arcStopBp, centerOffset + halfMainWidth);
        ctx.beginPath();
        ctx.fillStyle = new Color(color).lighten(shadowColorDiff).rgbaString;
        this.path(layer, centerOffset + halfWidth, arcStartBp, arcStopBp, direction === -1);
        ctx.lineTo(arrowTipPt.x, arrowTipPt.y);
        ctx.lineTo(highlightPt.x, highlightPt.y);
        this.path(layer, centerOffset + halfMainWidth, arcStopBp, arcStartBp, direction === 1, 'noMoveTo');
        ctx.closePath();
        ctx.fill();

        // Shadow
        ctx.beginPath();
        ctx.fillStyle = new Color(color).darken(shadowColorDiff).rgbaString;
        this.path(layer, centerOffset - halfWidth, arcStartBp, arcStopBp, direction === -1);
        ctx.lineTo(arrowTipPt.x, arrowTipPt.y);
        ctx.lineTo(shadowPt.x, shadowPt.y);
        this.path(layer, centerOffset - halfMainWidth, arcStopBp, arcStartBp, direction === 1, 'noMoveTo');
        ctx.closePath();
        ctx.fill();
      } else {
        // Draw arc with arrow head
        ctx.beginPath();
        ctx.fillStyle = color;
        this.path(layer, centerOffset + halfWidth, arcStartBp, arcStopBp, direction === -1);
        ctx.lineTo(arrowTipPt.x, arrowTipPt.y);
        ctx.lineTo(innerArcStartPt.x, innerArcStartPt.y);
        this.path(layer, centerOffset - halfWidth, arcStopBp, arcStartBp, direction === 1, 'noMoveTo');
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  /**
   * This method adds a path to the canvas and uses the underlying Layout for the actual drawing.
   * For circular layouts the path is usually an arc, however, if the zoomFactor is very large,
   * the arc is added as a straight line.
   * @param {String} layer - Name of layer to draw the path on
   * @param {Number} centerOffset - Distance form center of map to draw path
   * @param {Number} startBp - Start position (bp) of path
   * @param {Number} stopBp - Stop position (bp) of path
   * @param {Boolean} anticlockwise - Should the elment be drawn in an anticlockwise direction
   * @param {String} startType - How the path should be started. Allowed values:
   * <br /><br />
   *  - moveTo:  *moveTo* start; *lineTo* stop
   *  - lineTo: *lineTo* start; *lineTo* stop
   *  - noMoveTo:  ingore start; *lineTo* stop
   * @private
   */
  // FIXME: try calling layout.path with object parameters and compare speed
  // e.g. path({layer: 'map', offset = radius, etc})
  path(layer, centerOffset, startBp, stopBp, anticlockwise = false, startType = 'moveTo') {
    this.layout.path(layer, centerOffset, startBp, stopBp, anticlockwise, startType);
  }

  /**
   * Draw a line radiating from the map at a particular basepair position.
   * // TODO: change arguments to an object {}
   * @param {String} layer - Name of layer to draw the path on
   * @param {Number} bp - Basepair position of the line
   * @param {Number} centerOffset - Distance from center of map to start the line
   * @param {Number} length - Length of line
   * @param {Color} color - A string describing the color. {@link Color} for details.
   * @param {String} cap - The stroke linecap for the starting and ending points for the line. Values: 'butt', 'square', 'round'
   * @param {Array} dashes - The dash pattern for the line [Default: []]
   * @private
   */
  radiantLine(layer, bp, centerOffset, length, lineWidth = 1, color = 'black', cap = 'butt', dashes = []) {
    const innerPt = this.pointForBp(bp, centerOffset);
    const outerPt = this.pointForBp(bp, centerOffset + length);
    const ctx = this.context(layer);

    ctx.beginPath();
    ctx.moveTo(innerPt.x, innerPt.y);
    ctx.lineTo(outerPt.x, outerPt.y);
    ctx.strokeStyle = color;

    ctx.lineCap = cap;
    ctx.setLineDash(dashes);

    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }


  /**
   * Alias for Layout [pointForBp](Layout.html#pointForBp)
   * @private
   */
  pointForBp(bp, centerOffset) {
    return this.layout.pointForBp(bp, centerOffset);
  }

  /**
   * Returns the bp for the current mouse position on the canvas
   * @private
   */
  bpForMouse() {
    // const pos = d3.mouse(this.node('ui'));
    // return this.bpForPoint({x: pos[0], y: pos[1]});
    const event = this.viewer.mouse
    if (event) {
      return this.bpForPoint({x: event.canvasX, y: event.canvasY});
    }
  }

  /**
   * Returns the bp for the center of the canvas.
   * @private
   */
  bpForCanvasCenter(options={}) {
    return this.bpForPoint({x: this.width / 2, y: this.height / 2}, options);
  }

  /**
   * Alias for Layout [bpForPoint](Layout.html#bpForPoint)
   * FIXME: this should be removed and everywhere should call layout method
   * @param {Point} - Point object with x and y properties
   * @param {Object} options - Options for the bpForPoint method (use float: true to get fractional bp)
   * @private
   */
  bpForPoint(point, options={}) {
    return this.layout.bpForPoint(point, options);
  }


  /**
   * Alias for Layout [visibleRangeForCenterOffset](Layout.html#visibleRangeForCenterOffset)
   * @private
   */
  visibleRangeForCenterOffset(centerOffset, margin = 0) {
    return this.layout.visibleRangeForCenterOffset(centerOffset, margin);
  }

  /**
   * At the current zoom level, how many pixels are there per basepair.
   * @param {Number} centerOffset - Distance from map center to calculate. This
   * makes no difference for linear maps.
   * @private
   */
  pixelsPerBp(centerOffset = this.viewer.backbone.adjustedCenterOffset) {
    return this.layout.pixelsPerBp(centerOffset);
  }

  /**
   * Returns the layer with the specified name (defaults to map layer)
   * @param {String} layer - Name of layer to return
   * @private
   */
  layers(layer='map') {
    if (this._layerNames.includes(layer)) {
      return this._layers[layer];
    } else {
      console.error('Returning map layer by default');
      return this._layers.map;
    }
  }

  /**
   * Returns the context for the specified layer (defaults to map layer)
   * @param {String} layer - Name of layer to return context
   * @private
   */
  context(layer) {
    if (this._layerNames.includes(layer)) {
      return this.layers(layer).ctx;
    } else {
      console.error('Returning map layer by default');
      return this.layers('map').ctx;
    }
  }

  /**
   * Return the node for the specified layer (defaults to map layer)
   * @param {String} layer - Name of layer to return node element
   * @private
   */
  node(layer) {
    if (this._layerNames.includes(layer)) {
      return this.layers(layer).node;
    } else {
      console.error('Returning map layer by default');
      return this.layers('map').node;
    }
  }

  /**
   * This test method reduces the canvas width and height so
   * you can see how the features are reduced (not drawn) as
   * you move the map out of the visible range.
   * @member {Boolean}
   * @private
   */
  get _testDrawRange() {
    return this.__testDrawRange;
  }

  set _testDrawRange(value) {
    this.__testDrawRange = value;
    if (value) {
      // Change canvas dimensions
      this.width = this.width * this._drawRange;
      this.height = this.height * this._drawRange;
      // Draw Rect around test area
      const ctx = this.context('canvas');
      ctx.strokeStyle = 'grey';
      ctx.rect(0, 0, this.width, this.height);
      ctx.stroke();
      // ctx.translate(100, 100);
    } else {
      // Return canvas dimensions to normal
      this.width = this.width / this._drawRange;
      this.height = this.height / this._drawRange;
      // Clear rect around test area
      const ctx = this.context('canvas');
      ctx.clearRect(0, 0, this.width, this.height);
    }
    this.viewer.drawFull();
  }


}

export default Canvas;


