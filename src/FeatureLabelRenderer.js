//////////////////////////////////////////////////////////////////////////////
// FeatureLabelRenderer
//////////////////////////////////////////////////////////////////////////////

// Based on the inline feature-label implementation by Paul Stothard
// (@paulstothard).

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

import Color from './Color';

const ELLIPSIS = '…';
const MIN_TRUNCATED_CHARACTERS = 3;
const FONT_SIZE_STEPS_PER_PIXEL = 10;
const FIT_TOLERANCE = 0.01;
const INLINE_LABEL_MIN_FONT_SIZE = 8;
const INLINE_LABEL_PADDING = 4;
const OPAQUE_WHITE = new Color('white');
const MAX_COLOR_CACHE_SIZE = 128;

function fontSizeThatDoesNotExceed(size) {
  return Math.floor((size + 1e-9) * FONT_SIZE_STEPS_PER_PIXEL) /
    FONT_SIZE_STEPS_PER_PIXEL;
}

/**
 * Fit and draw feature names inside their rendered feature bodies. Public
 * configuration remains on Annotation.
 * @private
 */
class FeatureLabelRenderer {

  constructor(annotation) {
    this.annotation = annotation;
    this._glyphWidthCache = new WeakMap();
    this._automaticColorCache = new Map();
    this._slotPlacements = new Map();
    this._trackBoundsBySlot = undefined;
    this._acceptedInlineFeatures = undefined;
  }

  get viewer() {
    return this.annotation.viewer;
  }

  get canvas() {
    return this.annotation.canvas;
  }

  /**
   * Start a new map draw. Placement results are draw-local so zoom and data
   * updates cannot leave stale geometry behind.
   * @private
   */
  beginDraw() {
    this._slotPlacements.clear();
    this._trackBoundsBySlot = undefined;
    this._acceptedInlineFeatures = undefined;
  }

  _splitRange(start, stop) {
    if (start <= stop) { return [[start, stop]]; }
    return [[start, this.viewer.sequence.length], [1, stop]];
  }

  _featureRanges(feature) {
    if (!feature.hasLocations) {
      return this._splitRange(feature.mapStart, feature.mapStop);
    }

    const ranges = [];
    for (const location of feature.locations) {
      const start = location[0] + feature.contig.lengthOffset;
      const stop = location[1] + feature.contig.lengthOffset;
      ranges.push(...this._splitRange(start, stop));
    }
    return ranges;
  }

  _visibleSegments(feature, visibleRange) {
    const segments = [];
    const visibleSegments = this._splitRange(visibleRange.start, visibleRange.stop);
    for (const [featureStart, featureStop] of this._featureRanges(feature)) {
      for (const [visibleStart, visibleStop] of visibleSegments) {
        const start = Math.max(featureStart, visibleStart);
        const stop = Math.min(featureStop, visibleStop);
        if (start <= stop) {
          const startClipped = start > featureStart;
          const stopClipped = stop < featureStop;
          const startEdge = startClipped ? start : start - 0.5;
          const stopEdge = stopClipped ? stop : stop + 0.5;
          segments.push({
            start,
            stop,
            startEdge,
            length: stopEdge - startEdge,
            startClipped,
            stopClipped,
          });
        }
      }
    }

    // A circular label can remain continuous across the map origin. Linear
    // maps must keep the two edge segments separate.
    if (this.viewer.format === 'circular' && !feature.hasLocations && feature.mapStart > feature.mapStop) {
      const firstSegment = segments.find(segment => segment.start === 1);
      const lastSegment = segments.find(segment => segment.stop === this.viewer.sequence.length);
      if (firstSegment && lastSegment && firstSegment !== lastSegment) {
        const mergedSegment = {
          start: lastSegment.start,
          stop: firstSegment.stop,
          startEdge: lastSegment.startEdge,
          length: lastSegment.length + firstSegment.length,
          wrapped: true,
          startClipped: lastSegment.startClipped,
          stopClipped: firstSegment.stopClipped,
        };
        return segments
          .filter(segment => segment !== firstSegment && segment !== lastSegment)
          .concat(mergedSegment);
      }
    }
    return segments;
  }

  _segmentContains(segment, bp) {
    return segment.wrapped ?
      (bp >= segment.start || bp <= segment.stop) :
      (bp >= segment.start && bp <= segment.stop);
  }

  _normalizeBp(bp) {
    const mapLength = this.viewer.sequence.length;
    while (bp > mapLength) { bp -= mapLength; }
    while (bp < 1) { bp += mapLength; }
    return bp;
  }

