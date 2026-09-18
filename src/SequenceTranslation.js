//////////////////////////////////////////////////////////////////////////////
// SequenceTranslation
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
import Color from './Color';
import Font from './Font';
import SequenceGlyphCache from './SequenceGlyphCache';
import {CELL_VERTICAL_PADDING, traceChevron, traceCurvedChevron} from './SequenceCell';
import utils from './Utils';

const COMPLEMENT = {
  A: 'T', T: 'A', U: 'A', G: 'C', C: 'G',
  Y: 'R', R: 'Y', S: 'S', W: 'W', K: 'M', M: 'K',
  B: 'V', V: 'B', D: 'H', H: 'D', N: 'N',
  '-': '-', '.': '.',
};

const AMINO_ACID_NAMES = {
  A: 'Alanine', R: 'Arginine', N: 'Asparagine', D: 'Aspartic acid',
  C: 'Cysteine', E: 'Glutamic acid', Q: 'Glutamine', G: 'Glycine',
  H: 'Histidine', I: 'Isoleucine', L: 'Leucine', K: 'Lysine',
  M: 'Methionine', F: 'Phenylalanine', P: 'Proline', S: 'Serine',
  T: 'Threonine', W: 'Tryptophan', Y: 'Tyrosine', V: 'Valine',
  B: 'Asparagine or aspartic acid', Z: 'Glutamine or glutamic acid',
  J: 'Leucine or isoleucine', U: 'Selenocysteine', O: 'Pyrrolysine',
  '*': 'Stop', X: 'Unknown',
};

const DETAIL_FADE_START = 0.25;
const FULL_OPACITY_SCALE = 0.5;
const AMINO_ACID_ALPHABET = 'ACDEFGHIKLMNPQRSTVWYBXZJUO*';

// Translation cells need enough room for both the nominal font box and their
// inset border. Keeping these values in unscaled screen pixels makes the cell,
// lane, and glyph proportions remain stable through the detail transition.
const LANE_VERTICAL_PADDING = 3.5;

/**
 * SequenceTranslation draws all six reading frames around the sequence when
 * enough base-pair detail is visible. Direct frames are drawn outside the
 * backbone and reverse frames are drawn inside it. Reading frames restart at
 * each contig boundary. Protein sequences are not stored: codons intersecting
 * the visible range are translated and drawn in a streaming pass. Lane size
 * and opacity increase smoothly with zoom rather than switching on at a cutoff.
 *
 * SequenceTranslation is configured through {@link Sequence#translation}.
 *
 * <a name="attributes"></a>
 * ### Attributes
 *
 * Attribute                         | Type    | Description
 * ----------------------------------|---------|------------
 * [font](#font)                     | String  | Amino-acid font [Default: 'monospace, plain, 11']
 * [color](#color)                   | String  | Text color for all amino acids, including starts and stops [Default: 'black']
 * [backgroundColor](#backgroundColor) | String | Normal codon fill color
 * [borderColor](#borderColor)       | String  | Border color for all codon boxes, including starts and stops
 * [startColor](#startColor)         | String  | Start-codon background color [Default: '#00c80e']
 * [stopColor](#stopColor)           | String  | Stop-codon background color [Default: '#e34444']
 * [highlightStartCodons](#highlightStartCodons) | Boolean | Highlight starts defined by the active genetic code [Default: true]
 * [highlightStopCodons](#highlightStopCodons) | Boolean | Highlight stops defined by the active genetic code [Default: true]
 * [laneSpacing](#laneSpacing)       | Number  | Radial spacing between adjacent reading-frame lanes [Default: 2]
 * [edgePadding](#edgePadding)       | Number  | Radial clearance at both edges of each strand's translation band [Default: 6]
 * [visible](CGObject.html#visible)  | Boolean | Show six-frame translations at sufficient zoom [Default: true]
 *
 * @example
 * cgv.sequence.translation.update({visible: true, highlightStartCodons: true});
 * cgv.draw();
 *
 * @extends CGObject
 */
class SequenceTranslation extends CGObject {

