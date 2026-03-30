//////////////////////////////////////////////////////////////////////////////
// Label Placement Angled
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

import LabelPlacementDefault from './LabelPlacementDefault';
import Rect from './Rect';
import CGArray from './CGArray';
import utils from './Utils';

// CHECK:
// - do we need direction?
// - linear map: will _next/_prev label exist

// REMAINING ISSUES
// - Using the max angle and building the island inward can leave big gaps
//   - Fix: After placing popped labels, iteratively move the pre/post popped label inward and then place remaining labels outward from there
// - When placing popped labels, if a label line doesn't need to be extended it may cross labels that were extended
//   - Label lines crossing in islands can occur if the next label pops less then previous label
//   - [DONE} Fix: place popped labels in order from both sides always extending the line
//   - There can still be some line crossing but it is much better now
//   - TRY: when reducing line length, start at current length and gradual get smaller.
//     - This will look better and have fewer croseed lines

// NEXT
// - When finding backwardBoundary (or forwardBoundary), we haven't added any margin
//   - AND we're using .bp to find distance with prev label (it should be attachBp)
// - When checking if we've merged with the first island or not (make sure to re-place the first island) as it may have a new boundary with the last island
// - Instead of keeping track of all placed rects lets do it island by island
//   - We can also compare against just the previous islands rects as well
//
// DEFINITIONS:
// Island:
// - Group of labels that overlap and are placed together as a group
// - Starts off with groups of labels where each label overlaps the previous label (when placed normally)
// Boundary Labels:
// - The first and last label in an island
// - These labels should not clash with the next/previous island boundary labels
// Popped Labels:
// - Labels that can not be placed normally or angled without increasing the angle too much
// - Popped labels increase their line length until they don't clash with any other labels (in their island or the previous one)
// Prepopped Label:
// - Label that isn't popped. The next one is.
// Postpopped Label:
// - Label that isn't popped. The previous one is.
// Label Properties:
// - label.bp is where the label line will be on the map side
// - label._attachBp is where the label line will be on the label side

// IMPROVEMENTS:
// - change attachement to attachment!!!! (in utils and everywhere it's called)

// Notes:
// - If needed we can sort by island size. Place bigger islands first (or other way around)

/**
 *
 * Labels angled away (fanned out) from each other.
 *
 * @extends LabelPlacementDefault
 * @private
 */
class LabelPlacementAngled extends LabelPlacementDefault {

  /**
   * Create a new label placement instance
   * @param {Annotation} annotation - The CGView annotation object
   * @param {Object} options - ...
   */
  constructor(annotation, options = {}) {
    super(annotation, options);
    // this._debug = false;
    // this._debug = true;

    // Debuging labels
    // - add what to log when a label is clicked
    this.viewer.off('click.labels-test'); // Remove previous events or it may be registered twice
    this.viewer.on('click.labels-test', (e) => {
      if (e.elementType === 'label') {
        const label = e.element;
        console.log(`LABEL: ${label.name}, BP:${label.bp}, aBP:${label._attachBp}, D:${label._direction}, P:${label._popped}`)
        console.log(label, label._island)
      }
    });
  }

  /**
   * Return the class name as a string.
   * @return {String} - 'LabelPlacementAngled'
   */
  toString() {
    return 'LabelPlacementAngled';
  }

  /**
   * @member {Viewer} - Get the name of this LabelPlacement
   */
  get name() {
    return 'angled';
  }

  _nextLabel(label, direction=1) {
    return (direction >= 0) ? label._next : label._prev;
  }
  _prevLabel(label, direction=1) {
    return (direction >= 0) ? label._prev : label._next;
  }