  _isOnBackbone(slot) {
    return slot?.position === 'along' && Math.abs(slot.bbOffset) < 0.01;
  }

  _backgroundColor(feature, slot, bp) {
    if (!this.viewer.backbone.visible || !this._isOnBackbone(slot)) {
      return this.viewer.settings.backgroundColor;
    }
    const sequence = this.viewer.sequence;
    const contig = sequence.hasMultipleContigs ? sequence.contigForBp(bp) : feature.contig;
    return this.viewer.backbone.colorForContig(contig || feature.contig);
  }

  _labelColor(feature, slot, bp) {
    if (this.annotation.inlineLabelColor) { return this.annotation.inlineLabelColor; }
    if (this.annotation.color) { return this.annotation.color; }

    // Feature colors can be translucent, so choose text against the color that
    // is visible after the feature is composited over its rendered background.
    const featureColor = feature.color;
    const backgroundColor = this._backgroundColor(feature, slot, bp);
    const cacheKey = `${featureColor.rgbaString}\n${backgroundColor.rgbaString}`;
    let color = this._automaticColorCache.get(cacheKey);
    if (!color) {
      const renderedColor = featureColor.compositeOver(backgroundColor).compositeOver(OPAQUE_WHITE);
      color = renderedColor.contrastColor();
      if (this._automaticColorCache.size >= MAX_COLOR_CACHE_SIZE) {
        this._automaticColorCache.clear();
      }
      this._automaticColorCache.set(cacheKey, color);
    }
    return color;
  }

  _measurementFor(feature) {
    const ctx = this.canvas.context('map');
    const label = feature.label;
    const font = label.font;
    const name = String(feature.name);
    const cacheKey = `${font.css}\n${name}`;
    let measurement = this._glyphWidthCache.get(label);
    if (!measurement || measurement.key !== cacheKey) {
      ctx.font = font.css;
      const characters = Array.from(name);
      const widths = characters.map(character => Math.max(1, ctx.measureText(character).width));
      measurement = {
        key: cacheKey,
        characters,
        widths,
        curvedWidth: widths.reduce((sum, width) => sum + width, 0),
        linearWidth: label.width || ctx.measureText(name).width,
      };
      this._glyphWidthCache.set(label, measurement);
    }
    if (this.annotation.inlineLabelAllowTruncation &&
      measurement.characters.length > MIN_TRUNCATED_CHARACTERS) {
      if (!measurement.prefixWidths) {
        measurement.prefixWidths = [0];
        for (const width of measurement.widths) {
          measurement.prefixWidths.push(
            measurement.prefixWidths[measurement.prefixWidths.length - 1] + width
          );
        }
      }
      if (measurement.ellipsisWidth === undefined) {
        ctx.font = font.css;
        measurement.ellipsisWidth = Math.max(1, ctx.measureText(ELLIPSIS).width);
      }
    }
    return measurement;
  }

  _baseTextWidth(measurement) {
    return this.viewer.format === 'circular' ? measurement.curvedWidth : measurement.linearWidth;
  }

  _minimumBaseTextWidth(measurement) {
    const fullWidth = this._baseTextWidth(measurement);
    if (!this.annotation.inlineLabelAllowTruncation ||
      measurement.characters.length <= MIN_TRUNCATED_CHARACTERS) {
      return fullWidth;
    }
    const truncatedWidth = measurement.prefixWidths[MIN_TRUNCATED_CHARACTERS] +
      measurement.ellipsisWidth;
    return Math.min(fullWidth, truncatedWidth);
  }