  constructor(sequence, options = {}, meta = {}) {
    options = options || {};
    super(sequence.viewer, {...options, visible: utils.defaultFor(options.visible, true)}, meta);
    this._sequence = sequence;
    this._configured = Object.keys(options).length > 0;
    this.font = utils.defaultFor(options.font, 'monospace, plain, 11');
    this.color = utils.defaultFor(options.color, 'black');
    this.backgroundColor = utils.defaultFor(options.backgroundColor, '#e5e7eb');
    this.borderColor = utils.defaultFor(options.borderColor, '#9ca3af');
    this.startColor = utils.defaultFor(options.startColor, '#00c80e');
    this.stopColor = utils.defaultFor(options.stopColor, '#e34444');
    this.highlightStartCodons = utils.defaultFor(options.highlightStartCodons, true);
    this.highlightStopCodons = utils.defaultFor(options.highlightStopCodons, true);
    this.laneSpacing = utils.defaultFor(options.laneSpacing, 2);
    this.edgePadding = utils.defaultFor(options.edgePadding, 6);

    this.viewer.trigger('sequence-translation-update', { attributes: this.toJSON({includeDefaults: true}) });
  }

  toString() {
    return 'SequenceTranslation';
  }

  get sequence() {
    return this._sequence;
  }

  get visible() {
    return this._visible;
  }

  set visible(value) {
    const visible = Boolean(value);
    if (visible === this._visible) { return; }
    this._visible = visible;
    this._requestLayoutUpdate();
  }

  /** @member {Font} - Amino-acid font. */
  get font() {
    return this._font;
  }

  set font(value) {
    const font = value.toString() === 'Font' ? value : new Font(value);
    if (font.string === this._font?.string) { return; }
    this._font = font;
    this._requestLayoutUpdate();
  }

  /** @member {Color} - Shared text color for all amino acids, including starts and stops. */
  get color() {
    return this._color;
  }

  set color(value) {
    this._color = value.toString() === 'Color' ? value : new Color(value);
  }

  /** @member {Color} - Fill for ordinary codon boxes. */
  get backgroundColor() {
    return this._backgroundColor;
  }

  set backgroundColor(value) {
    this._backgroundColor = value.toString() === 'Color' ? value : new Color(value);
  }

  /** @member {Color} - Shared border color for all codon boxes. */
  get borderColor() {
    return this._borderColor;
  }

  set borderColor(value) {
    this._borderColor = value.toString() === 'Color' ? value : new Color(value);
  }

  /** @member {Color} - Fill for highlighted start codons. */
  get startColor() {
    return this._startColor;
  }

  set startColor(value) {
    this._startColor = value.toString() === 'Color' ? value : new Color(value);
  }

  /** @member {Color} - Fill for highlighted stop codons. */
  get stopColor() {
    return this._stopColor;
  }

  set stopColor(value) {
    this._stopColor = value.toString() === 'Color' ? value : new Color(value);
  }

  /** @member {Boolean} - Highlight starts defined by the active genetic code. */
  get highlightStartCodons() {
    return this._highlightStartCodons;
  }

  set highlightStartCodons(value) {
    this._highlightStartCodons = Boolean(value);
  }

  /** @member {Boolean} - Highlight stops defined by the active genetic code. */
  get highlightStopCodons() {
    return this._highlightStopCodons;
  }

  set highlightStopCodons(value) {
    this._highlightStopCodons = Boolean(value);
  }

  get laneHeight() {
    return this.font.height + (2 * LANE_VERTICAL_PADDING);
  }

  /**
   * @member {Number} - Radial spacing between adjacent translation lanes.
   */
  get laneSpacing() {
    return this._laneSpacing;
  }

  set laneSpacing(value) {
    const laneSpacing = Math.max(0, Number(value) || 0);
    if (laneSpacing === this._laneSpacing) { return; }
    this._laneSpacing = laneSpacing;
    this._requestLayoutUpdate();
  }

  /**
   * @member {Number} - Radial clearance between the nucleotide rows and first
   * translation lane, and between the final lane and backbone edge.
   */
  get edgePadding() {
    return this._edgePadding;
  }

  set edgePadding(value) {
    const edgePadding = Math.max(0, Number(value) || 0);
    if (edgePadding === this._edgePadding) { return; }
    this._edgePadding = edgePadding;
    this._requestLayoutUpdate();
  }

  get lanesPerStrand() {
    return 3;
  }