  /**
   * Place provided labels
   * @param {Array} labels - The labels to place.
   * @param {Number} outerOffset - Initial distance from the map for label rect placement (not including line length)
   * @param {Object} options - ...
   */
  placeLabels(labels, outerOffset) {
    this._debug && console.log('LABELS -----------------------------------------')
    const canvas = this.canvas;
    let label, bp, overlappingRect;
    this._rectOffsetWithoutLineLength = outerOffset + this._labelLineMarginInner + this._labelLineMarginOuter;

    const bpPerPixel = 1 / canvas.pixelsPerBp(this.rectCenterOffset());
    this._boundaryMarginBp = (labels[0]?.height * bpPerPixel / 2);

    // Sort labels by bp position
    labels.sort( (a, b) => a.bp - b.bp );

    // The approximate bp adjustment for the label line to reach the given angle (Degrees)
    const maxLineAngle = 80;
    this.maxBpAdjustment = this.maxBpAdjustForAngle(maxLineAngle)

    // Reset label properties
    for (let i = 0, len = labels.length; i < len; i++) {
      label = labels[i];
      label._attachBp = label.bp;
      label._direction = 0; // 0: straight; -1: back; 1: forward;
      label._popped = false;
      label._placementIndex = i;
      // FIXME: assuming circle for now
      label._next = (i === len-1) ? labels[0] : labels[i+1]
      label._prev = (i === 0) ? labels[labels.length-1] : labels[i-1];

      // Default Rect for label
      const outerPt = canvas.pointForBp(label.bp, this.rectCenterOffset());
      const rectOrigin = utils.rectOriginForAttachementPoint(outerPt, label.lineAttachment, label.width, label.height);
      label._defaultRect = new Rect(rectOrigin.x, rectOrigin.y, label.width, label.height);
      label.rect = label._defaultRect;
      label._lineLength = this.initialLabelLineLength;

      // Default maxBp Adjustment
      // Top/bottom labels will have half the max adjust
      label._maxBpAdjustment = [6,12].includes(label.lineAttachment) ? this.maxBpAdjustment / 2 : this.maxBpAdjustment;
    }

    // Find Initial Islands
    let islands = this.findIslands(labels);
    // Initial placement of island labels
    this.placeIslands(islands);
    // Merge Islands
    islands = this.mergeIslands(islands);
    // Goes through each label and if it overlaps any previous label, the line length in increased
    this.finalLabelAdjust(labels);

    // Set the attachment point for each label line
    for (let labelIndex = 0, len = labels.length; labelIndex < len; labelIndex++) {
      const label = labels[labelIndex];
      if (label.rect) {
        label.attachementPt = label.rect.ptForClockPosition(label.lineAttachment);
      }
    }
  }

  // Initial pass for finding islands using the default rect for each label
  // - Islands occur when a label overlaps the next label which overlaps the next label and so on.
  findIslands(labels=[]) {
    const sequence = this.viewer.sequence;
    // Do not join labels into an island if they are over half the sequence length away
    // FIXME: we could change this based on the maxBpAdustments (copied on next line)
    // const maxBpRangeAllowed = rangeFactor * (this.firstLabel._maxBpAdjustment + island.lastLabel._maxBpAdjustment);
    const maxDistance = sequence.length / 2;
    let label, prevLabel;
    const islands = [];
    if (labels.length === 0) return islands;
    let  island = new LabelIsland(this, labels[0]);
    for (let labelIndex = 1, len = labels.length; labelIndex < len; labelIndex++) {
      label = labels[labelIndex];
      prevLabel = this._prevLabel(label);
      const overlap = label._defaultRect.overlap([prevLabel._defaultRect]);
      const distance = sequence.lengthOfRange(prevLabel.bp, label.bp);
      if (overlap && distance <= maxDistance) {
        island.addLabels(label)
      } else {
        islands.push(island);
        island = new LabelIsland(this, label);
      }
    }
    // Add last island
    islands.push(island);
    // FIXME: if last label and first label overlap, the first and last islands must be merged
    return islands;
  }

  // Place labels for each island
  placeIslands(islands) {
    for (let islandIndex = 0, len = islands.length; islandIndex < len; islandIndex++) {
      const island = islands[islandIndex];
      island.placeLabels();
    }
  }