  _textPlan(feature, availableWidth, availableHeight, measurement) {
    const annotation = this.annotation;
    const font = feature.label.font;
    const allowShrinking = annotation.inlineLabelAllowShrinking;
    const naturalSize = font.size;
    const minimumSize = allowShrinking ?
      Math.min(naturalSize, INLINE_LABEL_MIN_FONT_SIZE) :
      naturalSize;
    const maximumSize = allowShrinking ?
      Math.min(naturalSize, fontSizeThatDoesNotExceed(availableHeight)) :
      naturalSize;
    const fullBaseWidth = this._baseTextWidth(measurement);
    if (maximumSize < minimumSize || fullBaseWidth <= 0 ||
      (!allowShrinking && availableHeight < naturalSize)) { return; }

    const maximumScale = maximumSize / naturalSize;
    if ((fullBaseWidth * maximumScale) <= (availableWidth + FIT_TOLERANCE)) {
      return {
        text: String(feature.name),
        fontSize: maximumSize,
        characters: measurement.characters,
        widths: measurement.widths,
        textWidth: fullBaseWidth * maximumScale,
        widthScale: maximumScale,
      };
    }

    if (allowShrinking) {
      const fittedSize = Math.min(
        maximumSize,
        fontSizeThatDoesNotExceed(naturalSize * availableWidth / fullBaseWidth)
      );
      if (fittedSize >= minimumSize) {
        const scale = fittedSize / naturalSize;
        return {
          text: String(feature.name),
          fontSize: fittedSize,
          characters: measurement.characters,
          widths: measurement.widths,
          textWidth: fullBaseWidth * scale,
          widthScale: scale,
        };
      }
    }

    if (!annotation.inlineLabelAllowTruncation ||
      measurement.characters.length <= MIN_TRUNCATED_CHARACTERS) { return; }

    const fontSize = allowShrinking ? minimumSize : naturalSize;
    const maximumBaseWidth = availableWidth * naturalSize / fontSize;
    let characterCount = measurement.characters.length - 1;
    while (characterCount >= MIN_TRUNCATED_CHARACTERS &&
      (measurement.prefixWidths[characterCount] + measurement.ellipsisWidth) >
        (maximumBaseWidth + FIT_TOLERANCE)) {
      characterCount -= 1;
    }
    if (characterCount < MIN_TRUNCATED_CHARACTERS) { return; }

    const characters = measurement.characters.slice(0, characterCount).concat(ELLIPSIS);
    const widths = measurement.widths.slice(0, characterCount).concat(measurement.ellipsisWidth);
    const scale = fontSize / naturalSize;
    const baseTextWidth = measurement.prefixWidths[characterCount] + measurement.ellipsisWidth;
    return {
      text: characters.join(''),
      fontSize,
      characters,
      widths,
      textWidth: baseTextWidth * scale,
      widthScale: scale,
      truncated: true,
    };
  }

  _terminalArrow(feature) {
    if (!['arrow', 'auto'].includes(feature.decoration)) { return; }

    if (feature.hasLocations) {
      const location = feature.isDirect() ?
        feature.locations[feature.locations.length - 1] :
        feature.locations[0];
      return {
        tip: (feature.isDirect() ? location[1] : location[0]) + feature.contig.lengthOffset,
        length: location[1] - location[0] + 1,
      };
    }
    return {
      tip: feature.isDirect() ? feature.mapStop : feature.mapStart,
      length: feature.length,
    };
  }

  _usableSegment(feature, segment, centerOffset, width, pixelsPerBp) {
    let start = segment.startEdge ?? segment.start - 0.5;
    let stop = start + segment.length;
    const arrow = this._terminalArrow(feature);
    if (!arrow || !this._segmentContains(segment, arrow.tip)) { return {start, stop}; }

    const arrowHeadLength = this.canvas.arrowHeadLengthPixels({
      autoArrow: feature.decoration === 'auto',
      centerOffset,
      featureLengthBp: arrow.length,
      width,
    });
    const arrowHeadLengthBp = arrowHeadLength / pixelsPerBp;
    if (feature.isDirect()) {
      stop -= arrowHeadLengthBp;
    } else {
      start += arrowHeadLengthBp;
    }
    return {start, stop};
  }