  /**
   * Radial space occupied by one strand's lanes, including inter-lane spacing
   * and explicit clearance at both edges. This is the source of truth for
   * backbone expansion.
   * @private
   */
  get strandThickness() {
    return (this.lanesPerStrand * this.laneHeight) +
      ((this.lanesPerStrand - 1) * this.laneSpacing) +
      (2 * this.edgePadding);
  }

  /**
   * Extra backbone thickness required for three lanes on each strand.
   * @private
   */
  get thickness() {
    if (!this.visible || !this.sequence.hasSeq) { return 0; }
    return 2 * this.strandThickness;
  }

  /**
   * Return scaled geometry for lane placement, backbone sizing, and glyph
   * centering. Lane offsets are distances from the backbone center.
   * @param {Number} scaleFactor - Translation size from 0 to 1.
   * @param {Number} [baseScaleFactor=scaleFactor] - Nucleotide size from 0 to 1.
   * @returns {Object} Lane dimensions and offsets in screen pixels.
   * @private
   */
  _layoutForScale(scaleFactor, baseScaleFactor = scaleFactor) {
    const highlightPadding = CELL_VERTICAL_PADDING * scaleFactor;
    const laneHeight = this.laneHeight * scaleFactor;
    const laneSpacing = this.laneSpacing * scaleFactor;
    const edgePadding = this.edgePadding * scaleFactor;
    // The highlight border is inset into the cell. The larger padding leaves
    // clear space between that border and the nominal glyph box, while the
    // lane retains a separate one-pixel gutter around the complete cell.
    // Every value uses the same detail scale so these proportions do not
    // change while zooming through the sequence-detail transition.
    const highlightHeight = (this.font.height * scaleFactor) + (2 * highlightPadding);
    const highlightBorderWidth = scaleFactor;
    // Raise glyphs 1 px at full size, keeping the scaled offset fractional.
    const textOffsetY = -scaleFactor;
    const laneStep = laneHeight + laneSpacing;
    const sequenceHalfThickness = this.sequence.baseThickness * baseScaleFactor / 2;
    const firstLaneCenterOffset = sequenceHalfThickness + edgePadding + (laneHeight / 2);
    const outerLaneEdgeOffset = firstLaneCenterOffset + ((this.lanesPerStrand - 1) * laneStep) + (laneHeight / 2);
    const backboneEdgeOffset = sequenceHalfThickness + (this.strandThickness * scaleFactor);
    return {
      scaleFactor,
      laneHeight,
      laneSpacing,
      edgePadding,
      highlightHeight,
      highlightBorderWidth,
      textOffsetY,
      laneStep,
      firstLaneCenterOffset,
      outerLaneEdgeOffset,
      backboneEdgeOffset,
    };
  }

  /**
   * Genetic code used to translate codons. Alias for Viewer.geneticCode.
   */
  get geneticCode() {
    return this.viewer.geneticCode;
  }

  set geneticCode(value) {
    this.viewer.geneticCode = value;
  }

  /**
   * Name of the active genetic code.
   */
  get geneticCodeName() {
    return this.viewer.codonTables.byID(this.geneticCode)?.name;
  }

  /**
   * Grow lanes continuously over the nucleotide-detail zoom range.
   * Smoothstep has zero slope at both ends, including when zooming back out.
   * No timers or per-frame animation state are needed.
   * @param {Number} pixelsPerBp - Backbone pixels per base pair.
   * @returns {Number} Translation size in the range 0 to 1.
   * @private
   */
  scaleFactor(pixelsPerBp) {
    if (!this.visible || !this.sequence.visible || !this.sequence.hasSeq || pixelsPerBp < 1) { return 0; }
    const baseScale = this.sequence.detailScaleFactor(pixelsPerBp);
    const progress = Math.max(0, (baseScale - DETAIL_FADE_START) / (1 - DETAIL_FADE_START));
    return progress * progress * (3 - 2 * progress);
  }

  /**
   * Return the additional backbone space occupied by translation at this zoom.
   * @param {Number} pixelsPerBp - Backbone pixels per base pair.
   * @returns {Number} Additional thickness in screen pixels; zero when hidden.
   * @private
   */
  scaledThickness(pixelsPerBp) {
    return this.thickness * this.scaleFactor(pixelsPerBp);
  }

