//////////////////////////////////////////////////////////////////////////////
// Annotation
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
import LabelPlacementDefault from './LabelPlacementDefault';
import LabelPlacementAngled from './LabelPlacementAngled';
import Font from './Font';
import Color from './Color';
import NCList from './NCList';
import Rect from './Rect';
import utils from './Utils';

/**
 * Annotation controls the drawing and layout of features labels
 *
 * ### Action and Events
 *
 * Action                                    | Viewer Method                        | Annotation Method   | Event
 * ------------------------------------------|--------------------------------------|---------------------|-----
 * [Update](../docs.html#s.updating-records) | -                                    | [update()](#update) | annotation-update
 * [Read](../docs.html#s.reading-records)    | [annotation](Viewer.html#annotation) | -                   | -
 *
 * <a name="attributes"></a>
 * ### Attributes
 *
 * Attribute                        | Type      | Description
 * ---------------------------------|-----------|------------
 * [font](#font)                    | String    | A string describing the font [Default: 'monospace, plain, 12']. See {@link Font} for details.
 * [color](#color)                  | String   | A string describing the color [Default: undefined]. If the color is undefined, the legend color for the feature will be used. See {@link Color} for details.
 * [onlyDrawFavorites](#onlyDrawFavorites) | Boolean   | Only draw labels for features that are favorited [Default: false]
 * [labelPlacement](#labelPlacement) | String   | The label placement method for positioning labels. Choices: 'default', 'angled' [Default: 'default']
 * [visible](CGObject.html#visible) | Boolean   | Labels are visible [Default: true]
 * [meta](CGObject.html#meta)       | Object    | [Meta data](tutorial-meta.html) for Annotation
 *
 * ### Examples
 * ```js
 * // Only draw labels for features that have been marked as a favorite
 * cgv.annotation.update({
 *   onlyDrawFavorites: true
 * });
 *
 * // Changing the label placement from the default to angled (for both fast and full draw)
 * cgv.annotation.labelPlacement = 'angled'
 *
 * // Changing the label placement so that fast draw uses the default labels and full draw uses the angled labels
 * cgv.annotation.labelPlacementFast = 'default'
 * cgv.annotation.labelPlacementFull = 'angled'
 * ```
 *
 * @extends CGObject
 */
class Annotation extends CGObject {

  /**
   * Create the annotation.
   * @param {Viewer} viewer - The viewer
   * @param {Object} options - [Attributes](#attributes) used to create the annotation
   * @param {Object} [meta] - User-defined [Meta data](../tutorials/details-meta-data.html) to add to the annotation.
   */
  constructor(viewer, options = {}, meta = {}) {
    super(viewer, options, meta);
    this._labels = new CGArray();
    this.font = utils.defaultFor(options.font, 'monospace, plain, 12');
    this.labelLineLength = utils.defaultFor(options.labelLineLength, 20);
    this.priorityMax = utils.defaultFor(options.priorityMax, 50);
    this._labelLineMarginInner = 10;
    this._labelLineMarginOuter = 5; // NOT REALLY IMPLEMENTED YET
    this._labelLineWidth = 1;
    this.refresh();
    this._visibleLabels = new CGArray();
    this.color = options.color;
    this.lineCap = 'round';
    // this.lineCap = 'butt';
    this.onlyDrawFavorites = utils.defaultFor(options.onlyDrawFavorites, false);

    this.labelPlacement = utils.defaultFor(options.labelPlacement, 'default');
    // this.labelPlacementFast = 'default';
    // this.labelPlacementFull = 'angled'

    this.viewer.trigger('annotation-update', { attributes: this.toJSON({includeDefaults: true}) });

    // this._debug = true;
  }

  /**
   * Return the class name as a string.
   * @return {String} - 'Annotation'
   */
  toString() {
    return 'Annotation';
  }

  /**
   * @member {Color} - Get or set the label color. When setting the color, a
   * string representing the color or a {@link Color} object can be used. For
   * details see {@link Color}.
   */
  get color() {
    return this._color;
  }

  set color(value) {
    if (value === undefined || value.toString() === 'Color') {
      this._color = value;
    } else {
      this._color = new Color(value);
    }
  }

