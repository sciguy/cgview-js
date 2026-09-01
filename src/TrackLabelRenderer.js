//////////////////////////////////////////////////////////////////////////////
// TrackLabelRenderer
//////////////////////////////////////////////////////////////////////////////

// Based on the zoomed track-label implementation by Paul Stothard
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
import Font from './Font';

// Feature flag for including plot tracks in close-zoom track identification.
const IncludePlotTracks = true;
const ELLIPSIS = '…';
const MIN_ZOOM_FACTOR = 4;
const EDGE_GUTTER = 12;
const MAX_LABEL_WIDTH = 150;
const MIN_TRUNCATED_CHARACTERS = 4;

/**
 * Draw compact track identifiers once individual lanes are readable.
 * Labels align just inside the leading edge of the visible map range, with one
 * label per visible side of a track.
 *
 * @private
 */
class TrackLabelRenderer {

  constructor(layout) {
    this.layout = layout;
    this.font = new Font('sans-serif, bold, 10');
    this._measurementCache = new Map();
  }

  get viewer() {
    return this.layout.viewer;
  }

  get canvas() {
    return this.layout.canvas;
  }

  isAtLabelZoom() {
    return this.viewer.zoomFactor >= MIN_ZOOM_FACTOR;
  }

  isVisibleAtCurrentZoom() {
    return this.viewer.settings?.showTrackLabels && this.isAtLabelZoom();
  }

  _measurementFor(text, ctx) {
    const key = `${this.font.css}\n${text}`;
    let measurement = this._measurementCache.get(key);
    if (!measurement) {
      ctx.font = this.font.css;
      const characters = Array.from(text);
      const widths = characters.map(character => Math.max(1, ctx.measureText(character).width));
      measurement = {
        characters,
        widths,
        totalWidth: widths.reduce((sum, width) => sum + width, 0),
      };
      this._measurementCache.set(key, measurement);
    }
    return measurement;
  }

  _fittedMeasurement(text, ctx) {
    const measurement = this._measurementFor(text, ctx);
    const maximumWidth = Math.min(MAX_LABEL_WIDTH, this.canvas.width * 0.22);
    if (measurement.totalWidth <= maximumWidth) { return measurement; }

    const ellipsisWidth = this._measurementFor(ELLIPSIS, ctx).totalWidth;
    const characters = [];
    const widths = [];
    let totalWidth = ellipsisWidth;
    for (let index = 0; index < measurement.characters.length; index += 1) {
      const width = measurement.widths[index];
      if (totalWidth + width > maximumWidth) { break; }
      characters.push(measurement.characters[index]);
      widths.push(width);
      totalWidth += width;
    }
    if (characters.length < MIN_TRUNCATED_CHARACTERS) { return; }
    characters.push(ELLIPSIS);
    widths.push(ellipsisWidth);
    return {characters, widths, totalWidth};
  }

  _groupsForTrack(track) {
    const groups = new Map();
    for (const slot of track.slots()) {
      if (!slot.visible || !Number.isFinite(slot.thickness) || slot.thickness <= 0) { continue; }
      const key = slot.position;
      let group = groups.get(key);
      if (!group) {
        group = {position: key, slots: [], innerOffset: Infinity, outerOffset: -Infinity};
        groups.set(key, group);
      }
      group.slots.push(slot);
      group.innerOffset = Math.min(group.innerOffset, slot.centerOffset - (slot.thickness / 2));
      group.outerOffset = Math.max(group.outerOffset, slot.centerOffset + (slot.thickness / 2));
    }
    return [...groups.values()].map(group => ({
      ...group,
      centerOffset: (group.innerOffset + group.outerOffset) / 2,
      thickness: group.outerOffset - group.innerOffset,
    }));
  }

  _sequenceDetailIsReadable() {
    const sequence = this.viewer.sequence;
    const pixelsPerBp = this.viewer.backbone.pixelsPerBp();
    const naturalBaseWidth = sequence.bpSpacing - sequence.bpMargin;
    if (!sequence.visible || !Number.isFinite(pixelsPerBp) || naturalBaseWidth <= 0) { return false; }
    const scaleFactor = Math.min(1, pixelsPerBp / naturalBaseWidth);
    return pixelsPerBp >= 1 && scaleFactor >= 0.5;
  }