  metricsFor(feature, centerOffset, slotThickness, visibleRange, slot) {
    const name = feature.name === undefined || feature.name === null ? '' : String(feature.name);
    if (!name.trim() || !feature.visible || !visibleRange) { return; }
    if (this.annotation.onlyDrawFavorites && !feature.favorite) { return; }
    if (this._isOnBackbone(slot) && this.viewer.sequence.isDetailReadable()) { return; }

    const adjustedCenterOffset = feature.adjustedCenterOffset(centerOffset, slotThickness);
    const adjustedWidth = feature.adjustedWidth(slotThickness);
    const padding = INLINE_LABEL_PADDING;
    const availableHeight = adjustedWidth - (padding * 2);
    const font = feature.label.font;
    const minimumSize = this.annotation.inlineLabelAllowShrinking ?
      Math.min(font.size, INLINE_LABEL_MIN_FONT_SIZE) :
      font.size;
    if (availableHeight < minimumSize) { return; }

    const pixelsPerBp = this.canvas.pixelsPerBp(adjustedCenterOffset);
    if (!Number.isFinite(pixelsPerBp) || pixelsPerBp <= 0) { return; }

    // Reject labels that cannot fit even before clipping or arrowhead space is
    // considered. The common non-truncating path uses Annotation's maintained
    // label width and avoids individual glyph measurements for narrow features.
    const maximumFeatureWidth = (feature.length * pixelsPerBp) - (padding * 2);
    const canTruncate = this.annotation.inlineLabelAllowTruncation &&
      name.length > MIN_TRUNCATED_CHARACTERS;
    let measurement;
    let minimumBaseTextWidth = feature.label.width;
    if (canTruncate) {
      // Every measured glyph is clamped to at least one pixel. This cheap
      // lower bound retains the overview-scale rejection path even when
      // truncation is enabled.
      const absoluteMinimumWidth = (MIN_TRUNCATED_CHARACTERS + 1) * minimumSize / font.size;
      if (maximumFeatureWidth < absoluteMinimumWidth) { return; }
      measurement = this._measurementFor(feature);
      minimumBaseTextWidth = this._minimumBaseTextWidth(measurement);
    }
    const minimumTextWidth = minimumBaseTextWidth * minimumSize / font.size;
    if (maximumFeatureWidth < minimumTextWidth) { return; }

    measurement ||= this._measurementFor(feature);
    const segments = this._visibleSegments(feature, visibleRange)
      .sort((first, second) => (second.length - first.length) || (first.start - second.start));

    for (const segment of segments) {
      const usableSegment = this._usableSegment(
        feature,
        segment,
        adjustedCenterOffset,
        adjustedWidth,
        pixelsPerBp
      );
      const availableWidth = ((usableSegment.stop - usableSegment.start) * pixelsPerBp) - (padding * 2);
      if (availableWidth <= 0) { continue; }
      const textPlan = this._textPlan(feature, availableWidth, availableHeight, measurement);
      if (!textPlan) { continue; }

      // When a feature spans the viewport, keep its label on the exact map
      // center instead of an integer base-pair approximation. The float
      // visible range handles one-sided clipping continuously as well.
      let bp = this._normalizeBp((usableSegment.start + usableSegment.stop) / 2);
      if (segment.startClipped && segment.stopClipped) {
        const viewportBp = this._normalizeBp(this.viewer.bpFloat);
        if (Number.isFinite(viewportBp) && this._segmentContains(segment, viewportBp)) {
          bp = viewportBp;
        }
      }
      return {
        bp,
        centerOffset: adjustedCenterOffset,
        availableWidth,
        pixelsPerBp,
        color: this._labelColor(feature, slot, bp),
        ...textPlan,
      };
    }
  }

  _labelBounds(metrics) {
    const padding = INLINE_LABEL_PADDING;
    return {
      bp: metrics.bp,
      halfBp: ((metrics.textWidth / 2) + padding) / metrics.pixelsPerBp,
      innerOffset: metrics.centerOffset - (metrics.fontSize / 2) - padding,
      outerOffset: metrics.centerOffset + (metrics.fontSize / 2) + padding,
    };
  }

  _boundsOverlap(first, second) {
    const radialOverlap = first.innerOffset <= second.outerOffset &&
      second.innerOffset <= first.outerOffset;
    if (!radialOverlap) { return false; }

    let bpDistance = Math.abs(first.bp - second.bp);
    if (this.viewer.format === 'circular') {
      bpDistance = Math.min(bpDistance, this.viewer.sequence.length - bpDistance);
    }
    return bpDistance <= (first.halfBp + second.halfBp);
  }

  _trackLabelBoundsForSlot(slot) {
    if (!slot) { return []; }
    if (!this._trackBoundsBySlot) {
      this._trackBoundsBySlot = new Map();
      const renderer = this.viewer.layout._trackLabelRenderer;
      for (const bounds of renderer.exclusionBounds()) {
        const slotBounds = this._trackBoundsBySlot.get(bounds.slot) || [];
        slotBounds.push(bounds);
        this._trackBoundsBySlot.set(bounds.slot, slotBounds);
      }
    }
    return this._trackBoundsBySlot.get(slot) || [];
  }

  _nonOverlappingPlacements(features, centerOffset, slotThickness, visibleRange, slot) {
    const candidates = [];
    for (const feature of features) {
      const metrics = this.metricsFor(feature, centerOffset, slotThickness, visibleRange, slot);
      if (metrics) {
        candidates.push({feature, metrics, bounds: this._labelBounds(metrics)});
      }
    }

    // Match outside-label priorities and remain deterministic regardless of
    // the order used to paint feature bodies.
    candidates.sort((first, second) => {
      if (first.feature.favorite !== second.feature.favorite) {
        return first.feature.favorite ? -1 : 1;
      }
      return (second.feature.length - first.feature.length) ||
        (first.feature.mapStart - second.feature.mapStart);
    });

    const placements = new Map();
    const placedBounds = this._trackLabelBoundsForSlot(slot).slice();
    for (const candidate of candidates) {
      if (placedBounds.some(bounds => this._boundsOverlap(candidate.bounds, bounds))) { continue; }
      placements.set(candidate.feature, candidate.metrics);
      placedBounds.push(candidate.bounds);
    }
    return placements;
  }

