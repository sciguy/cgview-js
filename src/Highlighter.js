//////////////////////////////////////////////////////////////////////////////
// Highlighter
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

import CGObject from './CGObject';
import utils from './Utils';

// FIXME: There are 2 clasess here

/**
 * The Highlighter object controls highlighting and popovers of features,
 * plots and other elements on the Viewer when the mouse hovers over them.
 *
 * <a name="attributes"></a>
 * ### Attributes
 *
 *  Option                        | Default                    | Description
 *  ------------------------------|----------------------------|--------------------------
 *  [feature](#feature)           | {@link HighlighterElement} | Describes the highlightling options for features
 *  [plot](#plot)                 | {@link HighlighterElement} | Describes the highlightling options for plots
 *  [contig](#plot)               | {@link HighlighterElement} | Describes the highlightling options for contigs
 *  [backbone](#plot)             | {@link HighlighterElement} | Describes the highlightling options for the backbone
 *  [showMetaData](#showMetaData) | true                       | Should meta data be shown in popovers
 *
 * @extends CGObject
 */
class Highlighter extends CGObject {

  /**
   * Create a Highlighter
   * @param {Viewer} viewer - The viewer
   * @param {Object} options - [Attributes](#attributes) used to create the highlighter.
   */
  constructor(viewer, options = {}, meta = {}) {
    super(viewer, options, meta);
    this._viewer = viewer;
    this.showMetaData = utils.defaultFor(options.showMetaData, true);
    // this.popoverBox = viewer._container.append('div').attr('class', 'cgv-highlighter-popover-box').style('visibility', 'hidden');
    this.popoverBox = viewer._wrapper.append('div').attr('class', 'cgv-highlighter-popover-box').style('visibility', 'hidden');
    this._feature = new HighlighterElement('feature', options.feature);
    this._plot = new HighlighterElement('plot', options.plot);
    this._contig = new HighlighterElement('contig', options.contig);
    this._backbone = new HighlighterElement('backbone', options.backbone);
    this.initializeEvents();

    // Set up position constants (Distance from mouse pointer to top-left of popup)
    this._offsetLeft = 8;
    this._offsetTop = -18;
  }

  /**
   * @member {Viewer} - Get the viewer.
   */
  get viewer() {
    return this._viewer;
  }

  /**
   * @member {HighlighterElement} - Get the feature HighlighterElement
   */
  get feature() {
    return this._feature;
  }

  /**
   * @member {HighlighterElement} - Get the plot HighlighterElement
   */
  get plot() {
    return this._plot;
  }

  /**
   * @member {HighlighterElement} - Get the contig HighlighterElement
   */
  get contig() {
    return this._contig;
  }

  /**
   * @member {HighlighterElement} - Get the backbone HighlighterElement
   */
  get backbone() {
    return this._backbone;
  }

  position(e) {
    const originX = e.canvasX + this._offsetLeft;
    const originY = e.canvasY + this._offsetTop;
    return { x: originX,  y: originY};
  }

  initializeEvents() {
    this.viewer.off('.cgv-highlighter');
    this.viewer.on('mousemove.cgv-highlighter', (e) => {
      this.mouseOver(e);
      // if (e.feature) {
      //   this.mouseOver('feature', e);
      // } else if (e.plot) {
      //   this.mouseOver('plot', e);
      // } else {
      //   this.hidePopoverBox();
      // }
    });
  }

  // mouseOver(type, e) {
  mouseOver(e) {
    const type = e.elementType;
    if (!type || !this[type]) {
      this.hidePopoverBox();
      return;
    }
    if (this[type].highlighting) {
      this[`highlight${utils.capitalize(type)}`](e);
    }
    if (this[type].popovers && this.visible) {
      const position = this.position(e);
      const html = (this[type].popoverContents && this[type].popoverContents(e)) || this[`${type}PopoverContentsDefault`](e);
      this.showPopoverBox({position: position, html: html});
    } else {
      this.hidePopoverBox();
    }
  }

