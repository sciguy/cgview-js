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

const OPAQUE_WHITE = new Color('white');
const MAX_COLOR_CACHE_SIZE = 128;

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
          segments.push({start, stop, length: stop - start + 1});
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
          length: lastSegment.length + firstSegment.length,
          wrapped: true,
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
    if (!this._isOnBackbone(slot)) {
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
    return measurement;
  }

  _baseTextWidth(measurement) {
    return this.viewer.format === 'circular' ? measurement.curvedWidth : measurement.linearWidth;
  }

  _textPlan(feature, availableWidth, availableHeight, measurement) {
    const font = feature.label.font;
    const naturalSize = font.size;
    const minimumSize = Math.min(naturalSize, this.annotation.inlineLabelMinFontSize);
    const maximumSize = Math.min(naturalSize, Math.floor(availableHeight));
    const baseTextWidth = this._baseTextWidth(measurement);
    if (maximumSize < minimumSize || baseTextWidth <= 0) { return; }

    const fittedSize = Math.min(
      maximumSize,
      Math.floor(naturalSize * availableWidth / baseTextWidth)
    );
    if (fittedSize < minimumSize) { return; }

    const scale = fittedSize / naturalSize;
    return {
      text: String(feature.name),
      fontSize: fittedSize,
      characters: measurement.characters,
      widths: measurement.widths,
      textWidth: baseTextWidth * scale,
      widthScale: scale,
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
    let start = segment.start - 0.5;
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
    const padding = this.annotation.inlineLabelPadding;
    const availableHeight = adjustedWidth - (padding * 2);
    const font = feature.label.font;
    const minimumSize = Math.min(font.size, this.annotation.inlineLabelMinFontSize);
    if (availableHeight < minimumSize) { return; }

    const pixelsPerBp = this.canvas.pixelsPerBp(adjustedCenterOffset);
    if (!Number.isFinite(pixelsPerBp) || pixelsPerBp <= 0) { return; }

    // Reject labels that cannot fit even before clipping or arrowhead space is
    // considered. Label widths are maintained by Annotation, so this avoids
    // glyph measurement and segment allocation for obviously narrow features.
    const minimumTextWidth = feature.label.width * minimumSize / font.size;
    const maximumFeatureWidth = (feature.length * pixelsPerBp) - (padding * 2);
    if (maximumFeatureWidth < minimumTextWidth) { return; }

    const measurement = this._measurementFor(feature);
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

      const bp = this._normalizeBp((usableSegment.start + usableSegment.stop) / 2);
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
    const padding = this.annotation.inlineLabelPadding;
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

    // Match external-label priorities and remain deterministic regardless of
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

    // Placement always considers the complete visible set. A fast draw may
    // paint a sample, but its collision decisions must match the following
    // full draw.
    const visibleFeatures = slot._featureNCList.find(visibleRange.start, visibleRange.stop);
    placements = this._nonOverlappingPlacements(
      visibleFeatures,
      slot.centerOffset,
      slot.thickness,
      visibleRange,
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
    ctx.font = font.cssScaled(metrics.widthScale);
    ctx.fillStyle = metrics.color.rgbaString;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(metrics.text, 0, 0);
    ctx.restore();
  }

  _drawCurvedLabel(feature, metrics) {
    const font = feature.label.font;
    this.canvas.drawTextAlongArc({
      bp: metrics.bp,
      centerOffset: metrics.centerOffset,
      characters: metrics.characters,
      widths: metrics.widths,
      widthScale: metrics.widthScale,
      totalWidth: metrics.textWidth,
      font: font.cssScaled(metrics.widthScale),
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
   * @private
   */
  draw(features, centerOffset, slotThickness, visibleRange, slot) {
    if (!['inline', 'both'].includes(this.annotation.labelPosition) || !visibleRange) { return; }
    const ctx = this.canvas.context('map');
    const placements = slot ?
      this._placementsForSlot(slot, visibleRange) :
      this._nonOverlappingPlacements(features, centerOffset, slotThickness, visibleRange);

    for (const feature of features) {
      const metrics = placements.get(feature);
      if (!metrics) { continue; }
      if (this.viewer.format === 'circular') {
        this._drawCurvedLabel(feature, metrics);
      } else {
        this._drawStraightLabel(ctx, feature, metrics);
      }
    }
  }

}

export default FeatureLabelRenderer;