  // Place labels of curent island and next island
  // Do they clash
  //  yes - merge and re-place island and try to merge again
  //  no  - continue on
  mergeIslands(islands) {
    const sequence = this.viewer.sequence;

    // No need to merge if there is only one island
    if (islands.length <=1) {
      return islands;
    }

    // Need to go through island iteratively until there are no more merges
    // Everytime we merge we have to start again
    let mergeOccurred, mergedIslands;
    let tempIslands = islands;
    let tempIsland;
    let labelsToMerge = islands[0]?.labels;
    // The max loop cound will be the length of the original islands
    let loopCount = 0;
    do {
      mergeOccurred = false;
      mergedIslands = [];
      loopCount++;

      for (let islandIndex = 0, len = tempIslands.length; islandIndex < len; islandIndex++) {
        const island = tempIslands[islandIndex];
        const nextIsland = (islandIndex >= (len-1)) ? tempIslands[0] : tempIslands[islandIndex + 1];

        island.placeLabels(); // FIXME: don't need to place if didn't merge last time (since these are the same as the last loops nextIsland)
        nextIsland.placeLabels();

        // Same island. No need to merge.
        if (nextIsland === island) {
          break;
        }

        if (island.clash(nextIsland)) {
          if (island.canMergeWith(nextIsland)) {
            labelsToMerge = island.labels.concat(nextIsland.labels);
            tempIsland = new LabelIsland(this, labelsToMerge);

            // Add previous boundary to newly merged island
            tempIsland.startBoundaryBp = island.startBoundaryBp;

            // Deal with last island merging with first island
            if (island === tempIslands[len-1]) {
              mergedIslands[0] = tempIsland;
              tempIsland.placeLabels();
              // FIXME: I think we may still need to go through do loop again
              // mergeOccurred = false;
              break; // Breaks out of DO loop (because mergeOccurred is not set to true)
            }

            mergedIslands.push(tempIsland)

            // Add remaining islands to merged for next iteration
            if (tempIslands[islandIndex+2]) {
              mergedIslands = mergedIslands.concat(tempIslands.slice(islandIndex+2));
              // FIXME: maybe this should use original 'islands' instead of tempIslands 
            }
            tempIslands = mergedIslands;
            mergeOccurred = true
            break; // Out of for loop
          } else {
            // Overlap but can't merge
            // Add boundaries betwen the 2 islands
            const bpDistanceBetweenIslands = sequence.lengthOfRange(island.lastLabel.bp, nextIsland.firstLabel.bp);

            // Only set boundary if islands are within a 1/4 of the map length apart
            if (bpDistanceBetweenIslands < (sequence.length / 4)) {
              let boundaryDistance = bpDistanceBetweenIslands / 2;
              // Distance has to be adjusted to fit label text
              boundaryDistance -= this._boundaryMarginBp;
              // Don't let distance be les than 0 or the label line will go in the opposite direction
              boundaryDistance = (boundaryDistance < 0) ? 0 : boundaryDistance;
              // Add boundaries
              island.stopBoundaryBp = sequence.addBp(island.lastLabel.bp, boundaryDistance);
              nextIsland.startBoundaryBp = sequence.subtractBp(nextIsland.firstLabel.bp, boundaryDistance);
              // Re-place current island. Next island will be placed on next iteration.
              island.placeLabels();
            }
            // This wasn't here before and it still seemed to work?
            mergedIslands.push(island);
          }
        } else {
          mergedIslands.push(island);
        }
      }
    } while (mergeOccurred && loopCount < islands.length);
    return mergedIslands;
  }

