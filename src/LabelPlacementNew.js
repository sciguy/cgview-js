//////////////////////////////////////////////////////////////////////////////
// Label Placement New
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
import utils from './Utils';

/**
 * Circular label placement that keeps labels ordered on each side of the map.
 *
 * Labels are placed in a monotonic stack on the left and right halves of the
 * circle. This keeps overlaps out, greatly reduces line crossings, and only
 * uses a two-segment line when a straight segment would cut through the map.
 *
 * @extends LabelPlacementDefault
 * @private
 */
class LabelPlacementNew extends LabelPlacementDefault {

  toString() {
    return 'LabelPlacementNew';
  }

  get name() {
    return 'new';
  }

  placeLabels(labels, outerOffset) {
    this._rectOffsetWithoutLineLength = outerOffset + this._labelLineMarginInner + this._labelLineMarginOuter;

    if (this.viewer.format !== 'circular') {
      super.placeLabels(labels, outerOffset);
      return;
    }

    const center = this._canvasCenter();
    const rightLabels = [];
    const leftLabels = [];

    for (let i = 0, len = labels.length; i < len; i++) {
      const label = labels[i];
      const outerPt = this.canvas.pointForBp(label.bp, this.rectCenterOffset());
      const lineAttachment = this._lineAttachmentForPoint(outerPt, center);
      label.lineAttachment = lineAttachment;
      const rectOrigin = utils.rectOriginForAttachementPoint(outerPt, lineAttachment, label.width, label.height);
      label._defaultRect = new Rect(rectOrigin.x, rectOrigin.y, label.width, label.height);
      label._defaultOuterPt = outerPt;
      label._newPlacementSide = (outerPt.x >= center.x) ? 'right' : 'left';
      if (label._newPlacementSide === 'right') {
        rightLabels.push(label);
      } else {
        leftLabels.push(label);
      }
    }

    this._placeSide(rightLabels, 'right', center);
    this._placeSide(leftLabels, 'left', center);

    for (let i = 0, len = labels.length; i < len; i++) {
      const label = labels[i];
      label.attachementPt = label.rect.ptForClockPosition(label.lineAttachment);
      this._updateLinePoints(label, outerOffset);
    }
  }

  _placeSide(labels, side, center) {
    if (labels.length === 0) {
      return;
    }

    const centerGap = 8;
    const upperLabels = [];
    const lowerLabels = [];

    for (let i = 0, len = labels.length; i < len; i++) {
      const label = labels[i];
      let x = label._defaultRect.x;
      if (side === 'right') {
        x = Math.max(x, center.x + centerGap);
      } else {
        x = Math.min(x, center.x - centerGap - label.width);
      }
      label.rect = new Rect(x, label._defaultRect.y, label.width, label.height);
      if ((label._defaultOuterPt.y + (label.height / 2)) < center.y) {
        upperLabels.push(label);
      } else {
        lowerLabels.push(label);
      }
    }

    this._placeUpperHalf(upperLabels);
    this._placeLowerHalf(lowerLabels, upperLabels);
  }

  _placeUpperHalf(labels) {
    if (labels.length === 0) {
      return;
    }

    const gap = 2;
    labels.sort((a, b) => {
      const delta = b._defaultOuterPt.y - a._defaultOuterPt.y;
      return (delta !== 0) ? delta : a.bp - b.bp;
    });

    for (let i = 1, len = labels.length; i < len; i++) {
      const previousLabel = labels[i - 1];
      const label = labels[i];
      if (!this._canResetLabel(label)) {
        const maxY = previousLabel.rect.y - label.height - gap;
        if (label.rect.y > maxY) {
          label.rect.y = maxY;
        }
      }
      let blockingLabel;
      do {
        blockingLabel = this._blockingPlacedLabel(label, labels, i);
        if (blockingLabel) {
          label.rect.y = blockingLabel.rect.y - label.height - gap;
        }
      } while (blockingLabel);
    }
  }

