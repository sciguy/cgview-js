//////////////////////////////////////////////////////////////////////////////
// Label Placement Test
//////////////////////////////////////////////////////////////////////////////

import Rect from './Rect';
import CGArray from './CGArray';
import utils from './Utils';

/**
 * LabelPlacementTest ...
 *  is the default method to find where to place feature
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
 *   - have placeLabels method that take an aray of labels to place
 *   - for each label
 *     - add rect
 *     - attchement point
 *
 * @private
 */
class LabelPlacementTest {

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
   * @return {String} - 'LabelPlacementTest'
   */
  toString() {
    return 'LabelPlacementTest';
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


    // Only one dimension for now
    function intersects(object1, object2) {
      // return label1.rect.intersects(label2.rect);
      return object1.left < object2.right && object1.right > object2.left
    }

    function collide(object1, object2) {
      console.log('collide', object1, object2);
    }

    let interactions = [];

    function onOverlapX(object1, object2) {
      // just check for y
      if (object1.rect.top < object2.rect.bottom
       && object1.rect.bottom > object2.rect.top) {
        // collide(object1, object2);
        interactions.push([object1, object2]);
        object1.rect.x -= 1;
        object2.rect.x += 2;
        object1.rect.y -= 1;
        object2.rect.y -= 3;
      }
    }

    let edges = [];
    // Object: {object: label, x: number, isLeft: boolean}

    const placedRects = new CGArray();
    // Make all normal rects
    for (let i = 0, len = labels.length; i < len; i++) {
      label = labels[i];
      bp = label.bp;
      lineLength = this.initialLabelLineLength;
      const outerPt = canvas.pointForBp(bp, this.rectCenterOffset(lineLength));
      const rectOrigin = utils.rectOriginForAttachementPoint(outerPt, label.lineAttachment, label.width, label.height);
      label.rect = new Rect(rectOrigin.x, rectOrigin.y, label.width, label.height);
      placedRects.push(label.rect);
      label.attachementPt = label.rect.ptForClockPosition(label.lineAttachment);

      edges.push({object: label, x: label.rect.left, isLeft: true});
      edges.push({object: label, x: label.rect.right, isLeft: false});
    }


    let loopCount = 0;
    const maxLoops = 50;
    do {
      interactions = [];
      loopCount++;

      // Sort edges
      edges.sort((a, b) => {
        if (a.x === b.x) {
          return a.isLeft ? -1 : 1;
        }
        return a.x - b.x;
      });

      const touching = new Set();
      for (const edge of edges) {
        if (edge.isLeft) {
          // entering an object
          // the new object is overlapping with the existing ones
          for (const other of touching) {
            onOverlapX(other, edge.object);
          }
          touching.add(edge.object);
        } else {
          // exiting an object
          touching.delete(edge.object);
        }
      }

      console.log('Touching', touching.size);
      console.log('Interactions', interactions.length);

    } while (interactions.length > 0 && loopCount < maxLoops);

    for (let i = 0, len = labels.length; i < len; i++) {
      label = labels[i];
      label.attachementPt = label.rect.ptForClockPosition(label.lineAttachment);
    }


      // do {
      //   const outerPt = canvas.pointForBp(bp, this.rectCenterOffset(lineLength));
      //   const rectOrigin = utils.rectOriginForAttachementPoint(outerPt, label.lineAttachment, label.width, label.height);
      //   label.rect = new Rect(rectOrigin.x, rectOrigin.y, label.width, label.height);
      //   overlappingRect = label.rect.overlap(placedRects);
      //   lineLength += label.height;
      // } while (overlappingRect);
  }


}

export default LabelPlacementTest;


// placeLabels(labels, outerOffset) {
//   const canvas = this.canvas;
//   let label, bp, lineLength, overlappingRect;
//   this._rectOffsetWithoutLineLength = outerOffset + this._labelLineMarginInner + this._labelLineMarginOuter;

//   const placedRects = new CGArray();
//   for (let i = 0, len = labels.length; i < len; i++) {
//     label = labels[i];
//     bp = label.bp;
//     lineLength = this.initialLabelLineLength;
//     do {
//       const outerPt = canvas.pointForBp(bp, this.rectCenterOffset(lineLength));
//       const rectOrigin = utils.rectOriginForAttachementPoint(outerPt, label.lineAttachment, label.width, label.height);
//       label.rect = new Rect(rectOrigin.x, rectOrigin.y, label.width, label.height);
//       overlappingRect = label.rect.overlap(placedRects);
//       lineLength += label.height;
//     } while (overlappingRect);
//     placedRects.push(label.rect);
//     label.attachementPt = label.rect.ptForClockPosition(label.lineAttachment);
//   }
//     console.log(labels[0]?.rect);
// }