  _planForGroup(track, group, ctx) {
    if (group.thickness < this.font.height + 4) { return; }
    if (group.position === 'along' && this._sequenceDetailIsReadable()) { return; }

    const range = this.canvas.visibleRangeForCenterOffset(group.centerOffset, {float: true});
    if (!range || range.isMapLength()) { return; }
    const measurement = this._fittedMeasurement(track.name.trim(), ctx);
    if (!measurement) { return; }

    const pixelsPerBp = this.canvas.pixelsPerBp(group.centerOffset);
    if (!Number.isFinite(pixelsPerBp) || pixelsPerBp <= 0) { return; }
    const requiredWidth = measurement.totalWidth + (EDGE_GUTTER * 2);
    if ((range.length * pixelsPerBp) < requiredWidth) { return; }

    const leadingOffsetBp = (EDGE_GUTTER + (measurement.totalWidth / 2)) / pixelsPerBp;
    const bp = this.viewer.format === 'circular' ?
      this.viewer.sequence.addBp(range.start, leadingOffsetBp) :
      Math.min(range.stop, range.start + leadingOffsetBp);

    return {
      track,
      position: group.position,
      bp,
      centerOffset: group.centerOffset,
      ...measurement,
    };
  }

  plans(ctx = this.canvas.context('foreground')) {
    if (!this.isVisibleAtCurrentZoom()) { return []; }
    const plans = [];
    for (const track of this.viewer.tracks()) {
      const name = typeof track.name === 'string' ? track.name.trim() : '';
      const supportedType = track.type === 'feature' || (IncludePlotTracks && track.type === 'plot');
      if (!track.visible || !supportedType || !name || name === 'Unknown') { continue; }
      for (const group of this._groupsForTrack(track)) {
        const plan = this._planForGroup(track, group, ctx);
        if (plan) { plans.push(plan); }
      }
    }
    return plans;
  }

  _contrastColorFor(backgroundColor) {
    const linearChannel = value => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    };
    const rgb = backgroundColor.rgb;
    const luminance = (0.2126 * linearChannel(rgb.r)) +
      (0.7152 * linearChannel(rgb.g)) +
      (0.0722 * linearChannel(rgb.b));
    const blackContrast = (luminance + 0.05) / 0.05;
    const whiteContrast = 1.05 / (luminance + 0.05);
    return new Color(blackContrast >= whiteContrast ? 'black' : 'white');
  }

  _textIsFlipped(bp) {
    let angle = this.viewer.scale.bp(bp) + (Math.PI / 2);
    while (angle > Math.PI) { angle -= Math.PI * 2; }
    while (angle <= -Math.PI) { angle += Math.PI * 2; }
    return angle > Math.PI / 2 || angle < -Math.PI / 2;
  }

  _drawCircular(ctx, plan, textColor, haloColor) {
    const pixelsPerBp = this.canvas.pixelsPerBp(plan.centerOffset);
    if (!Number.isFinite(pixelsPerBp) || pixelsPerBp <= 0) { return; }

    const flipped = this._textIsFlipped(plan.bp);
    const textDirection = flipped ? -1 : 1;
    const drawGlyphPass = (method) => {
      let cursor = -plan.totalWidth / 2;
      for (let index = 0; index < plan.characters.length; index += 1) {
        const width = plan.widths[index];
        const pixelOffset = cursor + (width / 2);
        const glyphBp = plan.bp + (textDirection * pixelOffset / pixelsPerBp);
        const point = this.canvas.pointForBp(glyphBp, plan.centerOffset);
        const angle = this.viewer.scale.bp(glyphBp) + (Math.PI / 2) + (flipped ? Math.PI : 0);
        ctx.save();
        ctx.translate(point.x, point.y);
        ctx.rotate(angle);
        ctx[method](plan.characters[index], 0, 0);
        ctx.restore();
        cursor += width;
      }
    };

    ctx.save();
    ctx.font = this.font.css;
    ctx.fillStyle = textColor;
    ctx.strokeStyle = haloColor;
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.miterLimit = 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawGlyphPass('strokeText');
    drawGlyphPass('fillText');
    ctx.restore();
  }

  _drawLinear(ctx, plan, textColor, haloColor) {
    const point = this.canvas.pointForBp(plan.bp, plan.centerOffset);
    const text = plan.characters.join('');
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.font = this.font.css;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = haloColor;
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = textColor;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  draw() {
    if (!this.isVisibleAtCurrentZoom()) { return; }
    const ctx = this.canvas.context('foreground');
    const plans = this.plans(ctx);
    if (plans.length === 0) { return; }

    const backgroundColor = this.viewer.settings.backgroundColor;
    const textColor = this._contrastColorFor(backgroundColor);
    textColor.opacity = 0.78;
    const haloColor = backgroundColor.copy();
    haloColor.opacity = Math.max(0.9, haloColor.opacity);

    for (const plan of plans) {
      if (this.viewer.format === 'circular') {
        this._drawCircular(ctx, plan, textColor.rgbaString, haloColor.rgbaString);
      } else {
        this._drawLinear(ctx, plan, textColor.rgbaString, haloColor.rgbaString);
      }
    }
  }
}

export default TrackLabelRenderer;