  _splitRange(range) {
    if (range.start <= range.stop) {
      return [[range.start, range.stop]];
    }
    return [[range.start, this.sequence.length], [1, range.stop]];
  }

  _visibleContigSegments(contig, visibleRange) {
    const segments = [];
    const contigStart = contig.mapStart;
    const contigStop = contig.mapStop;
    for (const [visibleStart, visibleStop] of this._splitRange(visibleRange)) {
      const start = Math.max(contigStart, visibleStart);
      const stop = Math.min(contigStop, visibleStop);
      if (start <= stop) {
        segments.push([start - contig.lengthOffset, stop - contig.lengthOffset]);
      }
    }
    return segments;
  }

  _reverseComplementCodon(codon) {
    return `${COMPLEMENT[codon[2]] || 'N'}${COMPLEMENT[codon[1]] || 'N'}${COMPLEMENT[codon[0]] || 'N'}`;
  }

  /**
   * Visit translated codons without materializing a protein string or codon
   * record array. Segments use contig-local coordinates and are normally
   * calculated once per contig for the current draw.
   * @param {Contig} contig - Contig anchoring the reading frame.
   * @param {Array<Array<Number>>} segments - Visible local start/stop pairs.
   * @param {Number} strand - Forward (1) or reverse (-1).
   * @param {Number} frame - Reading frame from 1 to 3.
   * @param {CodonTable} codonTable - Active genetic code.
   * @param {Function} callback - Receives map start, codon, amino acid, start flag, and stop flag.
   * @returns {undefined} Invokes the callback for each overlapping complete codon.
   * @private
   */
  _forEachCodon(contig, segments, strand, frame, codonTable, callback) {
    const contigLength = contig.length;
    const mapSequence = this.sequence.seq;
    const highestStart = strand === 1 ? contigLength - 2 : contigLength - frame - 1;
    const firstFrameStart = strand === 1 ? frame : ((((highestStart - 1) % 3) + 3) % 3) + 1;

    for (const [visibleStart, visibleStop] of segments) {
      const firstStart = firstFrameStart + Math.max(0, Math.ceil((visibleStart - 2 - firstFrameStart) / 3)) * 3;
      const lastStart = Math.min(visibleStop, highestStart);
      for (let localStart = firstStart; localStart <= lastStart; localStart += 3) {
        if (localStart < 1 || localStart + 2 > contigLength) { continue; }
        const mapStart = contig.lengthOffset + localStart;
        const genomicCodon = mapSequence.substring(mapStart - 1, mapStart + 2).replace(/U/g, 'T');
        const codon = strand === 1 ? genomicCodon : this._reverseComplementCodon(genomicCodon);
        callback(
          mapStart,
          codon,
          codonTable.table[codon] || 'X',
          codonTable.starts.includes(codon),
          codonTable.stops.includes(codon)
        );
      }
    }
  }

  /**
   * Return translated codons for one frame overlapping the visible range.
   * Exposed primarily to make the frame anchoring independently testable.
   * @param {Contig} contig - Contig anchoring the reading frame.
   * @param {CGRange} visibleRange - Visible map coordinates.
   * @param {Number} strand - Forward (1) or reverse (-1).
   * @param {Number} frame - Reading frame from 1 to 3.
   * @param {CodonTable} codonTable - Active genetic code.
   * @returns {Array<Object>} Newly allocated codon records, without changing sequence data.
   * @private
   */
  codonsForRange(contig, visibleRange, strand, frame, codonTable) {
    const codons = [];
    const segments = this._visibleContigSegments(contig, visibleRange);
    this._forEachCodon(contig, segments, strand, frame, codonTable, (start, codon, aminoAcid, isStart, isStop) => {
      codons.push({
        start,
        stop: start + 2,
        middle: start + 1,
        strand,
        frame,
        codon,
        aminoAcid,
        isStart,
        isStop,
      });
    });
    return codons;
  }

