//////////////////////////////////////////////////////////////////////////////
// Sequence
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
import CGRange from './CGRange';
import Contig from './Contig';
import SequenceExtractor from './SequenceExtractor';
import SequenceTranslation from './SequenceTranslation';
import SequenceGlyphCache from './SequenceGlyphCache';
import {CELL_VERTICAL_PADDING, traceChevron, traceCurvedChevron} from './SequenceCell';
import Color from './Color';
import Font from './Font';
import utils from './Utils';
import {
  BASE_COLOR_MODES,
  DEFAULT_BASE_COLORS,
  colorForBase,
  copyBaseColors,
  hasBaseColors,
  mergeBaseColors,
} from './BaseColorPalette';

const DARK_BACKBONE_LUMINANCE_THRESHOLD = 0.4;
const BASE_TEXT_ORIENTATIONS = Object.freeze(['horizontal', 'curved']);

/**
 * The CGView Sequence represents the sequence that makes up the map.
 *
 * ### Sequence Length
 * The essential property of the Sequence is the length. The length must be
 * known in order to draw a map of the correct size. There are 3 ways to set
 * the Sequence length on map creation.
 * - seq: provide the sequence. The length will be set directly from the sequence.
 * - length: provide the sequence length without sequence
 * - contigs: an array of contigs. Each contig must then include its length or sequence.
 *
 * The seq and length properties are read only and cannot be changed unless a new
 * map is loaded (see [IO.loadJSON](IO.html#loadJSON)). With contigs, the updateContigs and
 * moveContig methods can be used to change the name, orientation, visibility and
 * order, however, the seq and length property of each contig is still read only.
 *
 * ### Sequence Coordinates:
 * CGView uses two coordinate systems: Contig space and map space. For features
 * and plot, positions are relative to contigs. However, when drawing we use
 * positions relative to the entire map.
 *
 * ### Base Coloring
 * At readable sequence zoom, [baseColorMode](#baseColorMode) controls how
 * nucleotide arrow boxes are colored. Adjacent boxes have a 1 px gap and follow
 * the strand's reading direction. The default `single` mode uses neutral fills
 * with [color](#color) for every letter. The `byBase` mode fills the boxes using
 * [baseColors](#baseColors) for A, C, G, T/U, and ambiguous characters, with
 * contrasting black or white letters. U shares the T color; all other
 * characters use the ambiguous color.
 *
 * Letters, fills, and outlines fade in together before quarter-size detail,
 * reaching full opacity at the zoom where bases previously first appeared.
 * When translations are shown, smaller base fonts grow to the amino-acid font
 * size, retaining their configured family and style. Both use the same vertical
 * cell padding, with separate space reserved for the nucleotide rows.
 *
 * Each contig independently selects `baseColors.onLight` or
 * `baseColors.onDark` from the luminance of its rendered backbone. A
 * translucent backbone is first composited over the map background. Changing
 * [color](#color) or [baseColors](#baseColors) does not change
 * [baseColorMode](#baseColorMode).
 *
 * In JSON, a missing `baseColorMode` means `single`, and that default is
 * omitted when saving. The value `byBase` is serialized explicitly. Custom
 * palettes are saved in `sequence.baseColors`; built-in palettes are omitted
 * unless `includeDefaults` is requested.
 *
 * ### Action and Events
 *
 * Action                                  | Viewer Method                    | Sequence Method     | Event
 * ----------------------------------------|----------------------------------|---------------------|-----
 * [Update](../docs.html#updating-records) | -                                | [update()](#update) | sequence-update
 * [Read](../docs.html#reading-records)    | [sequence](Viewer.html#sequence) | -                   | -
 *
 * <a name="attributes"></a>
 * ### Attributes
 *
 * Attribute                        | Type      | Description
 * ---------------------------------|-----------|------------
 * [seq](#seq)<sup>iu</sup>         | String    | The map sequence.
 * [length](#length)<sup>iu</sup>   | Number    | The length of the sequence. This is ignored if a seq is provided. [Default: 1000]
 * [contigs](#contigs)<sup>iu</sup> | Array     | Array of contigs. Contigs are ignored if a seq is provided.
 * [font](#font)                    | String    | A string describing the font [Default: 'SansSerif, plain, 14']. See {@link Font} for details.
 * [color](#color)                  | String    | A string describing the sequence color [Default: 'black']. See {@link Color} for details.
 * [baseColorMode](#baseColorMode)  | String    | Detailed base coloring: `single` or `byBase` [Default: `single`].
 * [baseTextOrientation](#baseTextOrientation) | String | Base presentation: `horizontal` or `curved` [Default: `horizontal`].
 * [baseColors](#baseColors)        | Object    | Nucleotide box-fill palettes for light and dark backbone colors.
 * [translation](#translation)    | Object    | Six-frame translation options. See {@link SequenceTranslation}. Hidden by default.
 * [visible](CGObject.html#visible) | Boolean   | Sequence is visible when zoomed in enough [Default: true]
 * [meta](CGObject.html#meta)       | Object    | [Meta data](../tutorials/details-meta-data.html)
 * 
 * <sup>iu</sup> Ignored on Sequence update
 *
 * ### Examples
 *
 * @extends CGObject
 */
 // TODO: Add Image of map with contigs. Show contig/map space
class Sequence extends CGObject {