  // Direction: 1 for forward, -1 for backward
  // Returns the attachPt for the next label. The point where the label line attaches to the next label.
  // AttachPt is the point on the rect that the line attaches to
  // Only works when the label overlaps with previous label
  // Coordinates:
  // - outerPtX/Y are on the canvas coordinates and refer to where on the label, the label line will attach.
  // - mapX/Y are on the map coordinates
  // Note the sign for map coordinates.
  // - when getting the sqrt of attachPt for 1,2,3,4,5: mapX is negative.
  // - when getting the sqrt of attachPt for 7,8,9,10,11: mapX is positive.
  _getNextAttachPt(label, direction=1) {
    const margin = 2;
    const scale = this.viewer.scale;
    const goingForward = (direction > 0);
    // Distance from the map center to where the label rect will be attached
    const rectOffset = this.rectCenterOffset()
    const rectOffsetSquared = rectOffset*rectOffset;
    let outerPtX, outerPtY, mapY, mapX;
    let height = label.height;
    let width = label.width;
    const prevRect = this._prevLabel(label, direction)?.rect;
    // Return the default point for the label when their is no previous label to compare
    if (!prevRect) {
      return this.canvas.pointForBp(label.bp, rectOffset);
    }
    // FIXME: it would be better of layout specific code could be in the Layout class
    const isLinear = this.viewer.format === 'linear';

    // Label Line Attachment Sites
    //  10,11       12       1,2
    //      \_______|_______/
    //   9 -|_______________|- 3
    //      /       |       \
    //  8,7         6        5,4
    switch (label.lineAttachment) {
      case 7:
      case 8:
        outerPtY = goingForward ? (prevRect.bottom + height + margin) : (prevRect.top - margin);
        mapY = scale.y.invert(outerPtY);
        mapX = Math.sqrt( (rectOffsetSquared) - (mapY*mapY) );
        outerPtX = scale.x(mapX);
        break;
      case 9:
        outerPtY = goingForward ? (prevRect.bottom + (height/2) + margin) : (prevRect.top - (height/2) - margin);
        mapY = scale.y.invert(outerPtY);
        mapX = Math.sqrt( (rectOffsetSquared) - (mapY*mapY) );
        outerPtX = scale.x(mapX);
        break;
      case 10:
      case 11:
        outerPtY = goingForward ? (prevRect.bottom + margin) : (prevRect.top - height - margin);
        mapY = scale.y.invert(outerPtY);
        mapX = Math.sqrt( (rectOffsetSquared) - (mapY*mapY) );
        outerPtX = scale.x(mapX);
        break;
      case 12:
        // FIXME: Won't work for linear (if we ever have labels on the bottom of the map)
        // - see case 6 below
        outerPtX = goingForward ? (prevRect.left - (width/2) - margin) : (prevRect.right + (width/2) + margin);
        mapX = scale.x.invert(outerPtX);
        mapY = -Math.sqrt( (rectOffsetSquared) - (mapX*mapX) );
        outerPtY = scale.y(mapY);
        break;
      case 1:
      case 2:
        outerPtY = goingForward ? (prevRect.top - height - margin) : (prevRect.bottom + margin);
        mapY = scale.y.invert(outerPtY);
        mapX = -Math.sqrt( (rectOffsetSquared) - (mapY*mapY) );
        outerPtX = scale.x(mapX);
        break;
      case 3:
        outerPtY = goingForward ? (prevRect.top - (height/2) - margin) : (prevRect.bottom + (height/2) + margin);
        mapY = scale.y.invert(outerPtY);
        mapX = -Math.sqrt( (rectOffsetSquared) - (mapY*mapY) );
        outerPtX = scale.x(mapX);
        break;
      case 4:
      case 5:
        outerPtY = goingForward ? (prevRect.top - margin) : (prevRect.bottom + height + margin);
        mapY = scale.y.invert(outerPtY);
        mapX = -Math.sqrt( (rectOffsetSquared) - (mapY*mapY) );
        outerPtX = scale.x(mapX);
        break;
      case 6:
        outerPtX = goingForward ? (prevRect.right + (width/2) + margin) : (prevRect.left - (width/2) - margin);
        if (isLinear) {
          outerPtY = prevRect.top;
        } else {
          mapX = scale.x.invert(outerPtX);
          mapY = Math.sqrt( (rectOffsetSquared) - (mapX*mapX) );
          outerPtY = scale.y(mapY);
        }
        break;
    }
    return {x: outerPtX, y: outerPtY};
  }

  /**
   * Approximate bp change between label line start (label.bp) and end (label._attachBp)
   * for the given angle in degrees.
   * Most accurate as the circle approaches looking like a line
   *                      bp
   *                      |  x - xDistance is top line from bp to attachBp
   *                      +----+ - attachBp
   *                      |   /
   *    labelLineLength - |  /
   *                      | /
   *                      v - angle
   * @param {Number} degrees - Label line angle
   */
  maxBpAdjustForAngle(degrees) {
    this.rectCenterOffset();
    // The distance (with no angle) from line start to line end
    const distanceBpToAttachBp = this.initialLabelLineLength;
    const radians = degrees * Math.PI/180
    // Find out xDistance for angle
    const xDistance = distanceBpToAttachBp * Math.tan(radians)
    // Convert to bp difference
    const startPt = this.canvas.pointForBp(1, this.rectCenterOffset());
    startPt.x += xDistance;
    const bpDiff = this.canvas.bpForPoint(startPt);
    this._debug && console.log(`BP Diff for angle ${degrees}°: ${bpDiff}`);
    return bpDiff
  }

  // Basically the same as the Default lable placement
  // - except we are using ._attachBp instead of .bp
  finalLabelAdjust(labels) {
    const canvas = this.canvas;
    let label, bp, lineLength, overlappingRect;
    const placedRects = new CGArray();
    for (let i = 0, len = labels.length; i < len; i++) {
      label = labels[i];
      bp = label._attachBp;
      // lineLength = this.initialLabelLineLength;
      lineLength = label._lineLength;
      do {
        const outerPt = canvas.pointForBp(bp, this.rectCenterOffset(lineLength));
        const rectOrigin = utils.rectOriginForAttachementPoint(outerPt, label.lineAttachment, label.width, label.height);
        label.rect = new Rect(rectOrigin.x, rectOrigin.y, label.width, label.height);
        overlappingRect = label.rect.overlap(placedRects);
        lineLength += label.height;
      } while (overlappingRect);
      label._lineLength = lineLength;
      placedRects.push(label.rect);
      label.attachementPt = label.rect.ptForClockPosition(label.lineAttachment);
    }
  }

}

