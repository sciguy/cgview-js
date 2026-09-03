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
const TRACK_LIST_EVENTS = [
  'cgv-json-load',
  'tracks-add',
  'tracks-remove',
  'tracks-update',
  'tracks-moved',
  'features-add',
  'features-remove',
  'features-update',
];

/**
 * Draw compact track identifiers once individual lanes are readable.
 * Labels align just inside the leading edge of the visible map range, with one
 * label per visible slot.
 *
 * @private
 */
class TrackLabelRenderer {

  constructor(layout) {
    this.layout = layout;
    this.font = new Font('sans-serif, bold, 10');
    this._measurementCache = new Map();
    this._trackList = undefined;
    this._trackListEventsAttached = false;
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

  _maximumLabelWidth() {
    return Math.min(MAX_LABEL_WIDTH, this.canvas.width * 0.22);
  }

  _fittedMeasurement(text, ctx, maximumWidth = this._maximumLabelWidth()) {
    const measurement = this._measurementFor(text, ctx);
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

  _labelMeasurement(name, detail, ctx) {
    if (!detail) { return this._fittedMeasurement(name, ctx); }

    const maximumWidth = this._maximumLabelWidth();
    const fullMeasurement = this._measurementFor(`${name} (${detail})`, ctx);
    if (fullMeasurement.totalWidth <= maximumWidth) { return fullMeasurement; }

    const prefixMeasurement = this._measurementFor(' (', ctx);
    const suffixMeasurement = this._measurementFor(')', ctx);
    const availableWidth = maximumWidth - prefixMeasurement.totalWidth - suffixMeasurement.totalWidth;
    if (availableWidth <= 0) { return; }

    const nameMeasurement = this._measurementFor(name, ctx);
    const detailMeasurement = this._measurementFor(detail, ctx);
    const halfWidth = availableWidth / 2;
    let nameWidth = halfWidth;
    let detailWidth = halfWidth;
    // Keep a short component intact and give the remaining width to the other.
    if (nameMeasurement.totalWidth <= halfWidth) {
      nameWidth = nameMeasurement.totalWidth;
      detailWidth = availableWidth - nameWidth;
    } else if (detailMeasurement.totalWidth <= halfWidth) {
      detailWidth = detailMeasurement.totalWidth;
      nameWidth = availableWidth - detailWidth;
    }

    const fittedName = this._fittedMeasurement(name, ctx, nameWidth);
    const fittedDetail = this._fittedMeasurement(detail, ctx, detailWidth);
    if (!fittedName || !fittedDetail) { return; }

    const measurements = [fittedName, prefixMeasurement, fittedDetail, suffixMeasurement];
    return {
      characters: measurements.flatMap(measurement => measurement.characters),
      widths: measurements.flatMap(measurement => measurement.widths),
      totalWidth: measurements.reduce((sum, measurement) => sum + measurement.totalWidth, 0),
    };
  }

  _detailForSlot(track, slot, readingFrames) {
    if (track.type !== 'feature') { return; }

    if (track.separateFeaturesBy === 'strand') {
      return slot.isReverse() ? '-' : '+';
    }
    if (track.separateFeaturesBy === 'readingFrame') {
      const strand = slot.isReverse() ? 'reverse' : 'direct';
      readingFrames[strand] += 1;
      return `${strand === 'reverse' ? '-' : '+'}${readingFrames[strand]}`;
    }

    const feature = slot.features().first;
    if (track.separateFeaturesBy === 'type') { return feature?.type; }
    if (track.separateFeaturesBy === 'legend') { return feature?.legend?.name; }
  }

  _buildTrackList() {
    const entries = [];
    for (const track of this.viewer.tracks()) {
      const supportedType = track.type === 'feature' || (IncludePlotTracks && track.type === 'plot');
      if (!supportedType) { continue; }

      const readingFrames = {direct: 0, reverse: 0};
      for (const slot of track.slots()) {
        const value = this._detailForSlot(track, slot, readingFrames);
        const detail = value === undefined || value === null ? undefined : String(value).trim();
        entries.push({track, slot, detail: detail || undefined});
      }
    }
    return entries;
  }

  _onlyLoadProgressChanged({attributes, updates} = {}) {
    const changes = updates ? Object.values(updates) : attributes ? [attributes] : [];
    return changes.length > 0 && changes.every((change) => {
      const keys = Object.keys(change || {});
      return keys.length > 0 && keys.every(key => key === 'loadProgress');
    });
  }

  _attachTrackListEvents() {
    if (this._trackListEventsAttached || !this.viewer.events) { return; }
    for (const event of TRACK_LIST_EVENTS) {
      this.viewer.on(`${event}.trackLabelRenderer`, (data) => {
        if (event === 'tracks-update' && this._onlyLoadProgressChanged(data)) { return; }
        this._trackList = undefined;
      });
    }
    // Viewer initializes its event registry after Layout, so registration is lazy.
    this._trackListEventsAttached = true;
  }

  _trackListEntries() {
    this._attachTrackListEvents();
    if (!this._trackList) { this._trackList = this._buildTrackList(); }
    return this._trackList;
  }

  _sequenceDetailIsReadable() {
    return this.viewer.sequence.isDetailReadable();
  }

  _planForSlot(track, slot, detail, ctx) {
    if (!slot.visible || !Number.isFinite(slot.thickness) || slot.thickness < this.font.height + 4) { return; }
    if (slot.position === 'along' && this._sequenceDetailIsReadable()) { return; }

    const range = this.canvas.visibleRangeForCenterOffset(slot.centerOffset, {float: true});
    if (!range || range.isMapLength()) { return; }
    const measurement = this._labelMeasurement(track.name.trim(), detail, ctx);
    if (!measurement) { return; }

    const pixelsPerBp = this.canvas.pixelsPerBp(slot.centerOffset);
    if (!Number.isFinite(pixelsPerBp) || pixelsPerBp <= 0) { return; }
    const requiredWidth = measurement.totalWidth + (EDGE_GUTTER * 2);
    if ((range.length * pixelsPerBp) < requiredWidth) { return; }

    const leadingOffsetBp = (EDGE_GUTTER + (measurement.totalWidth / 2)) / pixelsPerBp;
    const bp = this.viewer.format === 'circular' ?
      this.viewer.sequence.addBp(range.start, leadingOffsetBp) :
      Math.min(range.stop, range.start + leadingOffsetBp);

    return {
      track,
      slot,
      detail,
      position: slot.position,
      bp,
      centerOffset: slot.centerOffset,
      ...measurement,
    };
  }

  plans(ctx = this.canvas.context('foreground')) {
    if (!this.isVisibleAtCurrentZoom()) { return []; }
    const plans = [];
    for (const {track, slot, detail} of this._trackListEntries()) {
      const name = typeof track.name === 'string' ? track.name.trim() : '';
      if (!track.visible || !name || name === 'Unknown') { continue; }
      const plan = this._planForSlot(track, slot, detail, ctx);
      if (plan) { plans.push(plan); }
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

  /**
   * Return the map-space bounds reserved for visible track labels. Inline
   * feature labels use these bounds before either label type is painted.
   * @private
   */
  exclusionBounds(ctx = this.canvas.context('foreground')) {
    const padding = 2;
    return this.plans(ctx).flatMap((plan) => {
      const pixelsPerBp = this.canvas.pixelsPerBp(plan.centerOffset);
      if (!Number.isFinite(pixelsPerBp) || pixelsPerBp <= 0) { return []; }
      return [{
        slot: plan.slot,
        bp: plan.bp,
        halfBp: ((plan.totalWidth / 2) + padding) / pixelsPerBp,
        innerOffset: plan.centerOffset - (this.font.height / 2) - padding,
        outerOffset: plan.centerOffset + (this.font.height / 2) + padding,
      }];
    });
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
        this.canvas.drawTextAlongArc({
          layer: 'foreground',
          bp: plan.bp,
          centerOffset: plan.centerOffset,
          characters: plan.characters,
          widths: plan.widths,
          totalWidth: plan.totalWidth,
          font: this.font.css,
          color: textColor.rgbaString,
          haloColor: haloColor.rgbaString,
          haloWidth: 3.5,
        });
      } else {
        this._drawLinear(ctx, plan, textColor.rgbaString, haloColor.rgbaString);
      }
    }
  }
}

export default TrackLabelRenderer;