  /**
   * @member {Number} - Get or set the label line length.
   */
  get labelLineLength() {
    return this._labelLineLength;
  }

  set labelLineLength(value) {
    this._labelLineLength = value;
  }

  /**
   * @member {Number} - Get or set the number of priority labels that will be
   * drawn for sure. If they overlap the label will be moved until they no
   * longer overlap. Priority is defined as features that are marked as a
   * "favorite". After favorites, features are sorted by size. For example, if
   * priorityMax is 50 and there are 10 "favorite" features. The favorites will
   * be drawn and then the 40 largest features will be drawn.
   */
  get priorityMax() {
    return this._priorityMax;
  }

  set priorityMax(value) {
    this._priorityMax = value;
  }

  /**
   * @member {Font} - Get or set the font. When setting the font, a string
   * representing the font or a {@link Font} object can be used. For details
   * see {@link Font}.
   */
  get font() {
    return this._font;
  }

  set font(value) {
    if (value.toString() === 'Font') {
      this._font = value;
    } else {
      this._font = new Font(value);
    }
    this.refreshLabelWidths();
    // FIXME: can we use update to do this??
    this._font.on('change', () => this.refreshLabelWidths());
  }

  /**
   * @member {Number} - The number of labels in the set.
   */
  get length() {
    return this._labels.length;
  }

  /**
   * @member {LabelPlacement} - Set the label placement instance for both fast and full drawing.
   * Value can be one of the following: 'default', 'angled', or a custom LabelPlacement class.
   */
  set labelPlacement(value) {
    const labelPlacement = this._initialializeLabelPlacement(value);
    this._labelPlacementFast = labelPlacement;
    this._labelPlacementFull = labelPlacement;
  }

  /**
   * @member {LabelPlacement} - Get or set the label placement instance for fast drawing.
   * Values for setting can be one of the following: 'default', 'angled', or a custom LabelPlacement class.
   */
  get labelPlacementFast() {
    return this._labelPlacementFast;
  }

  set labelPlacementFast(value) {
    this._labelPlacementFast = this._initialializeLabelPlacement(value);
  }

  /**
   * @member {LabelPlacement} - Get or set the label placement instance for full drawing.
   * Values for setting can be one of the following: 'default', 'angled', or a custom LabelPlacement class.
   */
  get labelPlacementFull() {
    return this._labelPlacementFull;
  }

  set labelPlacementFull(value) {
    this._labelPlacementFull = this._initialializeLabelPlacement(value);
  }

  _initialializeLabelPlacement(nameOrClass) {
    if (typeof nameOrClass === 'string') {
      switch (nameOrClass) {
        case 'default': return new LabelPlacementDefault(this);
        case 'angled': return new LabelPlacementAngled(this);
        default: throw new Error(`Label Placement name '${nameOrClass}' unknown. Use one of 'default', 'angled'`);
      }
    } else {
      // Use provided custom LabelPlacement class
      // TODO: document making custom class and perhaps checking here that required methods are available in provided class
      return new nameOrClass(this);
    }
  }

  /**
   * Returns an [CGArray](CGArray.html) of Labels or a single Label.
   * @param {Integer|String|Array} term - See [CGArray.get](CGArray.html#get) for details.
   * @return {CGArray}
   */
  labels(term) {
    return this._labels.get(term);
  }

  /**
   * Add a new label to the set.
   * @param {Label} label - The Label to add to the set.
   */
  addLabel(label) {
    this._labels.push(label);
  }

  /**
   * Remove a label or an array of labels from the set.
   * @param {Label|Array} labels - The Label(s) to remove from the set.
   */
  removeLabels(labels) {
    labels = (labels.toString() === 'CGArray') ? labels : new CGArray(labels);
    this._labels = this._labels.filter( i => !labels.includes(i) );
    this.refresh();
  }