  static getTrackDiv(e) {
    let trackDiv = '';
    if (e.slot) {
      const track = e.slot.track;
      let direction = '';
      if (track.type === 'feature' && track.separateFeaturesBy !== 'none') {
        direction = e.slot.isDirect() ? '(+)' : '(-)';
      }
      trackDiv = `<div class='track-data'>Track: ${track.name} ${direction}</div>`;
    }
    return trackDiv;
  }

  static getPositionDiv(e) {
    const bp = utils.commaNumber(e.bp);
    let div = `<div class='track-data'>Map: ${bp} bp</div>`;
    if (e.elementType === 'contig') {
      const contig = e.element;
      const contigBp = utils.commaNumber(e.bp - contig.lengthOffset);
      div = `<div class='track-data'>Contig: ${contigBp} bp</div>` + div;
    }
    return div;
  }

  static getMetaDivs(metaData) {
    if (!metaData) { return ''; }
    let metaDivs = '';
    const keys = Object.keys(metaData);
    // if (this.showMetaData && keys.length > 0) {
    if (keys.length > 0) {
      metaDivs = keys.map( k => `<div class='meta-data'><span class='meta-data-key'>${k}</span>: <span class='meta-data-value'>${metaData[k]}</span></div>`).join('');
      metaDivs = `<div class='meta-data-container'>${metaDivs}</div>`;
    }
    return metaDivs;
  }

  featurePopoverContentsDefault(e) {
    const feature = e.element;
    // return `<div style='margin: 0 5px; font-size: 14px'>${feature.type}: ${feature.name}</div>`;
    const fullLength = feature.length !== feature.fullLength ? `(${utils.commaNumber(feature.fullLength)} bp)` : '';
    return (`
      <div style='margin: 0 5px; font-size: 14px'>
        <div>${feature.type}: ${feature.name}<div>
        <div class='track-data'>Length: ${utils.commaNumber(feature.length)} bp ${fullLength}</div>
        ${Highlighter.getMetaDivs(feature.qualifiers)}
        ${this.showMetaData && Highlighter.getMetaDivs(feature.meta)}
        ${Highlighter.getTrackDiv(e)}
      </div>
    `);
  }

  plotPopoverContentsDefault(e) {
    const plot = e.element;
    const score = plot.scoreForPosition(e.bp);
    return (`
      <div style='margin: 0 5px; font-size: 14px'>
        <div>Score: ${score.toFixed(2)}</div>
        ${Highlighter.getTrackDiv(e)}
      </div>
    `);
  }

  backbonePopoverContentsDefault(e) {
    const length = utils.commaNumber(this.sequence.length);
    const contig = this.sequence.contigs()[0];
    const contigMeta = contig.meta || {};
    // return `<div style='margin: 0 5px; font-size: 14px'>Backbone: ${length} bp</div>`;
    return (`
      <div style='margin: 0 5px; font-size: 14px'>
        <div>Backbone [${length} bp]: ${contig?.name}</div>
        ${Highlighter.getPositionDiv(e)}
        ${this.showMetaData && Highlighter.getMetaDivs(this.viewer.backbone.meta)}
        ${this.showMetaData && Highlighter.getMetaDivs(contigMeta)}
      </div>
    `);
  }

  contigPopoverContentsDefault(e) {
    const contig = e.element;
    const length = utils.commaNumber(contig.length);
    // return `<div style='margin: 0 5px; font-size: 14px'>Contig ${contig.index}/${this.sequence.contigs().length} [${length} bp]: ${contig.name}</div>`;
    return (`
      <div style='margin: 0 5px; font-size: 14px'>
        <div>Contig ${contig.index}/${this.sequence.contigs().length} [${length} bp]: ${contig.name}</div>
        ${Highlighter.getPositionDiv(e)}
        ${this.showMetaData && Highlighter.getMetaDivs(contig.meta)}
      </div>
    `);
  }

  highlightFeature(e) {
    e.element.highlight(e.slot);
  }