  /**
   * Create a Sequence
   * @param {Viewer} viewer - The viewer
   * @param {Object} options - [Attributes](#attributes) used to create the sequence
   * @param {Object} [meta] - User-defined [Meta data](../tutorials/details-meta-data.html) to add to the sequence
   *
   */
  // Implementation notes:
  //   - Internally contigs are always used. If 'seq' is provided, it will be converted to a single contig.
  //   - All the contigs are concatenated into a single contig called mapContig.
  //     -  Sequence.seq === Sequence.mapContig.seq
  //   - If there is only one contig then Sequence.mapContig === Sequence.contigs(1)
  //   - Make note in update/updateContig methods that if only one contig is provided (or the sequence seq), they are treated the same internally. Therefore, if the contig name is changed, so is the sequence name.
  //   - Note for toJSON: will output single contigs as attributes of the sequence (so no contigs property)
  constructor(viewer, options = {}, meta = {}) {
    super(viewer, options, meta);
    this._viewer = viewer;
    this.bpMargin = 2;
    this.color = utils.defaultFor(options.color, 'black');
    this._baseTextOrientation = 'horizontal';
    this.baseTextOrientation = utils.defaultFor(options.baseTextOrientation, 'horizontal');
    this._baseColorMode = 'single';
    this.baseColorMode = utils.defaultFor(options.baseColorMode, 'single');
    this._baseColorVariantCache = new Map();
    this._baseCellStyleCache = new Map();
    this._baseColors = copyBaseColors(DEFAULT_BASE_COLORS);
    if (hasBaseColors(options.baseColors)) {
      this.baseColors = options.baseColors;
    }
    this.font = utils.defaultFor(options.font, 'sans-serif, plain, 14');

    this._contigs = new CGArray();

    this.createMapContig(options);
    this._translation = new SequenceTranslation(this, options.translation);

    this.viewer.trigger('sequence-update', { attributes: this.toJSON({includeDefaults: true}) });
  }

  //////////////////////////////////////////////////////////////////////////
  // STATIC CLASSS METHODS
  //////////////////////////////////////////////////////////////////////////
  /**
   * Common method for extracting sequence based on a range
   * range can be a CGRange or any object with a start and stop attribute.
   * @param {String} seq - The sequence as a string
   * @param {Range} range - Range to extract seqence for
   * @param {Boolean} revComp - If true, the returned sequence will be the reverse compliment
   * @return {String}
   * @private
   */
  static forRange(seq, range, revComp=false) {
    const start = range && range.start;
    const stop = range && range.stop;
    if (!seq || !start || !stop) {return;}
    let extract = ''
    if (stop < start) {
      // Range wraps around
      extract = seq.substring(start - 1) + seq.substring(0, stop);
    } else {
      extract = seq.substring(start - 1, stop);
    }
    if (revComp) {
      extract = Sequence.reverseComplement(extract);
    }
    return extract;
  }

  // TODO: Take into account lower case letters
  /**
   * Return the Complement the sequence
   * @return {String} - 'Sequence'
   * @static
   */
  static complement(seq) {
    let compSeq = '';
    let char, compChar;
    for (let i = 0, len = seq.length; i < len; i++) {
      char = seq.charAt(i);
      switch (char) {
      case 'A':
        compChar = 'T';
        break;
      case 'T':
        compChar = 'A';
        break;
      case 'G':
        compChar = 'C';
        break;
      case 'C':
        compChar = 'G';
        break;
      case 'U':
        compChar = 'A';
        break;
      case 'Y':
        compChar = 'R';
        break;
      case 'S':
        compChar = 'S';
        break;
      case 'W':
        compChar = 'W';
        break;
      case 'K':
        compChar = 'M';
        break;
      case 'M':
        compChar = 'K';
        break;
      case 'B':
        compChar = 'V';
        break;
      case 'D':
        compChar = 'H';
        break;
      case 'H':
        compChar = 'D';
        break;
      case 'V':
        compChar = 'B';
        break;
      case 'N':
        compChar = 'N';
        break;
      case '-':
        compChar = '-';
        break;
      case '.':
        compChar = '.';
        break;
      }
      compSeq = compSeq + compChar;
    }
    return compSeq;
  }

  static baseCalculation(type, seq) {
    if (type === 'gc-content') {
      return Sequence.calcGCContent(seq);
    } else if (type === 'gc-skew') {
      return Sequence.calcGCSkew(seq);
    }
  }

  static calcGCContent(seq) {
    if (seq.length === 0) { return  0.5; }
    const g = Sequence.count(seq, 'g');
    const c = Sequence.count(seq, 'c');
    return ( (g + c) / seq.length );
  }

  static calcGCSkew(seq) {
    const g = Sequence.count(seq, 'g');
    const c = Sequence.count(seq, 'c');
    if ( (g + c) === 0 ) { return 0.5; }
    // Gives value between -1 and 1
    const value = (g - c) / (g + c);
    // Scale to a value between 0 and 1
    return  0.5 + (value / 2);
  }

  static reverseComplement(seq) {
    return Sequence.complement( seq.split('').reverse().join('') );
  }

  static count(seq, pattern) {
    return (seq.match(new RegExp(pattern, 'gi')) || []).length;
  }

  /**
   * Create a random sequence of the specified length
   * @param {Number} length - The length of the sequence to create
   * @return {String}
   */
  static random(length) {
    let seq = '';
    let num;
    for (let i = 0; i < length; i++) {
      num = Math.floor(Math.random() * 4);
      switch (num % 4) {
      case 0:
        seq += 'A';
        break;
      case 1:
        seq += 'T';
        break;
      case 2:
        seq += 'G';
        break;
      case 3:
        seq += 'C';
      }
    }
    return seq;
  }

  reverseComplement() {
    return Sequence.reverseComplement(this.seq);
  }

  count(pattern) {
    return Sequence.count(this.seq, pattern);
  }

  //////////////////////////////////////////////////////////////////////////
  // MEMBERS
  //////////////////////////////////////////////////////////////////////////

  /**
   * Return the class name as a string.
   * @return {String} - 'Sequence'
   */
  toString() {
    return 'Sequence';
  }

  /**
   * @member {String} - Get or set the seqeunce.
   */
  get seq() {
    // return this._seq;
    return this.mapContig.seq;
  }

  // set seq(value) {
  //   this._seq = value;
  //   if (this._seq) {
  //     this._seq = this._seq.toUpperCase();
  //     this._length = value.length;
  //     this._updateScale();
  //     this._sequenceExtractor = new SequenceExtractor(this);
  //   } else {
  //     this._sequenceExtractor = undefined;
  //   }
  // }

  /**
   * @member {Contig} - This is used internally to represent the entire map sequence.
   *   It is generated by the supplied seq or the concatenation of all the contigs.
   *   The Sequence.seq (or length) is the same as Sequence.mapContig.seq (or length).
   */
  get mapContig() {
    return this._mapContig;
  }