export default LabelPlacementAngled;

//////////////////////////////////////////////////////////////////////////////
// Helper Classes
//////////////////////////////////////////////////////////////////////////////
class LabelIsland {

  constructor(labelPlacement, labels) {
    this.labelPlacement = labelPlacement;
    this._labels = [];
    this.canvas = labelPlacement.canvas;
    this.viewer = labelPlacement.viewer;
    this.sequence = this.viewer.sequence;
    this._placedRects = [];
    this.addLabels(labels);
  }

  get labels() {
    return this._labels;
  }

  get length() {
    return this.labels.length;
  }

  get single() {
    return this.labels.length === 1;
  }

  get firstLabel() {
    return this.labels[0];
  }

  get lastLabel() {
    return this.labels[this.labels.length-1];
  }

  get placedRects() {
    return this._placedRects;
  }

  // Add a label or an array of labels
  addLabels(labels) {
    if (labels) {
      if (Array.isArray(labels)) {
        // Labels is an array of labels
        this._labels = this._labels.concat(labels);
        for (const label of labels) {
          label._island = this;
        }
      } else {
        // Labels is a single label
        this._labels.push(labels);
        labels._island = this;
      }
    }
  }

  // Find middle label and adjust outward from there.
  // We know that the labels on each side overlaps and so on
  placeLabels() {
    let forwardMaxAngleReached, backwardMaxAngleReached;
    if (!this.single) {
      // Basic placement
      const centerIndex = Math.floor((this.length-1) / 2);
      forwardMaxAngleReached = this.adjustLabels(centerIndex, 1);
      backwardMaxAngleReached = this.adjustLabels(centerIndex, -1);
    }
    // Not enough room, find labels to pop
    if (forwardMaxAngleReached || backwardMaxAngleReached) {
      // Place labels with max angle until labels overlap again
      this.placeWithMaxAngle();
      // Place remaining labels as popped
      this.placePoppedLabels();
    }
    this._placedRects = this.labels.map(l => l.rect)
  }

  adjustLabels(centerIndex, direction) {
    const canvas = this.canvas;
    for (let i = centerIndex+direction, len = this.labels.length; (direction > 0) ? i < len : i >= 0; i+=direction) {
      const label = this.labels[i];
      let labelAttachPt = this.labelPlacement._getNextAttachPt(label, direction);
      // Before getting rect, check if line angle is too large
      let attachBp = canvas.bpForPoint(labelAttachPt);

      // TODO: if label/island has a boundary use it
      if (direction > 0) {
        if (attachBp > this.stopBoundaryBp) {
          // console.log('BOUNDARY-stop')
          return true;
        }
      } else if (direction < 0) {
        if (attachBp < this.startBoundaryBp) {
          // console.log('BOUNDARY-start')
          return true;
        }
      }

      // If max bp adjustemnt is reached, return so labels can be placed from the outside inward
      if (isNaN(attachBp) || Math.abs(attachBp - label.bp) > label._maxBpAdjustment) {
        return true;
      }

      this.adjustLabelWithAttachPt(label, labelAttachPt);
    }
  }