  highlightPlot(e) {
    const viewer = this.viewer;
    const plot = e.element;
    const score = plot.scoreForPosition(e.bp);
    if (score) {
      const startIndex = utils.indexOfValue(plot.positions, e.bp, false);
      const start = plot.positions[startIndex];
      const stop = plot.positions[startIndex + 1] || viewer.sequence.length;
      // const baselineCenterOffset = e.slot.centerOffset - (e.slot.thickness / 2) + (e.slot.thickness * plot.baseline);
      // const scoredCenterOffset = baselineCenterOffset + ((score - plot.baseline) * e.slot.thickness);
      const baselineFactor = (plot.baseline - plot.axisMin) / (plot.axisMax - plot.axisMin);
      const baselineCenterOffset = e.slot.centerOffset - (e.slot.thickness / 2) + (e.slot.thickness * baselineFactor);
      const scoreFactor = (score - plot.baseline) / (plot.axisMax - plot.axisMin);
      const scoredCenterOffset = baselineCenterOffset + (scoreFactor * e.slot.thickness);
      const thickness = Math.abs(baselineCenterOffset - scoredCenterOffset);
      const centerOffset = Math.min(baselineCenterOffset, scoredCenterOffset) + (thickness / 2);
      const color = (score >= plot.baseline) ? plot.colorPositive.copy() : plot.colorNegative.copy();
      color.highlight();

      viewer.canvas.drawElement('ui', start, stop, centerOffset, color.rgbaString, thickness);
    }
  }

  highlightBackbone(e) {
    // e.element.highlight(e.slot);
  }

  highlightContig(e) {
    // e.element.highlight(e.slot);
  }

  hidePopoverBox() {
    this.popoverBox.style('visibility', 'hidden');
  }

  showPopoverBox(options = {}) {
    if (options.html) {
      this.popoverBox.html(options.html);
    }
    if (options.position) {
      this.popoverBox
        .style('left', `${options.position.x}px`)
        .style('top', `${options.position.y}px`);
    }
    this.popoverBox.style('visibility', 'visible');
  }

  toJSON() {
    return {
      visible: this.visible
    };
  }

}


//////////////////////////////////////////////////////////////////////////////
// Highlighter Element
//////////////////////////////////////////////////////////////////////////////
/**
 * A HighlighterElement indicates whether highlighting and popovers should appear.
 *
 * <a name="attributes"></a>
 * ### Attributes
 *
 *  Option                              | Default     | Description
 *  ------------------------------------|-------------|-----------------------------------
 *  [highlighting](#highlighting)       | true        | Highlight a element when the mouse is over it
 *  [popovers](#popovers)               | true        | Show a popover for the element when the mouse is over it
 *  [popoverContents](#popoverContents) | undefined   | Function to create html for the popover
 *
 */
class HighlighterElement {

  /**
   * Create a HighlighterElement
   * @param {String} type - The element type: 'feature', 'plot', 'contig', 'backbone'.
   * @param {Object} options - [Attributes](#attributes) used to create the highlighter element.
   */
  constructor(type, options = {}) {
    this.type = type;
    this.highlighting = utils.defaultFor(options.highlighting, true);
    this.popovers = utils.defaultFor(options.popovers, true);
    this.popoverContents = options.popoverContents;
  }

  /**
   * @member {String} - Get or set the type (e.g. 'feature', 'plot', 'contig', 'backbone')
   */
  get type() {
    return this._type;
  }

  set type(value) {
    this._type = value;
  }

  /**
   * @member {Boolean} - Get or set whether highlighting should occur
   */
  get highlighting() {
    return this._highlighting;
  }

  set highlighting(value) {
    this._highlighting = value;
  }

  /**
   * @member {Boolean} - Get or set whether popovers should occur
   */
  get popover() {
    return this._popover;
  }

  set popover(value) {
    this._popover = value;
  }

  /**
   * @member {Function} - Get or set the function to call to produce HTML for the popover.
   * The provided function will be called with one argument: an [event-like object](EventMonitor.html).
   */
  get popoverContents() {
    return this._popoverContents;
  }

  set popoverContents(value) {
    this._popoverContents = value;
  }

}

export { Highlighter, HighlighterElement };