  /**
   * @member {Number} - Get the SeqeunceExtractor. Only available if the *seq* property is set.
   * @private
   */
  get sequenceExtractor() {
    return this._sequenceExtractor;
  }

  /**
   * @member {Number} - Get or set the seqeunce length. If the *seq* property is set, the length can not be adjusted.
   */
  get length() {
    // return this._length;
    return this.mapContig.length;
  }

  // set length(value) {
  //   if (value) {
  //     if (!this.seq) {
  //       this._length = Number(value);
  //       this._updateScale();
  //     } else {
  //       console.error('Can not change the sequence length if *seq* is set.');
  //     }
  //   }
  // }

  _updateScale() {
    // this.viewer.layout.updateBPScale(this.length);
    this.viewer.layout.updateScales();
    // this.canvas.scale.bp = d3.scaleLinear()
    //   .domain([1, this.length])
    //   .range([-1 / 2 * Math.PI, 3 / 2 * Math.PI]);
    // this.viewer._updateZoomMax();
    // console.log(this.canvas.scale)
  }

  /**
   * @member {Color} - Get or set the backbone color. When setting the color, a string representing the color or a {@link Color} object can be used. For details see {@link Color}.
   */
  get color() {
    return this._color;
  }

  set color(value) {
    if (value.toString() === 'Color') {
      this._color = value;
    } else {
      this._color = new Color(value);
    }
  }

  /**
   * @member {'single'|'byBase'} - Get or set detailed sequence base coloring.
   * `single` renders every letter with [color](#color) on a neutral box.
   * `byBase` fills boxes with the base palettes and uses contrasting letters.
   * Neither mode changes `color`.
   */
  get baseColorMode() {
    return this._baseColorMode;
  }

  set baseColorMode(value) {
    if (utils.validate(value, BASE_COLOR_MODES)) {
      this._baseColorMode = value;
    }
  }

  /**
   * @member {'horizontal'|'curved'} - Get or set the sequence base text
   * orientation. Curved bases follow circular-map tangents and fall back to
   * horizontal text on linear maps.
   */
  get baseTextOrientation() {
    return this._baseTextOrientation;
  }

  set baseTextOrientation(value) {
    if (utils.validate(value, BASE_TEXT_ORIENTATIONS)) {
      this._baseTextOrientation = value;
    }
  }

  /**
   * @member {Object} - Get or update the semantic base palettes used at
   * sequence detail. Palettes contain `onLight` and `onDark` entries, each
   * with A, C, G, T, and `ambiguous` colors. U uses the T color. Partial
   * updates preserve other entries. Custom palettes are saved in sequence JSON.
   */
  get baseColors() {
    return copyBaseColors(this._baseColors);
  }