  // Called from Viewer.add/removeFeatures() and Sequence.updateContigs(), Viewer.updateFeatures(), Viewer.updateTracks()
  refresh() {
    // Remove labels that are on invisible contigs
    // const labels = this._labels.filter( (l) => l.feature.contig.visible);

    // Remove labels:
    // - on invisible features
    // - with features on invisible contigs
    // - with features on invisible tracks
    // - contig is undefined (contig?)
    const labels = this._labels.filter( (l) => l.feature.visible && l.feature.contig?.visible && l.feature.tracks().some( (t) => t.visible ));

    this._availableLabels = labels;
    // Update default Bp for labels
    for (const label of labels) {
      label.bpDefault = label.feature.mapRange.middle;
    }
    this._labelsNCList = new NCList(labels, { circularLength: this.sequence.length, startProperty: 'mapStart', stopProperty: 'mapStop'});
  }

  refreshLabelWidths() {
    const labelFonts = this._labels.map( i => i.font.css );
    const labelTexts = this._labels.map( i => i.name );
    const labelWidths = Font.calculateWidths(this.canvas.context('map'), labelFonts, labelTexts);
    for (let i = 0, len = this._labels.length; i < len; i++) {
      this._labels[i].width = labelWidths[i];
    }
  }

  // Determine basepair position for each label.
  // This will just be the center of the feature,
  // unless the the whole feature is not visible.
  _calculatePositions(labels) {
    labels = labels || this._labels;
    const visibleRange = this._visibleRange;
    let label, feature, containsStart, containsStop;
    let featureLengthDownStream, featureLengthUpStream;
    const sequence = this.sequence;
    for (let i = 0, len = labels.length; i < len; i++) {
      label = labels[i];
      feature = label.feature;
      containsStart = visibleRange.containsMapBp(feature.mapStart);
      containsStop = visibleRange.containsMapBp(feature.mapStop);
      if (containsStart && containsStop) {
        label.bp = label.bpDefault;
        label.lineAttachment = label.lineAttachmentDefault;
        // console.log(label.lineAttachment)
      } else {
        if (containsStart) {
          label.bp = feature.mapRange.getStartPlus( sequence.lengthOfRange(feature.mapStart, visibleRange.stop) / 2 );
        } else if (containsStop) {
          label.bp = feature.mapRange.getStopPlus( -sequence.lengthOfRange(visibleRange.start, feature.mapStop) / 2 );
        } else {
          featureLengthDownStream = sequence.lengthOfRange(visibleRange.stop, feature.mapStop);
          featureLengthUpStream = sequence.lengthOfRange(feature.mapStart, visibleRange.start);
          const halfVisibleRangeLength = visibleRange.length / 2;
          const center = visibleRange.start + halfVisibleRangeLength;
          if (featureLengthUpStream > featureLengthDownStream) {
            label.bp = center + (halfVisibleRangeLength * featureLengthDownStream / (featureLengthDownStream + featureLengthUpStream));
          } else {
            label.bp = center + (halfVisibleRangeLength * featureLengthUpStream / (featureLengthDownStream + featureLengthUpStream));
          }
        }
        // Calculate where the label line should attach to Label.
        // The attachemnt point should be the opposite clock position of the feature.
        // This might need to be recalculated of the label has moved alot
        label.lineAttachment = this.viewer.layout.clockPositionForBp(label.bp, true);
      }
    }
  }

  // Calculates non overlapping rects for priority labels
  // ORIGINAL (Fast)
  _calculatePriorityLabelRectsFast(labels) {
    labels = labels || this._labels;
    const canvas = this.canvas;
    let label, bp, lineLength, overlappingRect;
    const centerOffset = this._outerCenterOffset + this._labelLineMarginInner;
    const placedRects = new CGArray();
    for (let i = 0, len = labels.length; i < len; i++) {
      label = labels[i];
      bp = label.bp;
      lineLength = this.labelLineLength;
      do {
        const outerPt = canvas.pointForBp(bp, centerOffset + lineLength + this._labelLineMarginOuter);
        const rectOrigin = utils.rectOriginForAttachementPoint(outerPt, label.lineAttachment, label.width, label.height);
        label.rect = new Rect(rectOrigin.x, rectOrigin.y, label.width, label.height);
        overlappingRect = label.rect.overlap(placedRects);
        lineLength += label.height;
      } while (overlappingRect);
      placedRects.push(label.rect);
      label.attachementPt = label.rect.ptForClockPosition(label.lineAttachment);
    }
  }