  // Set the first and last label to their maximum angle and place labels
  // inwards from there until the labels overlap. Return the overlapping
  // labels and the remaining unplaced labels.
  // FIXME: if any labels pop, label lines have to be angled way from popped labels
  placeWithMaxAngle() {
    const canvas = this.canvas;
    let forwardIndex, backwardIndex, backLabel, frontLabel, middleLabel;
    this.adjustLabelToMaxAngle(this.firstLabel, -1);
    this.adjustLabelToMaxAngle(this.lastLabel, 1);
    for (let i = 1, len = this.labels.length; i < len; i++) {
      forwardIndex = i;
      backwardIndex = len - 1 - i;
      if (forwardIndex > backwardIndex) {
        // Reached the middle
        return;
      } else if (forwardIndex === backwardIndex) {
        middleLabel = this.labels[backwardIndex];
        this.adjustLabelToNextAttachPt(middleLabel, 1);

        // FIXME: .adjustLabelToNextAttachPt should return undefined if it can't be placed
        // - AND _getNextAttachPtshould return undefined 
        // console.log(middleLabel._attachBp)
        const tempCHECK = isNaN(middleLabel._attachBp)

        const compareLabel = frontLabel || this.lastLabel;
        if (this.labelsClash(middleLabel, compareLabel) || tempCHECK) {
          this.poppedStartIndex = forwardIndex;
          this.poppedStopIndex = backwardIndex;
          // this.poppedStartIndex = this.adjustPopIndex(forwardIndex, -1);
          // this.poppedStopIndex = this.adjustPopIndex(backwardIndex, 1);
        }
        return;
      }
      backLabel = this.labels[forwardIndex];
      frontLabel = this.labels[backwardIndex];
      this.adjustLabelToNextAttachPt(backLabel, 1);
      this.adjustLabelToNextAttachPt(frontLabel, -1);

      // console.log(backLabel._attachBp, frontLabel._attachBp)
      const tempCheck2 = (isNaN(backLabel._attachBp) || isNaN(frontLabel._attachBp === NaN));

      if (this.labelsClash(backLabel, frontLabel) || tempCheck2) {
        // Return the current label indices as the limits of popping labels
        // console.log('Pop Indices Before', forwardIndex, backwardIndex);
        this.poppedStartIndex = this.adjustPopIndex(forwardIndex, -1);
        this.poppedStopIndex = this.adjustPopIndex(backwardIndex, 1);
        // this.poppedStartIndex = forwardIndex;
        // this.poppedStopIndex = backwardIndex;
        // console.log('Pop Indices After', this.poppedStartIndex, this.poppedStopIndex);
        return;
      }
    }
  }

  // Need to adjust pop indices to add any labels whose label line is angled towards island middle
  adjustPopIndex(index, direction) {
    // console.log('INITIAL', index)
    let newIndex = index;
    for (let i = index+direction, len = this.labels.length; (direction > 0) ? i < len : i >= 0; i+=direction) {
      const label = this.labels[i];
      if (label._direction == direction) {
        // return newIndex;
        break;
      }
      newIndex = i;
    }
    // console.log('NEW', newIndex)
    return newIndex;
  }


  // Take the labels that should be popped (ie, labels that don't have space to be right beside map)
  // and place them equally apart (based on distance from pre to post popped label attchBp)
  // and increasing line length until there are no clashes with other popped labels
  // - Get bp from label before popped and label after popped (may need to adjust)
  // - This is the bp range
  // - Divide bp range by number of popped labels then start from one end (or both?)
  // - This is the popped bp shift
  // - Place each lable by incrementing the bp shift and extend line until it doesn't clash
  placePoppedLabels() {
    if (this.poppedStartIndex === undefined || this.poppedStopIndex === undefined) return;
    let label, bp, overlappingRect;
    const sequence = this.viewer.sequence;
    const sequenceLength = sequence.length;
    // Add non-popped labels from this island to rectsToCheck
    let rectsToCheck = this.labels.filter( (label,i) => (i < this.poppedStartIndex || i > this.poppedStopIndex) ).map(l => l.rect)
    // FIXME: previous island may not exist in linear
    const prevIsland = this.firstLabel?._prev?._island;
    if (prevIsland) {
      rectsToCheck = rectsToCheck.concat(prevIsland.placedRects);
    }
    // Get labels before and after popped. Or use the the poppedIndex of there are no more labels
    const prePoppedIndex = Math.max(this.poppedStartIndex-1, 0);
    const postPoppedIndex = Math.min(this.poppedStopIndex+1, this.labels.length-1);
    const startBp = this.labels[prePoppedIndex]._attachBp;
    const stopBp = this.labels[postPoppedIndex]._attachBp;
    const bpDistance = sequence.lengthOfRange(startBp, stopBp);
    const bpIncrement = bpDistance / (this.poppedStopIndex - this.poppedStartIndex + 2);
    let poppedNumber = 1;
    let lineLength = this.labelPlacement.initialLabelLineLength;
    let minLineLength, direction;
    for (let i = this.poppedStartIndex; i <= this.poppedStopIndex; i++) {
      label = this.labels[i];
      bp = startBp + (bpIncrement * poppedNumber);
      label._popped = true;
      // Try to reduce the line length first
      // poppedFactor: the amount to reduce the line height should increase as we move through the popped labels
      let poppedFactor = poppedNumber / (this.poppedStopIndex - this.poppedStartIndex + 1);
      poppedFactor *= 5;
      // lengthFactor: It is also dependent on the line length (ie. if the line is quite long work harder at reducing the length)
      let lengthFactor = lineLength / this.labelPlacement.initialLabelLineLength;
      lengthFactor /= 5;
      // FIXME: Instead of reducing the line length and then then increasing until we fit
      // - gradually reduce the line until it reaches the maximum allow reduced value
      // - This will tighten up the labels in some cases
      // lineLength -= (label.height * 1.1 * poppedFactor * lengthFactor);
      // Line length can't be less the intial value
      // lineLength = Math.max(lineLength, this.labelPlacement.initialLabelLineLength);
      // lineLength = this.labelPlacement.initialLabelLineLength; // Old Way

      minLineLength = lineLength - (label.height * 1.1 * poppedFactor * lengthFactor);
      // Line length can't be less the intial value
      minLineLength = Math.max(minLineLength, this.labelPlacement.initialLabelLineLength);
      direction = -1;
      do {
        const outerPt = this.canvas.pointForBp(bp, this.labelPlacement.rectCenterOffset(lineLength));
        this.adjustLabelWithAttachPt(label, outerPt);
        overlappingRect = label.rect.overlap(rectsToCheck);
        // lineLength += (label.height * 1.1);
        lineLength += (label.height * 1.1 * direction);
        if (lineLength < minLineLength) {
          direction = 1;
          lineLength = minLineLength;
        }
      } while (overlappingRect);
      label._lineLength = lineLength;
      rectsToCheck.push(label.rect);
      poppedNumber++;
    }
  }