  set baseColors(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      console.error('Sequence baseColors must be an object.');
      return;
    }
    this._baseColors = mergeBaseColors(this._baseColors || DEFAULT_BASE_COLORS, value);
    this._baseColorVariantCache?.clear();
    this._baseCellStyleCache?.clear();
  }

  /**
   * @member {Font} - Get or set sequence font. When setting the font, a string representing the font or a {@link Font} object can be used. For details see {@link Font}.
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
    this.bpSpacing = this.font.size;
  }

  /**
   * @member {Number} - Get or set the basepair spacing.
   * @private
   */
  get bpSpacing() {
    return this._bpSpacing;
  }

  set bpSpacing(value) {
    this._bpSpacing = value;
    this.viewer._updateZoomMax();
  }

  /**
   * @member {Number} - Get or set the margin around sequence letters.
   * @private
   */
  get bpMargin() {
    return this._bpMargin;
  }

  set bpMargin(value) {
    this._bpMargin = value;
  }

  /**
   * @member {Number} - Get the thick required to draw the sequence. Based on bpMargin and bpSpacing.
   * @private
   */
  get thickness() {
    return this.baseThickness + this.translation.thickness;
  }

  /** Nucleotide-row thickness before adding translation lanes. @private */
  get baseThickness() {
    return (2 * this._baseCellHeight) + (3 * this.bpMargin);
  }

  /** Full-size base font, large enough to match visible amino acids. @private */
  get _baseDetailFont() {
    const size = this.translation?.visible && this.hasSeq
      ? Math.max(this.font.size, this.translation.font.size)
      : this.font.size;
    if (size === this.font.size) { return this.font; }
    if (this._enlargedBaseFont?.source !== this.font.css || this._enlargedBaseFont.font.size !== size) {
      this._enlargedBaseFont = {source: this.font.css,
        font: new Font({family: this.font.family, style: this.font.style, size})};
    }
    return this._enlargedBaseFont.font;
  }

  /** Full outer cell height, including its inset stroke. @private */
  get _baseCellHeight() {
    return this._baseDetailFont.height + (2 * CELL_VERTICAL_PADDING);
  }

  /** Center of either nucleotide row, leaving one margin between them. @private */
  get _baseRowCenterOffset() {
    return (this._baseCellHeight + this.bpMargin) / 2;
  }

  /** @member {SequenceTranslation} - Six-frame translation settings and renderer. */
  get translation() {
    return this._translation;
  }

  /**
   * Return the nucleotide-detail scale without changing layout or drawing.
   * @param {Number} pixelsPerBp - Backbone pixels per base pair.
   * @returns {Number} Scale from 0 to 1.
   * @private
   */
  detailScaleFactor(pixelsPerBp) {
    const baseWidth = this.bpSpacing - this.bpMargin;
    if (!Number.isFinite(pixelsPerBp) || baseWidth <= 0) { return 0; }
    return Math.max(0, Math.min(1, pixelsPerBp / baseWidth));
  }

  /**
   * Return true when nucleotide rows are large enough to reserve their shared
   * backbone space from other text.
   * @param {Number} [pixelsPerBp] - Backbone pixels per base pair.
   * @return {Boolean} Whether nucleotide detail is meaningfully readable.
   * @private
   */
  isDetailReadable(pixelsPerBp = this.viewer.backbone.pixelsPerBp()) {
    const naturalBaseWidth = this.bpSpacing - this.bpMargin;
    if (!this.visible || !Number.isFinite(pixelsPerBp) || naturalBaseWidth <= 0) { return false; }
    const scaleFactor = Math.min(1, pixelsPerBp / naturalBaseWidth);
    return pixelsPerBp >= 1 && scaleFactor >= 0.5;
  }

  get isLinear() {
    return false;
  }

  get isCircular() {
    return true;
  }

  /**
   * @member {Boolean} - Return true of a sequence is available. Returns false if there is only a length.
   */
  get hasSeq() {
    return typeof this.seq === 'string';
  }

  /**
   * @member {Boolean} - Return true if the sequence consists of muliple contigs.
   */
  get hasMultipleContigs() {
    return this._contigs.length > 1;
  }


  // loadContigs(contigs) {
  //   // Create contigs
  //   for (const contigData of contigs) {
  //     const contig = new Contig(this, contigData);
  //     this._contigs.push(contig);
  //   }
  //   this.updateFromContigs();
  // }

  /**
   * Add one or more [contigs](Contig.html) (see [attributes](Contig.html#attributes)).
   * See [adding records](../docs.html#s.adding-records) for details.
   * @param {Object|Array} data - Object or array of objects describing the contigs
   * @return {CGArray<Contig>} CGArray of added contigs
   */
  addContigs(contigData = []) {
    contigData = CGArray.arrayerize(contigData);
    const contigs = contigData.map( (data) => {
      const contig = new Contig(this, data);
      this._contigs.push(contig);
      return contig;
    });
    this.updateMapContig();
    this.viewer.trigger('contigs-add', contigs);
    // this.updateFromContigs();
    return contigs;
    // Check for sequence or length
    // Can probably just add the sequence or length, instead of calling updateFromContigs
    // Update Plots
    // this.updateFromContigs()
  }

  /**
   * Remove contigs.
   * See [removing records](../docs.html#s.removing-records) for details.
   * Notes:
   * - Removing contigs, will remove the features associated with the contig
   * - This will only work with contigs in Sequence.contigs(). It will not remove the mapContig.
   * - Will not remove last contig. If removing all contigs, the last contig will not be removed.
   * @param {Contig|Array} contigs - Contig or a array of contigs to remove
   */
  // TODO: deal with plots
  removeContigs(contigs) {
    contigs = CGArray.arrayerize(contigs).slice();
    // Do not remove last contig
    if (contigs.length === this._contigs.length) {
      const lastContig = contigs.pop();
      console.error('The last contig can not be removed. Keeping:', lastContig);
    }
    if (contigs.length > 0) {
      // First remove features
      const features = contigs.map( c => c.features() ).flat();
      this.viewer.removeFeatures(features);
      // Remove contigs
      this._contigs = this._contigs.filter( c => !contigs.includes(c) );
      // Remove from Objects
      contigs.forEach( c => c.deleteFromObjects() );
      this.updateMapContig();
    }

    this.viewer.trigger('contigs-remove', contigs);
  }

  /**
   * Update [attributes](Contig.html#attributes) for one or more contigs.
   * See [updating records](../docs.html#s.updating-records) for details.
   * @param {Contig|Array|Object} contigsOrUpdates - Contig, array of contigs or object describing updates
   * @param {Object} attributes - Object describing the properties to change
   */
  updateContigs(contigsOrUpdates, attributes) {
    const { records: contigs, updates } = this.viewer.updateRecords(contigsOrUpdates, attributes, {
      recordClass: 'Contig',
      validKeys: ['name', 'orientation', 'color', 'visible']
    });

    // FIXME: this should only update if orientation, order or visible changes
    this.updateMapContig();
    // TRYING THIS OUT
    for (const track of this.viewer.tracks()) {
      track.refresh();
    }
    this.viewer.annotation.refresh();
    // FIXME: Only trigger contigs if visibiliy changes
    this.viewer.trigger('tracks-update', { tracks: this.viewer.tracks() });
    // TODO: refresh sequence, features, etc
    this.viewer.trigger('contigs-update', { contigs, attributes, updates });
  }

  /**
   * Move a contig from one index to a new one
   * @param {Number} oldIndex - Index of contig to move (0-based)
   * @param {Number} newIndex - New index for the contig (0-based)
   */
  moveContig(oldIndex, newIndex) {
    this._contigs.move(oldIndex, newIndex);
    // FIXME: UPDATE OFFSET AND RANGES
    // FIXME: UPDATE Sequence Plot Extractors
    this.updateMapContig();

    // TRYING THIS OUT
    for (const track of this.viewer.tracks()) {
      track.refresh();
    }
    this.viewer.annotation.refresh();

    this.viewer.trigger('contigs-moved', {oldIndex: oldIndex, newIndex: newIndex});

    // Calling contigs-update as well.
    // Because each contig between oldIndex and newIndex will have there order/index changed
    const contigs = [];
    const start = Math.min(oldIndex, newIndex);
    const len = Math.max(oldIndex, newIndex);
    for (let i = start; i <= len; i++) {
      contigs.push(this._contigs[i]);
    }
    this.viewer.trigger('contigs-update', { contigs, attributes: {} });
  }


  // Order of importance:
  // 1) seq
  // 2) contigs
  //   a) seq
  //   b) length
  // 3) length
  // 4) Default: length 1000 bp
  createMapContig(data) {
    if (data.seq) {
      // this._mapContig = new Contig(this, data);
      this.addContigs([{seq: data.seq}]);
    } else if (data.contigs) {
      this.addContigs(data.contigs);
    } else if (data.length) {
      this.addContigs([{length: data.length}]);
    } else {
      // console.error('A "seq", "contigs", or "length" must be provided');
      this.addContigs([{length: 1000}]);
    }
  }

  updateMapContig() {
    if (this._contigs.length === 1) {
      this._mapContig = this._contigs[0];
      this._mapContig._index = 1;
      this._mapContig._updateLengthOffset(0);
    } else {
      // Concatenate contigs
      // The contigs can't have a mixture of sequence and length
      // Check first contig to see if it contains a sequence or length
      const useSeq = this._contigs[0].hasSeq;
      let seq = '';
      let length = 0;
      for (let i = 0, len = this._contigs.length; i < len; i++) {
        const contig = this._contigs[i];
        contig._index = i + 1;
        if (!contig.visible) {continue;}

        contig._updateLengthOffset(length);

        if (useSeq) {
          if (contig.hasSeq) {
            seq += contig.seq;
            length += contig.seq.length;
          } else {
            console.error(`Expecting Sequence but Contig '${contig.name}' has no sequence !`)
          }
        } else {
          if (contig.length) {
            length += contig.length;
          } else {
            console.error(`Expecting Length but Contig '${contig.name}' has no length!`)
          }
        }
      }
      const oldMapContig = this.mapContig;
      // Create new mapContig
      const data = (useSeq) ? {seq} : {length};
      this._mapContig = new Contig(this, data);
      // Move features from previous mapContig to new mapContig
      if (oldMapContig) {
        oldMapContig.features().forEach( f => f.contig = this.mapContig  );
        oldMapContig.deleteFromObjects();
      }
    }
    this._sequenceExtractor = (this.hasSeq) ? new SequenceExtractor(this) : undefined;
    this._updateScale();
  }

  // updateFromContigs() {
  //   if (this._contigs.length === 0) {
  //     this.seq = '';
  //     return;
  //   }
  //   // Check first contig to see if it contains a sequence or length
  //   const useSeq = this._contigs[0].hasSeq;
  //   let seq = '';
  //   let length = 0;
  //   for (let i = 0, len = this._contigs.length; i < len; i++) {
  //     const contig = this._contigs[i];
  //     contig._index = i + 1;
  //     contig._updateLengthBefore(length);
  //
  //     if (useSeq) {
  //       if (contig.hasSeq) {
  //         seq += contig.seq;
  //         length += contig.seq.length;
  //       } else {
  //         console.error(`Expecting Sequence but Contig ${this.name} [${this.id}] has no sequence !`)
  //       }
  //     } else {
  //       if (contig.length) {
  //         length += contig.length;
  //       } else {
  //         console.error(`Expecting Length but Contig ${this.name} [${this.id}] has no length!`)
  //       }
  //     }
  //   }
  //   // Create sequence
  //   if (useSeq) {
  //     this.seq = seq;
  //   } else {
  //     this.length = length;
  //   }
  // }

  /**
   * Returns a [CGArray](CGArray.html) of contigs or a single contig.
   * See [reading records](../docs.html#s.reading-records) for details.
   * @param {Integer|String|Array} term - See [CGArray.get](CGArray.html#get) for details.
   * @return {Contig|CGArray}
   */
  contigs(term) {
    return this._contigs.get(term);
  }

  /**
   * Returns all the visible contigs that overlap the given range using map coordinates.
   * @param {CGRange} range - Range to find overlapping contigs.
   * @return {CGArray} CGArray of Contigs
   * @private
   */
  contigsForMapRange(range) {
    const contigs = new CGArray();
    for (let i = 1, len = this.sequence.contigs().length; i <= len; i++) {
      const contig = this.sequence.contigs(i);
      if (contig.visible && range.overlapsMapRange(contig.mapRange)) {
        contigs.push(contig);
      }
    }
    return contigs;
  }

  /**
   * Return the map bp position given a local *bp* on the given *contig*.
   * @param {Contig} contig - Contig object
   * @param {Number} bp - bp position on the contig
   * @return {Number} map position.
   * @private
   */
  bpForContig(contig, bp = 1) {
    return contig.mapStart + bp - 1;
  }

  /**
   * Return the contig for the given map bp.
   * @return {Contig}
   * @private
   */
  contigForBp(bp) {
    // FIXME: could be sped up with a binary search
    if (this.hasMultipleContigs) {
      for (let i = 0, len = this._contigs.length; i < len; i++) {
        if (bp <= this._contigs[i].lengthOffset) {
          return this._contigs[i - 1];
        }
      }
      // Must be in last contig
      return this._contigs[this._contigs.length - 1];
    }
  }

  /**
   * Create FASTA string for the sequence.
   * @param {String} id - ID line for FASTA (i.e. text after '>'). Only used if there is one contig or concatenateContigs is true.
   * @param {Object} options - Options: concatenateContigs
   */
  // id is not used if there are multiple contigs and we are not concatenating them
  asFasta(id, options = {}) {
    const concatenate = options.concatenateContigs;
    if (concatenate || !this.hasMultipleContigs) {
      const name = id || this.contigs(1).name;
      return `>${name}\n${this.seq}`;
    } else {
      let fasta = '';
      for (const contig of this._contigs) {
        fasta += `${contig.asFasta()}\n`;
      }
      return fasta;
    }
  }

  lengthOfRange(start, stop) {
    if (stop >= start) {
      return stop - start;
    } else {
      return this.length + (stop - start);
    }
  }

  /**
   * Subtract *bpToSubtract* from *position*, taking into account the sequence length
   * @param {Number} position - position (in bp) to subtract from
   * @param {Number} bpToSubtract - number of bp to subtract
   * @private
   */
  subtractBp(position, bpToSubtract) {
    if (bpToSubtract < position) {
      return position - bpToSubtract;
    } else {
      return this.length + position - bpToSubtract;
    }
  }

  /**
   * Add *bpToAdd* to *position*, taking into account the sequence length
   * @param {Number} position - position (in bp) to add to
   * @param {Number} bpToAdd - number of bp to add
   * @private
   */
  addBp(position, bpToAdd) {
    if (this.length >= (bpToAdd + position)) {
      return bpToAdd + position;
    } else {
      return position - this.length + bpToAdd;
    }
  }

  /**
   * Constrains the supplied *bp* to be between 1 and the sequence length.
   *  - If the bp is less than 1: 1 is returned.
   *  - If greater than the sequence length: sequence length is returned.
   *  - Otherwise the supplied bp is returned.
   * @param {Number} bp - position (in bp)
   * @private
   */
  constrain(bp) {
    return utils.constrain(bp, 1, this.length);
  }

  /**
   * Return the sequence for the *range*
   *
   * @param {Range} range - the range for which to return the sequence
   * @param {Boolean} revComp - If true return the reverse complement sequence
   * @return {String}
   */
  forRange(range, revComp) {
    let seq;
    if (this.seq) {
      seq = Sequence.forRange(this.seq, range, revComp);
      // if (range.isWrapped()) {
      //   // seq = this.seq.substr(range.start - 1) + this.seq.substr(0, range.stop);
      //   seq = this.seq.substring(range.start - 1) + this.seq.substring(0, range.stop);
      // } else {
      //   // seq = this.seq.substr(range.start - 1, range.length + 1);
      //   seq = this.seq.substring(range.start - 1, range.stop);
      // }
    } else {
      // FIXME: For now return fake sequence
      seq = this._fakeSequenceForRange(range);
    }
    return seq;
  }

  // FAKE method to get sequence
  _fakeSequenceForRange(range) {
    let seq = '';
    let bp = range.start;
    for (let i = 0, len = range.length; i < len; i++) {
      switch (bp % 4) {
      case 0:
        seq += 'A';
        break;
      case 1:
        seq += 'T';
        break;
      case 2:
        seq += 'G';
        break;
      case 3:
        seq += 'C';
      }
      bp++;
    }
    return seq;
  }

  /**
   * Returns an array of Ranges where the pattern was located. The pattern can be a RegEx or a String.
   * This method will return overlapping matches.
   * @param {String} pattern - RegEx or String Pattern to search for.
   * @return {Array)
   * @private
   */
  findPattern(pattern, strand = 1) {
    const re = new RegExp(pattern, 'g');
    const ranges = [];
    let match, start;
    const seq = (strand === 1) ? this.seq : this.reverseComplement();
    while ( (match = re.exec(seq)) !== null) {
      start = (strand === 1) ? (match.index + 1) : (this.length - match.index - match[0].length + 1);
      ranges.push( new CGRange(this.mapContig, start, start + match[0].length - 1 ) );
      re.lastIndex = match.index + 1;
    }
    return ranges;
  }


  featuresByReadingFrame(features) {
    const featuresByRF = {
      rfPlus1: new CGArray(),
      rfPlus2: new CGArray(),
      rfPlus3: new CGArray(),
      rfMinus1: new CGArray(),
      rfMinus2: new CGArray(),
      rfMinus3: new CGArray()
    };
    let rf;
    features.each( (i, feature) => {
      if (feature.strand === -1) {
        rf = (this.length - feature.stop + 1) % 3;
        if (rf === 0) { rf = 3; }
        featuresByRF[`rfMinus${rf}`].push(feature);
      } else {
        rf = feature.start % 3;
        if (rf === 0) { rf = 3; }
        featuresByRF[`rfPlus${rf}`].push(feature);
      }
    });
    return featuresByRF;
  }

  _emptySequence(length) {
    // ES6
    // return '•'.repeat(length);
    return Array(length + 1).join('•');
  }

  /**
   * Return the palette variant suited to the rendered backbone at a map bp.
   * Translucent backbone colors are composited over the map background before
   * luminance is evaluated.
   * @param {Number} bp - Map base-pair position.
   * @returns {'onLight'|'onDark'} Palette variant name.
   * @private
   */
  _baseColorVariantForBp(bp) {
    const mapBp = ((((Math.round(bp) - 1) % this.length) + this.length) % this.length) + 1;
    const contig = this.hasMultipleContigs ? this.contigForBp(mapBp) : this.mapContig;
    const backboneColor = this.viewer.backbone.colorForContig(contig);
    const mapBackground = this.viewer.settings.backgroundColor;
    const cacheKey = `${backboneColor.rgbaString}|${mapBackground.rgbaString}`;
    let variant = this._baseColorVariantCache.get(cacheKey);
    if (!variant) {
      const renderedColor = backboneColor.opacity < 1
        ? backboneColor.compositeOver(mapBackground)
        : backboneColor;
      variant = renderedColor.relativeLuminance < DARK_BACKBONE_LUMINANCE_THRESHOLD
        ? 'onDark'
        : 'onLight';
      this._baseColorVariantCache.set(cacheKey, variant);
    }
    return variant;
  }

  /**
   * Return the single-mode text color or by-base box fill for one base.
   * @param {String} base - Sequence character.
   * @param {Number} bp - Map base-pair position.
   * @returns {*} Configured single or semantic base color.
   * @private
   */
  _colorForBase(base, bp) {
    if (this.baseColorMode === 'single') {
      return this.color.rgbaString;
    }
    return colorForBase(this._baseColors, base, this._baseColorVariantForBp(bp));
  }

  /**
   * Resolve and cache a box fill and contrasting letter color. Palette colors
   * are parsed only on cache misses; translucent fills use the rendered backbone.
   * @param {String} base - Sequence character.
   * @param {Number} bp - Map base-pair position.
   * @param {String} variant - Precomputed onLight/onDark palette variant.
   * @returns {Object} Cached fill and text styles; does not change the palette.
   * @private
   */
  _baseCellStyleForBase(base, bp, variant = this._baseColorVariantForBp(bp)) {
    const fill = colorForBase(this._baseColors, base, variant);
    let style = this._baseCellStyleCache.get(fill);
    if (!style) {
      const color = new Color(fill);
      style = {fill: color.rgbaString, text: color.contrastColor().rgbaString, color};
      this._baseCellStyleCache.set(fill, style);
    }
    if (style.color.opacity === 1) { return style; }

    const mapBp = ((((Math.round(bp) - 1) % this.length) + this.length) % this.length) + 1;
    const contig = this.hasMultipleContigs ? this.contigForBp(mapBp) : this.mapContig;
    const background = this.viewer.settings.backgroundColor;
    const backboneColor = this.viewer.backbone.visible && contig.visible
      ? this.viewer.backbone.colorForContig(contig) : background;
    const key = `${fill}|${backboneColor.rgbaString}|${background.rgbaString}`;
    let compositeStyle = this._baseCellStyleCache.get(key);
    if (!compositeStyle) {
      const rendered = style.color.compositeOver(backboneColor.compositeOver(background));
      compositeStyle = {fill: style.fill, text: rendered.contrastColor().rgbaString};
      this._baseCellStyleCache.set(key, compositeStyle);
    }
    return compositeStyle;
  }

  /** Neutral base boxes preserve the configured single-mode letter color. @private */
  _singleBaseCellStyle() {
    return {
      fill: this.color.relativeLuminance < DARK_BACKBONE_LUMINANCE_THRESHOLD ? '#e5e7eb' : '#334155',
      text: this.color.rgbaString,
    };
  }

  /**
   * Calculate geometry once per nucleotide row. Allow for the pointed/notched
   * edges and their outlines to leave a 1 px gap between adjoining boxes.
   * @param {Number} scaleFactor - Nucleotide-detail size from 0 to 1.
   * @param {Number} centerOffset - Row radius or linear offset in pixels.
   * @returns {Object} Cell dimensions and curved-edge mode, without drawing.
   * @private
   */
  _baseCellGeometry(scaleFactor, centerOffset) {
    const pixelsPerBp = this.canvas.pixelsPerBp(centerOffset);
    const borderWidth = 0.5 * scaleFactor;
    const halfHeight = (this._baseCellHeight * scaleFactor - borderWidth) / 2;
    const tipLength = Math.min(halfHeight * 0.2, pixelsPerBp * 0.125);
    const halfWidth = Math.max(0, (pixelsPerBp + tipLength - 1 - borderWidth) / 2);
    const curveError = (pixelsPerBp * pixelsPerBp / 8 + pixelsPerBp * halfHeight / 2) / centerOffset;
    return {halfWidth, halfHeight, tipLength, pixelsPerBp, scaleFactor,
      tipCenterOffset: 0.25 * scaleFactor, borderWidth,
      curved: this.viewer.format === 'circular' && curveError > 0.25};
  }

  /**
   * Center capital bases on the box using the font's cap height.
   * Measure once per font, then scale the cached alphabetic baseline while zooming.
   * @param {CanvasRenderingContext2D} ctx - Context using an alphabetic baseline.
   * @param {Number} scaleFactor - Nucleotide-detail size from 0 to 1.
   * @returns {Number} Baseline offset in pixels; preserves the context font.
   * @private
   */
  _baseTextBaselineOffset(ctx, scaleFactor) {
    return SequenceGlyphCache.baselineOffsetForFont(ctx, this._baseDetailFont) * scaleFactor;
  }

  /**
   * Prepare horizontal glyphs once per draw. SVG retains native, editable text;
   * raster exports use their own resolution to keep the glyphs sharp.
   * @param {CanvasRenderingContext2D} ctx - Current map drawing context.
   * @returns {SequenceGlyphCache|undefined} Reused cache, or undefined for native text.
   * @private
   */
  _baseGlyphsForContext(ctx) {
    if ((this.viewer.format === 'circular' && this.baseTextOrientation === 'curved') || ctx.getSerializedSvg) {
      return;
    }
    this._baseGlyphCache = SequenceGlyphCache.forContext(ctx, this._baseDetailFont, this._baseGlyphCache);
    return this._baseGlyphCache;
  }

  /**
   * Draw one directional base box and its letter. Circular cells follow the
   * backbone independently of the selected glyph orientation.
   * @param {CanvasRenderingContext2D} ctx - Map canvas context.
   * @param {String} base - Sequence character to draw.
   * @param {Number} bp - Map base-pair position.
   * @param {Number} centerOffset - Distance from the map center.
   * @param {Number} baselineOffset - Font baseline adjustment.
   * @param {Object} [orientation] - Reusable readable tangent, flip flag, cosine, and sine.
   * @param {Number} [strand=1] - Reading direction (1 or -1).
   * @param {Object} [cell] - Precomputed row geometry.
   * @param {Object} [style] - Precomputed fill and text colors.
   * @param {SequenceGlyphCache} [glyphCache] - Cached images for horizontal raster text.
   * @returns {undefined} Paints one box and glyph, restoring any glyph transform.
   * @private
   */
  _drawBase(ctx, base, bp, centerOffset, baselineOffset, orientation, strand = 1, cell, style, glyphCache) {
    cell = cell || this._baseCellGeometry(this.detailScaleFactor(this.viewer.backbone.pixelsPerBp()), centerOffset);
    style = style || (this.baseColorMode === 'byBase' ? this._baseCellStyleForBase(base, bp) : this._singleBaseCellStyle());
    const origin = this.canvas.pointForBp(bp, centerOffset);
    const circular = this.viewer.format === 'circular';
    const curvedText = circular && this.baseTextOrientation === 'curved';
    orientation = orientation || (circular ? this.canvas.tangentialTextOrientationForBp(bp) : undefined);
    const direction = orientation?.flipped ? -strand : strand;
    ctx.fillStyle = style.fill;
    ctx.lineWidth = cell.borderWidth;
    if (cell.curved) {
      traceCurvedChevron(this.canvas, ctx, bp, centerOffset, strand, cell);
      ctx.fill();
      ctx.stroke();
    }
    if (curvedText) {
      ctx.save();
      ctx.translate(origin.x, origin.y);
      ctx.rotate(orientation.angle);
    }
    const x = curvedText ? 0 : origin.x;
    const y = curvedText ? 0 : origin.y;
    if (!cell.curved) {
      const cos = !circular || curvedText ? 1 : orientation.cos ?? Math.cos(orientation.angle);
      const sin = !circular || curvedText ? 0 : orientation.sin ?? Math.sin(orientation.angle);
      traceChevron(ctx, x, y, direction, cell, cos, sin);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = style.text;
    if (glyphCache) {
      glyphCache.draw(ctx, base, style.text, x, y, cell.scaleFactor);
    } else {
      ctx.fillText(base, x, y + baselineOffset);
    }
    if (curvedText) { ctx.restore(); }
  }

  draw() {
    const backbone = this.viewer.backbone;
    const pixelsPerBp = backbone.pixelsPerBp();
    if (!this.visible) { return; }
    // Start fading at half the former appearance cutoff and finish at that cutoff.
    // Smoothstep keeps both ends continuous, including when zooming back out.
    const fullOpacityPixels = Math.max(1, (this.bpSpacing - this.bpMargin) * 0.25);
    const opacityProgress = Math.max(0, Math.min(1, 2 * pixelsPerBp / fullOpacityPixels - 1));
    if (!opacityProgress) { return; }

    const ctx = this.canvas.context('map');
    const scaleFactor = this.detailScaleFactor(pixelsPerBp);

    const centerOffset = backbone.adjustedCenterOffset;
    const range = backbone.visibleRange;
    let seq, complement;
    if (range) {
      if (this.seq) {
        seq = this.forRange(range);
        complement = Sequence.complement(seq);
      } else {
        seq = this._emptySequence(range.length);
        complement = this._emptySequence(range.length);
      }
      let bp = range.start;
      ctx.save();
      ctx.globalAlpha *= opacityProgress * opacityProgress * (3 - 2 * opacityProgress);
      ctx.strokeStyle = '#9ca3af';
      ctx.lineJoin = 'round';
      ctx.font = this._baseDetailFont.cssScaled(scaleFactor);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic'; // The default baseline works best across canvas and svg
      const yOffset = this._baseTextBaselineOffset(ctx, scaleFactor);
      const glyphCache = this._baseGlyphsForContext(ctx);
      if (glyphCache) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
      }
      // Distance from the center of the backbone to place sequence text
      const centerOffsetDiff = this._baseRowCenterOffset * scaleFactor;
      const directCell = this._baseCellGeometry(scaleFactor, centerOffset + centerOffsetDiff);
      const reverseCell = this._baseCellGeometry(scaleFactor, centerOffset - centerOffsetDiff);
      const singleStyle = this._singleBaseCellStyle();
      const byBase = this.baseColorMode === 'byBase';
      const circular = this.viewer.format === 'circular';
      this._baseColorVariantCache.clear();
      for (let i = 0, len = range.length; i < len; i++) {
        const orientation = circular ? this.canvas.tangentialTextOrientationForBp(bp) : undefined;
        if (orientation) {
          orientation.cos = Math.cos(orientation.angle);
          orientation.sin = Math.sin(orientation.angle);
        }
        const variant = byBase ? this._baseColorVariantForBp(bp) : undefined;
        this._drawBase(
          ctx,
          seq[i],
          bp,
          centerOffset + centerOffsetDiff,
          yOffset,
          orientation,
          1,
          directCell,
          byBase ? this._baseCellStyleForBase(seq[i], bp, variant) : singleStyle,
          glyphCache,
        );
        this._drawBase(
          ctx,
          complement[i],
          bp,
          centerOffset - centerOffsetDiff,
          yOffset,
          orientation,
          -1,
          reverseCell,
          byBase ? this._baseCellStyleForBase(complement[i], bp, variant) : singleStyle,
          glyphCache,
        );
        bp++;
      }
      ctx.restore();
      this.translation.draw(range, centerOffset, pixelsPerBp);
    }
  }

  invertColors() {
    this.update({
      color: this.color.invert().rgbaString
    });
    if (this.translation.visible || this.translation._configured) {
      this.translation.invertColors();
    }
  }

  /**
   * Update sequence [attributes](#attributes).
   * See [updating records](../docs.html#s.updating-records) for details.
   * @param {Object} attributes - Object describing the properties to change
   */
  update(attributes) {
    this.viewer.updateRecords(this, attributes, {
      recordClass: 'Sequence',
      validKeys: [
        'color',
        'baseColorMode',
        'baseTextOrientation',
        'baseColors',
        'font',
        'visible',
      ],
    });
    this.viewer.trigger('sequence-update', { attributes });
  }

  /**
   * Returns JSON representing the object
   */
  toJSON(options = {}) {
    const json = {
      font: this.font.string,
      color: this.color.rgbString,
      contigs: this._contigs.map( c => c.toJSON(options) )
    };
    // Optionally add default values
    if (!this.visible || options.includeDefaults) {
      json.visible = this.visible;
    }
    if (this.baseColorMode === 'byBase') {
      json.baseColorMode = this.baseColorMode;
    }
    if (this.baseTextOrientation !== 'horizontal' || options.includeDefaults) {
      json.baseTextOrientation = this.baseTextOrientation;
    }
    if (options.includeDefaults || JSON.stringify(this._baseColors) !== JSON.stringify(DEFAULT_BASE_COLORS)) {
      json.baseColors = this.baseColors;
    }
    if (this.translation.visible || this.translation._configured || options.includeDefaults) {
      json.translation = this.translation.toJSON(options);
    }
    return json;
  }

}