  /**
   * Resolve the single codon under a pointer in a visible translation lane.
   * Uses the drawing layout at the current zoom, including the distinct DNA
   * and translation scales during the fade. No protein arrays are constructed.
   * @param {Number} bp - Map base-pair position under the pointer.
   * @param {Number} centerOffset - Pointer radius or linear map offset in pixels.
   * @returns {Object|undefined} New codon details, including its map range,
   * signed frame, amino-acid name, genetic code, and contig. Does not change the map.
   * @private
   */
  hitTest(bp, centerOffset) {
    if (!Number.isFinite(bp) || !Number.isFinite(centerOffset)) { return; }
    const backbone = this.viewer.backbone;
    const pixelsPerBp = backbone.pixelsPerBp();
    const scaleFactor = this.scaleFactor(pixelsPerBp);
    if (!scaleFactor) { return; }

    const layout = this._layoutForScale(scaleFactor, this.sequence.detailScaleFactor(pixelsPerBp));
    const signedOffset = centerOffset - backbone.adjustedCenterOffset;
    const strand = signedOffset >= 0 ? 1 : -1;
    const radialOffset = Math.abs(signedOffset);
    const frameIndex = Math.round((radialOffset - layout.firstLaneCenterOffset) / layout.laneStep);
    if (frameIndex < 0 || frameIndex >= this.lanesPerStrand) { return; }
    const laneCenterOffset = layout.firstLaneCenterOffset + frameIndex * layout.laneStep;
    if (Math.abs(radialOffset - laneCenterOffset) > layout.laneHeight / 2) { return; }

    const mapBp = Math.round(bp);
    if (mapBp < 1 || mapBp > this.sequence.length) { return; }
    const contig = this.sequence.hasMultipleContigs ? this.sequence.contigForBp(mapBp) : this.sequence.mapContig;
    if (!contig?.visible) { return; }

    const localBp = mapBp - contig.lengthOffset;
    const frame = frameIndex + 1;
    const codonTable = this.viewer.codonTables.byID(this.geneticCode) || this.viewer.codonTables.byID(11);
    let result;
    this._forEachCodon(contig, [[localBp, localBp]], strand, frame, codonTable,
      (start, codon, aminoAcid, isStart, isStop) => {
        result = {
          start,
          stop: start + 2,
          middle: start + 1,
          strand,
          frame,
          signedFrame: strand * frame,
          codon,
          aminoAcid,
          aminoAcidName: AMINO_ACID_NAMES[aminoAcid] || 'Unknown',
          isStart,
          isStop,
          geneticCode: Number(codonTable.geneticCodeID),
          geneticCodeName: codonTable.name,
          contig,
        };
      }
    );
    return result;
  }

  /**
   * Calculate shared cell geometry once for each lane in a draw. A tangent
   * polygon is sufficient when its maximum deviation is below 0.25 pixels;
   * short circular sequences retain curved edges at their exact map positions.
   * @param {Object} layout - Scaled translation-lane geometry.
   * @param {Number} centerOffset - Lane position in screen pixels.
   * @returns {Object} Cell dimensions, direction-independent bounds, and curve mode.
   * @private
   */
  _cellGeometry(layout, centerOffset) {
    const pixelsPerBp = this.canvas.pixelsPerBp(centerOffset);
    const span = 3 * pixelsPerBp;
    const borderWidth = layout.highlightBorderWidth;
    const gap = Math.min(0.5 * borderWidth, span * 0.05);
    const halfWidth = Math.max(0, (span - gap - borderWidth) / 2);
    const halfHeight = (layout.highlightHeight - borderWidth) / 2;
    const tipLength = Math.min(halfHeight * 0.4, halfWidth * 0.25);
    const curveError = (span * span / 8 + span * layout.highlightHeight / 4) / centerOffset;
    return {
      halfWidth,
      halfHeight,
      tipLength,
      borderWidth,
      pixelsPerBp,
      curved: this.viewer.format === 'circular' && curveError > 0.25,
    };
  }

  /**
   * Trace a compact chevron about a glyph's center. The caller fills and strokes
   * the same path, then draws the glyph using the same coordinate transform.
   * @param {CanvasRenderingContext2D} ctx - Map canvas context.
   * @param {Number} x - Glyph center in the current coordinate system.
   * @param {Number} y - Glyph center in the current coordinate system.
   * @param {Number} direction - Reading direction along the local x axis (1 or -1).
   * @param {Object} cell - Lane cell geometry.
   * @returns {undefined} Replaces the current canvas path.
   * @private
   */
  _traceCell(ctx, x, y, direction, cell) {
    traceChevron(ctx, x, y, direction, cell);
  }