  _calculatePriorityLabelRects(labels) {
    const labelLimit = 20;
    if (!this._fastDraw || labels.length < labelLimit) {
      this.labelPlacementFull.placeLabels(labels, this._outerCenterOffset);
    } else {
      this.labelPlacementFast.placeLabels(labels, this._outerCenterOffset);
    }
  }


  // Should be called when
  //  - Labels are added or removed
  //  - Font changes (Annotation or individual label)
  //  - Label name changes
  //  - Zoom level changes
  _calculateLabelRects(labels) {
    labels = labels || this._labels;
    const canvas = this.canvas;
    let label, bp;
    const centerOffset = this._outerCenterOffset + this._labelLineMarginInner;
    for (let i = 0, len = labels.length; i < len; i++) {
      label = labels[i];
      bp = label.bp;
      // let innerPt = canvas.pointForBp(bp, centerOffset);
      const outerPt = canvas.pointForBp(bp, centerOffset + this.labelLineLength + this._labelLineMarginOuter);
      const rectOrigin = utils.rectOriginForAttachementPoint(outerPt, label.lineAttachment, label.width, label.height);
      label.rect = new Rect(rectOrigin.x, rectOrigin.y, label.width, label.height);
      label.attachementPt = label.rect.ptForClockPosition(label.lineAttachment);
    }
  }

  visibleLabels() {
    let labelArray = new CGArray();
    const visibleRange = this._visibleRange;
    if (visibleRange) {
      if (visibleRange.start === 1 && visibleRange.stop === this.sequence.length) {
        // labelArray = this._labels;
        labelArray = this._availableLabels; // Only labels that are on visible contigs;
      } else {
        labelArray = this._labelsNCList.find(visibleRange.start, visibleRange.stop);
      }
    }
    return labelArray;
  }

  // Labels must already be sorted so favorite are first
  _onlyFavoriteLabels(labels) {
    labels = labels || this._labels;
    const nonFavoriteIndex = labels.findIndex( (label) => !label.feature.favorite );
    if (nonFavoriteIndex !== -1) {
      return labels.slice(0, nonFavoriteIndex);
    } else {
      return labels;
    }
  }

  _sortByPriority(labels) {
    labels = labels || this._labels;
    labels.sort( (a, b) => {
      if (b.feature.favorite === a.feature.favorite) {
        return b.feature.length - a.feature.length;
      } else {
        return a.feature.favorite ? -1 : 1;
      }
    });
    return labels;
  }

  /**
   * Invert color
   */
  invertColors() {
    if (this.color) {
      this.update({ color: this.color.invert().rgbaString });
    }
  }

  drawLabelLine(label, ctx, lineWidth) {
    const innerPt = this.canvas.pointForBp(label.bp, this._outerCenterOffset + this._labelLineMarginInner);
    const outerPt = label.attachementPt;
    const color = this.color || label.feature.color;
    ctx.beginPath();
    ctx.moveTo(innerPt.x, innerPt.y);
    ctx.lineTo(outerPt.x, outerPt.y);
    ctx.strokeStyle = color.rgbaString;
    ctx.lineCap = this.lineCap;
    ctx.lineWidth = lineWidth || this._labelLineWidth;
    ctx.stroke();

    // TESTING adding extra radiant line to label line
    // NOTE: this would be added to previous stroke
    // - Also would need to add this to label line highlighting
    // const innerExtraPt = this.canvas.pointForBp(label.bp, this._outerCenterOffset);
    // ctx.beginPath();
    // ctx.moveTo(innerExtraPt.x, innerExtraPt.y);
    // ctx.lineTo(innerPt.x, innerPt.y);
    // ctx.stroke();
    //
    // ctx.arc(outerPt.x, outerPt.y, 1.5, 0, 2*Math.PI, false);
    // ctx.fillStyle = color.rgbaString;
    // ctx.fill();
  }