  // Adjust label to the next closest position from the previous label
  adjustLabelToNextAttachPt(label, direction) {
    let labelAttachPt = this.labelPlacement._getNextAttachPt(label, direction);
    this.adjustLabelWithAttachPt(label, labelAttachPt);
  }

  // Adjust label, to the given attachment point
  adjustLabelWithAttachPt(label, labelAttachPt) {
    const rectOrigin = utils.rectOriginForAttachementPoint(labelAttachPt, label.lineAttachment, label.width, label.height);
    label.rect = new Rect(rectOrigin.x, rectOrigin.y, label.width, label.height);
    label._attachBp = this.canvas.bpForPoint(labelAttachPt);

    // FIXME: circle FIXORIGIN issue. fixed?
    // - NOPE: doesn't work if attachBp and bp are on opposite sides of the origin
    const bpDiff = label.bp - label._attachBp;
    if (bpDiff > 0) {
      label._direction = -1;
    } else if (bpDiff < 0 ) {
      label._direction = 1;
    } else {
      label._direction = 0;
    }
    const sequenceHalfLength = this.viewer.sequence.length / 2;
    if (Math.abs(bpDiff) > sequenceHalfLength ) {
      // crosses origin
      // console.log('CROSS ORIGIN')
      label._direction *= -1;
    }
  }

  // The forward boundary of the island. Based on the following:
  // - the max angle a boundary label can go
  // - the next island's first label
  // - if merging with the next island could not occur then the boundary is in between the islands
  // - need to consider
  //   - linear/circular maps and the origin
  //   - Is there a next island?
  forwardBoundary() {
    if (this.stopBoundaryBp) return this.stopBoundaryBp;
    const lastLabel = this.lastLabel;
    const nextLabel = lastLabel._next;
    const sequenceLength = this.viewer.sequence.length;
    let distance = this.sequence.lengthOfRange(lastLabel.bp, nextLabel.bp);
    distance = (distance > lastLabel._maxBpAdjustment) ? lastLabel._maxBpAdjustment : distance;
    return lastLabel.bp + distance;
  }

  backwardBoundary() {
    if (this.startBoundaryBp) return this.startBoundaryBp;
    const firstLabel = this.firstLabel;
    const prevLabel = this.firstLabel._prev;
    const sequenceLength = this.viewer.sequence.length;
    // let distance = this.sequence.lengthOfRange(prevLabel.bp, firstLabel.bp);
    // The follwoing is better when there are islands separated by the origins (see phaster2 example)
    let distance;
    if (prevLabel?._attachBp > firstLabel.bp) {
      // Cross origin
      // FIXME: should use attachBp here as well for prevLabel
      distance = sequenceLength - prevLabel.bp + firstLabel.bp;
    } else if (prevLabel) {
      // distance = firstLabel.bp - prevLabel.bp;
      distance = firstLabel.bp - prevLabel._attachBp - this.labelPlacement._boundaryMarginBp;
    }
    distance = (distance > firstLabel._maxBpAdjustment) ? firstLabel._maxBpAdjustment : distance;
    return firstLabel.bp - distance;
  }