  /**
   * Trace the same chevron with curved edges for short circular sequences.
   * @param {CanvasRenderingContext2D} ctx - Map canvas context.
   * @param {Number} middle - Map position at the center of the codon.
   * @param {Number} centerOffset - Lane radius in screen pixels.
   * @param {Number} strand - Forward (1) or reverse (-1) reading direction.
   * @param {Object} cell - Lane cell geometry.
   * @returns {undefined} Replaces the current canvas path in map coordinates.
   * @private
   */
  _traceCurvedCell(ctx, middle, centerOffset, strand, cell) {
    traceCurvedChevron(this.canvas, ctx, middle, centerOffset, strand, cell);
  }

  /** Prepare the shared cap-height baseline once per font. @private */
  _textBaselineOffset(ctx, scaleFactor) {
    return SequenceGlyphCache.baselineOffsetForFont(ctx, this.font) * scaleFactor;
  }

  /** Reuse amino-acid glyph sheets for all six lanes; SVG uses native text. @private */
  _glyphsForContext(ctx) {
    if (ctx.getSerializedSvg) { return; }
    this._glyphCache = SequenceGlyphCache.forContext(ctx, this.font, this._glyphCache, AMINO_ACID_ALPHABET);
    return this._glyphCache;
  }

  _drawCodon(start, aminoAcid, isStart, isStop, centerOffset, layout, strand = 1,
    cell = this._cellGeometry(layout, centerOffset), glyphCache, baselineOffset = 0) {
    let fillColor = this.backgroundColor;
    // Stop fill takes precedence for any unusual table that classifies a
    // codon as both a start and a stop.
    if (isStop && this.highlightStopCodons) {
      fillColor = this.stopColor;
    } else if (isStart && this.highlightStartCodons) {
      fillColor = this.startColor;
    }

    const ctx = this.canvas.context('map');
    const middle = start + 1;
    const origin = this.canvas.pointForBp(middle, centerOffset);
    const circular = this.viewer.format === 'circular';
    const orientation = circular ? this.canvas.tangentialTextOrientationForBp(middle) : undefined;
    const direction = orientation?.flipped ? -strand : strand;
    ctx.fillStyle = fillColor.rgbaString;
    ctx.strokeStyle = this.borderColor.rgbaString;
    ctx.lineWidth = cell.borderWidth;
    if (cell.curved) {
      this._traceCurvedCell(ctx, middle, centerOffset, strand, cell);
      ctx.fill();
      ctx.stroke();
    }
    if (circular) {
      ctx.save();
      ctx.translate(origin.x, origin.y);
      ctx.rotate(orientation.angle);
    }
    const x = circular ? 0 : origin.x;
    const y = circular ? 0 : origin.y;
    if (!cell.curved) {
      this._traceCell(ctx, x, y, direction, cell);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = this.color.rgbaString;
    const textY = y + layout.textOffsetY;
    if (glyphCache) {
      glyphCache.draw(ctx, aminoAcid, this.color.rgbaString, x, textY, layout.scaleFactor);
    } else {
      ctx.fillText(aminoAcid, x, textY + baselineOffset);
    }
    if (circular) { ctx.restore(); }
  }

  /**
   * Draw visible codons directly on the map canvas, restoring context state.
   * Does no sequence work until translation detail begins to appear.
   * @param {CGRange} visibleRange - Visible map coordinates.
   * @param {Number} backboneCenterOffset - Backbone position in screen pixels.
   * @param {Number} pixelsPerBp - Backbone pixels per base pair.
   * @returns {undefined}
   * @private
   */
  draw(visibleRange, backboneCenterOffset, pixelsPerBp) {
    const debugCounts = this.viewer.debug?.data.n;
    if (debugCounts) { debugCounts.aaDrawCount = 0; }
    const scaleFactor = this.scaleFactor(pixelsPerBp);
    if (!scaleFactor || !visibleRange) { return; }

    const codonTable = this.viewer.codonTables.byID(this.geneticCode) || this.viewer.codonTables.byID(11);
    const layout = this._layoutForScale(scaleFactor, this.sequence.detailScaleFactor(pixelsPerBp));
    const contigs = this.sequence.contigsForMapRange(visibleRange);
    const ctx = this.canvas.context('map');

    ctx.save();
    // Finish fading at half size, then let the solid letters and cells grow.
    // Ease out to full opacity without changing lane geometry or zoom timing.
    const opacityProgress = Math.min(1, scaleFactor / FULL_OPACITY_SCALE);
    ctx.globalAlpha *= opacityProgress * (2 - opacityProgress);
    ctx.font = this.font.cssScaled(scaleFactor);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    const baselineOffset = this._textBaselineOffset(ctx, scaleFactor);
    const glyphCache = this._glyphsForContext(ctx);
    if (glyphCache) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }
    const laneGeometry = new Map();
    for (const contig of contigs) {
      const segments = this._visibleContigSegments(contig, visibleRange);
      for (const strand of [1, -1]) {
        for (let frame = 1; frame <= this.lanesPerStrand; frame++) {
          const laneCenterOffset = layout.firstLaneCenterOffset + ((frame - 1) * layout.laneStep);
          const centerOffset = backboneCenterOffset + (strand * laneCenterOffset);
          const lane = strand * frame;
          let cell = laneGeometry.get(lane);
          if (!cell) {
            cell = this._cellGeometry(layout, centerOffset);
            laneGeometry.set(lane, cell);
          }
          this._forEachCodon(contig, segments, strand, frame, codonTable, (start, codon, aminoAcid, isStart, isStop) => {
            this._drawCodon(start, aminoAcid, isStart, isStop, centerOffset, layout, strand, cell, glyphCache, baselineOffset);
            if (debugCounts) { debugCounts.aaDrawCount++; }
          });
        }
      }
    }
    ctx.restore();
  }