  draw(innerCenterOffset, outerCenterOffset, fast) {
    this._fastDraw = fast;
    // TRY refreshing through addFeatures/remove
    // if (this._labels.length !== this._labelsNCList.length) {
    //   this.refresh();
    // }

    // this._visibleRange = this.canvas.visibleRangeForCenterOffset(outerCenterOffset);
    this._visibleRange = this.canvas.visibleRangeForCenterOffset(outerCenterOffset, { float: true, margin: 100 });

    this._innerCenterOffset = innerCenterOffset;
    this._outerCenterOffset = outerCenterOffset;

    // Find Labels that are within the visible range and calculate bounds
    let possibleLabels = this.visibleLabels(outerCenterOffset);

    possibleLabels = this._sortByPriority(possibleLabels);
    if (this.onlyDrawFavorites) {
      possibleLabels = this._onlyFavoriteLabels(possibleLabels);
    }
    this._calculatePositions(possibleLabels);

    const priorityLabels = possibleLabels.slice(0, this.priorityMax);
    const remainingLabels = possibleLabels.slice(this.priorityMax);

    this._calculatePriorityLabelRects(priorityLabels);
    this._calculateLabelRects(remainingLabels);
    // console.log(priorityLabels[0] && priorityLabels[0].rect)

    // Remove overlapping labels
    const labelRects = priorityLabels.map( p => p.rect);
    this._visibleLabels = priorityLabels;
    for (let i = 0, len = remainingLabels.length; i < len; i++) {
      const label = remainingLabels[i];
      if (!label.rect.overlap(labelRects)) {
        this._visibleLabels.push(label);
        labelRects.push(label.rect);
      }
    }

    // Draw nonoverlapping labels
    const canvas = this.canvas;
    const ctx = canvas.context('map');
    let label, rect;
    ctx.font = this.font.css; // TODO: move to loop, but only set if it changes
    ctx.textAlign = 'left';
    // ctx.textBaseline = 'top';
    ctx.textBaseline = 'alphabetic'; // The default baseline works best across canvas and svg
    // Draw label lines first so that label text will draw over them
    for (let i = 0, len = this._visibleLabels.length; i < len; i++) {
      label = this._visibleLabels[i];
      // FIXME: it would be better to remove invisible labels before calculating position
      // - this works to remove label, but the space is not available for another label
      if (!label.feature.visible) { continue; }
      const color = this.color || label.feature.color;

      this.drawLabelLine(label, ctx);
    }

    // Draw label text
    const backgroundColor = this.viewer.settings.backgroundColor.copy();
    backgroundColor.opacity = 0.75;
    for (let i = 0, len = this._visibleLabels.length; i < len; i++) {
      label = this._visibleLabels[i];
      // FIXME: it would be better to remove invisible labels before calculating position
      // - this works to remove label, but the space is not available for another label
      // NOTE: Has this been fixed????????
      if (!label.feature.visible) { continue; }
      const color = this.color || label.feature.color;

      ctx.fillStyle = backgroundColor.rgbaString;
      rect = label.rect;
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

      ctx.fillStyle = color.rgbaString;
      // ctx.fillText(label.name, label.rect.x, label.rect.y);
      ctx.fillText(label.name, label.rect.x, label.rect.bottom - 1);
    }

    if (this.viewer.debug && this.viewer.debug.data.n) {
      this.viewer.debug.data.n.labels = this._visibleLabels.length;
    }
  }

  /**
   * Update annotation [attributes](#attributes).
   * See [updating records](../docs.html#s.updating-records) for details.
   * @param {Object} attributes - Object describing the properties to change
   */
  update(attributes) {
    this.viewer.updateRecords(this, attributes, {
      recordClass: 'Annotation',
      validKeys: ['color', 'font', 'onlyDrawFavorites', 'visible', 'labelPlacement']
    });
    this.viewer.trigger('annotation-update', { attributes });
  }

  /**
   * Returns JSON representing the object
   */
  toJSON(options = {}) {
    const json = {
      font: this.font.string,
      color: this.color && this.color.rgbaString,
      onlyDrawFavorites: this.onlyDrawFavorites,
      // In most cases the full and fast method will be the same.
      // We could export both but for now we will only use the 'full' and it will be for both fast and full.
      labelPlacement: this.labelPlacementFull.name,
      visible: this.visible
    };
    // Optionally add default values
    // if (!this.visible || options.includeDefaults) {
    //   json.visible = this.visible;
    // }
    return json;
  }

}


export default Annotation;