export default Sequence;


// testRF(features) {
//   let startTime, rf;
//   startTime = new Date().getTime();
//   let rf1 = this.featuresByReadingFrame(features);
//   console.log("READING FRAME Normal Creation Time: " + CGV.elapsedTime(startTime) );
//   // SETUP
//   features.each( (i, feature) => {
//     if (feature.strand === -1) {
//       rf = (this.length - feature.stop + 1) % 3;
//       if (rf === 0) { rf = 3; }
//       feature.rf = rf;
//     } else {
//       rf = feature.start % 3;
//       if (rf === 0) { rf = 3; }
//       feature.rf = rf;
//     }
//   });
//   startTime = new Date().getTime();
//   let rf2 = {
//     rfPlus1: new CGV.CGArray( features.filter( (f) => { return f.rf === 1  && f.strand === 1})),
//     rfPlus2: new CGV.CGArray( features.filter( (f) => { return f.rf === 2  && f.strand === 1})),
//     rfPlus3: new CGV.CGArray( features.filter( (f) => { return f.rf === 3  && f.strand === 1})),
//     rfMinus1: new CGV.CGArray( features.filter( (f) => { return f.rf === 1  && f.strand === -1})),
//     rfMinus2: new CGV.CGArray( features.filter( (f) => { return f.rf === 2  && f.strand === -1})),
//     rfMinus3: new CGV.CGArray( features.filter( (f) => { return f.rf === 3  && f.strand === -1}))
//   };
//   console.log("READING FRAME NEW Creation Time: " + CGV.elapsedTime(startTime) );
//   return rf2;
// }