  _blockingPlacedLabel(label, labels, labelIndex, additionalLabels = []) {
    for (let i = 0, len = additionalLabels.length; i < len; i++) {
      const placedLabel = additionalLabels[i];
      if (this._labelsConflict(label, placedLabel)) {
        return placedLabel;
      }
    }
    for (let i = 0; i < labelIndex; i++) {
      const placedLabel = labels[i];
      if (this._labelsConflict(label, placedLabel)) {
        return placedLabel;
      }
    }
    return undefined;
  }

  _labelsConflict(label, placedLabel) {
    return this._rectsOverlap(label.rect, placedLabel.rect);
  }

  _canResetLabel(label) {
    return label.width <= 80;
  }

  _rectsOverlap(rect1, rect2) {
    const gap = 4;
    return rect1.left <= (rect2.right + gap) && rect2.left <= (rect1.right + gap) && rect1.top <= rect2.bottom && rect2.top <= rect1.bottom;
  }

  _placeLowerHalf(labels, additionalLabels = []) {
    if (labels.length === 0) {
      return;
    }

    const gap = 2;
    labels.sort((a, b) => {
      const delta = a._defaultOuterPt.y - b._defaultOuterPt.y;
      return (delta !== 0) ? delta : a.bp - b.bp;
    });

    const startIndex = (additionalLabels.length === 0) ? 1 : 0;
    for (let i = startIndex, len = labels.length; i < len; i++) {
      const previousLabel = labels[i - 1];
      const label = labels[i];
      if (previousLabel && !this._canResetLabel(label)) {
        const minY = previousLabel.rect.bottom + gap;
        if (label.rect.y < minY) {
          label.rect.y = minY;
        }
      }
      let blockingLabel;
      do {
        blockingLabel = this._blockingPlacedLabel(label, labels, i, additionalLabels);
        if (blockingLabel) {
          label.rect.y = blockingLabel.rect.bottom + gap;
        }
      } while (blockingLabel);
    }
  }

  _lineAttachmentForPoint(point, center) {
    return (point.x >= center.x) ? 9 : 3;
  }

  _updateLinePoints(label, outerOffset) {
    const innerRadius = outerOffset + this._labelLineMarginInner;
    const innerPt = this.canvas.pointForBp(label.bp, innerRadius);
    const attachPt = label.attachementPt;
    const minRadius = innerRadius - 0.5;

    if (!this._segmentCrossesRadius(innerPt, attachPt, minRadius)) {
      label.linePoints = undefined;
      return;
    }

    let elbowRadius = this.rectCenterOffset();
    let elbowPt;
    let attempts = 0;
    do {
      elbowPt = this.canvas.pointForBp(label.bp, elbowRadius);
      if (!this._segmentCrossesRadius(elbowPt, attachPt, minRadius)) {
        label.linePoints = [elbowPt, attachPt];
        return;
      }
      elbowRadius += label.height;
      attempts += 1;
    } while (attempts < 6);

    label.linePoints = [elbowPt, attachPt];
  }

  _segmentCrossesRadius(startPt, endPt, minRadius) {
    return this._distanceToSegment(this._canvasCenter(), startPt, endPt) < minRadius;
  }

  _distanceToSegment(point, startPt, endPt) {
    const dx = endPt.x - startPt.x;
    const dy = endPt.y - startPt.y;
    if (dx === 0 && dy === 0) {
      return Math.hypot(point.x - startPt.x, point.y - startPt.y);
    }
    const t = ((point.x - startPt.x) * dx + (point.y - startPt.y) * dy) / ((dx * dx) + (dy * dy));
    const clampedT = Math.max(0, Math.min(1, t));
    const closestX = startPt.x + (clampedT * dx);
    const closestY = startPt.y + (clampedT * dy);
    return Math.hypot(point.x - closestX, point.y - closestY);
  }

  _canvasCenter() {
    return {
      x: this.viewer.layout.scale.x(0),
      y: this.viewer.layout.scale.y(0)
    };
  }

}

export default LabelPlacementNew;