  /**
   * Recalculate backbone and slot geometry once after a size-affecting option
   * changes. Updates are applied synchronously so the next draw cannot combine
   * a new backbone thickness with stale feature-slot offsets.
   * @private
   */
  _requestLayoutUpdate() {
    if (this._layoutUpdatesSuspended) {
      this._layoutUpdatePending = true;
      return;
    }
    if (!this._sequence || !this.viewer.backbone || this.viewer.loading) { return; }
    const previousThickness = this.viewer.backbone.layoutThickness;
    this.viewer.backbone.refreshThickness();
    // Size-affecting translation settings have no current layout effect below
    // the detail threshold. The normal zoom draw will refresh the backbone as
    // soon as the scaled translation thickness becomes non-zero.
    if (Math.abs(this.viewer.backbone.layoutThickness - previousThickness) < 0.001) { return; }
    this.viewer.layout._adjustProportions({duration: 0});
  }

  /**
   * Update translation settings, refresh affected layout, and emit an update
   * event. Call viewer.draw() to paint the changes.
   * @param {Object} attributes - Translation attributes to change.
   * @returns {undefined}
   */
  update(attributes) {
    this._configured = true;
    this._layoutUpdatesSuspended = true;
    this._layoutUpdatePending = false;
    try {
      this.viewer.updateRecords(this, attributes, {
        recordClass: 'SequenceTranslation',
        validKeys: [
          'font', 'color', 'backgroundColor', 'borderColor',
          'startColor', 'stopColor',
          'highlightStartCodons', 'highlightStopCodons',
          'laneSpacing', 'edgePadding', 'visible'
        ]
      });
    } finally {
      this._layoutUpdatesSuspended = false;
    }
    if (this._layoutUpdatePending) {
      this._layoutUpdatePending = false;
      this._requestLayoutUpdate();
    }
    this.viewer.trigger('sequence-translation-update', { attributes });
  }

  invertColors() {
    // Preserve start/stop fills so their meaning stays consistent on either background.
    this.update({
      color: this.color.invert().rgbaString,
      backgroundColor: this.backgroundColor.invert().rgbaString,
      borderColor: this.borderColor.invert().rgbaString,
    });
  }

  toJSON() {
    return {
      font: this.font.string,
      color: this.color.rgbaString,
      backgroundColor: this.backgroundColor.rgbaString,
      borderColor: this.borderColor.rgbaString,
      startColor: this.startColor.rgbaString,
      stopColor: this.stopColor.rgbaString,
      highlightStartCodons: this.highlightStartCodons,
      highlightStopCodons: this.highlightStopCodons,
      laneSpacing: this.laneSpacing,
      edgePadding: this.edgePadding,
      visible: this.visible,
    };
  }
}

export default SequenceTranslation;