  // Adjust label, so that is label line is at the maximum allowed angle
  // Boundaries are either set by islands that tried to merge and couldn't: boundary half way between them
  // Or it's just the next/prev label bp (for now)
  adjustLabelToMaxAngle(label, direction) {
    const maxBpAdjustment = label._maxBpAdjustment;
    const maxBp = label.bp + (direction * maxBpAdjustment);
    let newBp, boundary;
    if (direction > 0) {
      newBp = this.forwardBoundary();
    } else if (direction < 0) {
      newBp = this.backwardBoundary();
    }
    if (newBp != maxBp) {
    }
    const labelAttachPt = this.canvas.pointForBp(newBp, this.labelPlacement.rectCenterOffset());
    this.adjustLabelWithAttachPt(label, labelAttachPt);
  }

  // Looking Forward
  clash(island) {
    const didClash =  this.labelsClash(this.lastLabel, island.firstLabel);
    return didClash;
  }

  labelsClash(label1, label2) {
    const sequence = this.viewer.sequence;
    const rectsOverlap = label1.rect.overlap([label2.rect]);
    // The following does not work for crossing the origin
    // const linesCross = (label1.bp < label2.bp) ? (label1._attachBp > label2._attachBp) : (label1._attachBp < label2._attachBp);

    // If the attachBp diff and bp diff are of opposite signs then the lines cross
    // NOTE: this is the effectively the same as above
    // const linesCross = ((label2.bp - label1.bp) / (label2._attachBp - label1._attachBp)) < 0 ;

    // TEMP FIX
    // FIXME
    const bpDistance = sequence.lengthOfRange(label1.bp, label2.bp);
    const attachDistance = sequence.lengthOfRange(label1._attachBp, label2._attachBp);
    const linesCross = (bpDistance < (sequence.length / 2)) && (attachDistance > (sequence.length / 2));

    return (rectsOverlap || linesCross);
  }

  // Max island range is based on labe._maxBpAdjustment of island boundaries
  canMergeWith(island) {
    // console.log('ISLANDS in:', this.length, island.length)
    const sequence = this.viewer.sequence;
    // May need to merge first and test size
    const rangeFactor = 1;
    const maxBpRangeAllowed = rangeFactor * (this.firstLabel._maxBpAdjustment + island.lastLabel._maxBpAdjustment);
    // Approximate range if islands were merged. Not exact because we haven't re-placed labels after a merge.
    // FIXME: over FIXORIGIN - fixed?
    const mergedIslandRangeAdjustedBp = sequence.lengthOfRange(this.firstLabel._attachBp, island.lastLabel._attachBp);
    // AdjustedBp range can be wrong when: island - origin - this(island)
    // So lets also look at Bp range (not adjusted)
    const mergedIslandRangeBp = sequence.lengthOfRange(this.firstLabel.bp, island.lastLabel.bp);
    // console.log(`${this.firstLabel.name}: ${this.firstLabel._attachBp}; ${island.lastLabel.name}: ${island.lastLabel._attachBp}`);
    // console.log('CAN?-', mergedIslandRangeAdjustedBp, mergedIslandRangeBp, maxBpRangeAllowed, mergedIslandRangeAdjustedBp <= maxBpRangeAllowed)
    return mergedIslandRangeAdjustedBp <= maxBpRangeAllowed && mergedIslandRangeBp <= maxBpRangeAllowed;
  }

}

// CONSIDER doing this for nonpopped labels on the island edge
  // // Adjust the lineAttahcment point based on the direction of the label
  // // - angled forward: add 1 to the clock position of the attachment
  // // - angled backward: subtract 1 to the clock position of the attachment
  // _adjustLinAttachment(label, direction) {
  //   let newLineAttacment = label.lineAttachment;
  //   newLineAttacment+= direction;
  //   if (newLineAttacment > 12) {
  //     newLineAttacment = 1;
  //   } else if (newLineAttacment < 1) {
  //     newLineAttacment = 12;
  //   }
  //   label.lineAttachment = newLineAttacment;
  // }
