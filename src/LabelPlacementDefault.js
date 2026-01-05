//////////////////////////////////////////////////////////////////////////////
// Label Placement Default
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

import Rect from './Rect';
import CGArray from './CGArray';
import utils from './Utils';

/**
 * LabelPlacementDefault is the default method to find where to place feature
 * [Labels](Label.html) on the map. LabelPlacementDefault is used by
 * [Annotation](Annotation.html) before drawing [feature](Feature.html) names
 * on the map.
 *
 * The default method, only uses straight lines perpendicular to the map and
 * stacks them as necessary to avoid collisions.
 *
 * This class can be extended to provide new ways to place labels.
 *
 * TODO:
 * - What is requires by the class
 *   - array of labels
 *   - access to annotation and viewer object
 *   - some default constants: ...
 * - What should class do
 *   - have placeLabels medthod that take an aray of labels to place
 *   - for each label
 *     - add rect
 *     - attchement point
 *
 * @private
 */
class LabelPlacementDefault {

  /**
   * Create a new label placement instance
   * @param {Annotation} annotation - The CGView annotation object
   * @param {Object} options - ...
   */
  constructor(annotation, options = {}) {
    this._annotation = annotation;
    this._initialLabelLineLength = annotation._labelLineLength;
    this._labelLineMarginInner = annotation._labelLineMarginInner;
    this._labelLineMarginOuter = annotation._labelLineMarginOuter;
  }

  //////////////////////////////////////////////////////////////////////////
  // Methods / Properties proved to sub classes
  //////////////////////////////////////////////////////////////////////////


  /**
   * @member {Viewer} - Get the *Viewer*
   */
  get viewer() {
    return this.annotation.viewer;
  }

  /**
   * @member {Annotation} - Get the *Annotation*
   */
  get annotation() {
    return this._annotation;
  }

  /**
   * @member {Canvas} - Get the *Canvas*
   */
  get canvas() {
    return this.viewer.canvas;
  }

  /**
   * @member {Number} - Get the initial line length for labels.
   */
  get initialLabelLineLength() {
    return this._initialLabelLineLength;
  }

  /**
   * Return the distance from the map center to where the label rect should be placed.
   * If lineLength is provided it will be included in the calculation, otherwise,
   * the default labelLineLength will be used.
   * @param {Number} lineLength - Length of the label line
   * @return {Number} - Distance from map center ot where label rect should be placed.
   */
  rectCenterOffset(lineLength=this.initialLabelLineLength) {
    return this._rectOffsetWithoutLineLength + lineLength;
  }


  //////////////////////////////////////////////////////////////////////////
  // Required Method to override in subclasses
  //////////////////////////////////////////////////////////////////////////

  /**
   * Return the class name as a string.
   * @return {String} - 'LabelPlacementDefault'
   */
  toString() {
    return 'LabelPlacementDefault';
  }

  /**
   * @member {Viewer} - Get the name of this LabelPlacement
   */
  get name() {
    return 'default';
  }

  /**
   * Place provided labels.
   *
   * Override this method is subclasses.
   *
   * @param {Array} labels - The labels to place.
   // * @param {Number} rectOffset - Initial distance from the map for label rect placement.
   * @param {Object} options - ...
   */
  placeLabels(labels, outerOffset) {
    const canvas = this.canvas;
    let label, bp, lineLength, overlappingRect;
    this._rectOffsetWithoutLineLength = outerOffset + this._labelLineMarginInner + this._labelLineMarginOuter;

    const placedRects = new CGArray();
    for (let i = 0, len = labels.length; i < len; i++) {
      label = labels[i];
      bp = label.bp;
      lineLength = this.initialLabelLineLength;
      do {
        const outerPt = canvas.pointForBp(bp, this.rectCenterOffset(lineLength));
        const rectOrigin = utils.rectOriginForAttachementPoint(outerPt, label.lineAttachment, label.width, label.height);
        label.rect = new Rect(rectOrigin.x, rectOrigin.y, label.width, label.height);
        overlappingRect = label.rect.overlap(placedRects);
        lineLength += label.height;
      } while (overlappingRect);
      placedRects.push(label.rect);
      label.attachementPt = label.rect.ptForClockPosition(label.lineAttachment);
    }
  }


}

export default LabelPlacementDefault;