  _placementsForSlot(slot, visibleRange) {
    let placements = this._slotPlacements.get(slot);
    if (placements) { return placements; }
    if (!visibleRange) { return new Map(); }

    // Slot drawing intentionally uses an integer-expanded range. Refine only
    // label placement to a floating-point range so panning at more than one
    // pixel per base pair does not move text in whole-base jumps.
    const needsFloatRange = !visibleRange.isMapLength() &&
      this.canvas.pixelsPerBp(slot.centerOffset) > 1;
    const placementRange = !needsFloatRange ? visibleRange :
      (this.canvas.visibleRangeForCenterOffset(slot.centerOffset, {
        margin: slot.thickness,
        float: true,
      }) || visibleRange);

    // Placement always considers the complete visible set. A fast draw may
    // paint a sample, but its collision decisions must match the following
    // full draw.
    const visibleFeatures = slot._featureNCList.find(visibleRange.start, visibleRange.stop);
    placements = this._nonOverlappingPlacements(
      visibleFeatures,
      slot.centerOffset,
      slot.thickness,
      placementRange,
      slot
    );
    this._slotPlacements.set(slot, placements);
    return placements;
  }

  /**
   * Return visible features with accepted inline-label placements.
   * @return {Set<Feature>} Features that will be labeled inline.
   * @private
   */
  visibleInlineFeatures() {
    if (this._acceptedInlineFeatures) { return this._acceptedInlineFeatures; }

    const features = new Set();
    for (const slot of this.viewer.slots()) {
      if (!slot.hasFeatures || !slot.visible || !slot.track.visible || slot.thickness <= 0) { continue; }
      const visibleRange = this.canvas.visibleRangeForCenterOffset(slot.centerOffset, {margin: slot.thickness});
      if (!visibleRange) { continue; }
      for (const feature of this._placementsForSlot(slot, visibleRange).keys()) {
        features.add(feature);
      }
    }
    this._acceptedInlineFeatures = features;
    return features;
  }

  _drawStraightLabel(ctx, feature, metrics) {
    const point = this.canvas.pointForBp(metrics.bp, metrics.centerOffset);
    const font = feature.label.font;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.font = font.css;
    ctx.fillStyle = metrics.color.rgbaString;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (metrics.widthScale !== 1) {
      // Keep the baseline origin stable while the label changes size.
      ctx.scale(metrics.widthScale, metrics.widthScale);
    }
    ctx.fillText(metrics.text, 0, 0);
    ctx.restore();
  }

  _drawCurvedLabel(feature, metrics, layer = 'map') {
    const font = feature.label.font;
    this.canvas.drawTextAlongArc({
      layer,
      bp: metrics.bp,
      centerOffset: metrics.centerOffset,
      characters: metrics.characters,
      widths: metrics.widths,
      widthScale: metrics.widthScale,
      totalWidth: metrics.textWidth,
      font: font.css,
      color: metrics.color.rgbaString,
    });
  }

  /**
   * Draw accepted labels for feature bodies painted in this slot pass.
   * @param {Feature[]} features - Features painted by the slot.
   * @param {Number} centerOffset - Slot center offset.
   * @param {Number} slotThickness - Slot thickness.
   * @param {CGRange} visibleRange - Visible slot range.
   * @param {Slot} slot - Slot being drawn.
   * @param {String} [layer='map'] - Canvas layer on which to draw the labels.
   * @private
   */
  draw(features, centerOffset, slotThickness, visibleRange, slot, layer = 'map') {
    if (!['inline', 'auto'].includes(this.annotation.labelPosition) || !visibleRange) { return; }
    const ctx = this.canvas.context(layer);
    const placements = slot ?
      this._placementsForSlot(slot, visibleRange) :
      this._nonOverlappingPlacements(features, centerOffset, slotThickness, visibleRange);

    for (const feature of features) {
      const metrics = placements.get(feature);
      if (!metrics) { continue; }
      if (this.viewer.format === 'circular') {
        this._drawCurvedLabel(feature, metrics, layer);
      } else {
        this._drawStraightLabel(ctx, feature, metrics);
      }
    }
  }

}

export default FeatureLabelRenderer;
