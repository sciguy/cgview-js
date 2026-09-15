/**
 * Cache nucleotide and amino-acid glyphs at a fixed resolution. Scaling these
 * images avoids canvas text snapping to new pixel rows as the map zooms.
 */
const fontMetrics = new WeakMap();

class SequenceGlyphCache {
  /**
   * Measure capital-letter centering once per font, including font mutations.
   * @param {CanvasRenderingContext2D} ctx - Drawing context used for measurement.
   * @param {Font} font - Font at its full detail size.
   * @returns {Number} Alphabetic baseline below the cap center; restores context state.
   */
  static baselineOffsetForFont(ctx, font) {
    let metrics = fontMetrics.get(font);
    if (metrics?.font !== font.css) {
      const previousFont = ctx.font;
      const previousBaseline = ctx.textBaseline;
      ctx.font = font.css;
      ctx.textBaseline = 'alphabetic';
      // A flat cap avoids the optical overshoot of rounded letters such as C/G.
      const {actualBoundingBoxAscent: ascent, actualBoundingBoxDescent: descent} = ctx.measureText('H');
      ctx.font = previousFont;
      ctx.textBaseline = previousBaseline;
      const offset = Number.isFinite(ascent) && Number.isFinite(descent) && ascent + descent > 0
        ? (ascent - descent) / 2
        : font.height * 0.35;
      metrics = {font: font.css, offset};
      fontMetrics.set(font, metrics);
    }
    return metrics.offset;
  }

  /**
   * Reuse a cache at the current raster resolution; SVG keeps editable text.
   * @param {CanvasRenderingContext2D} ctx - Context before any glyph rotation.
   * @param {Font} font - Font at its full detail size.
   * @param {SequenceGlyphCache} [cache] - Previous cache for this renderer.
   * @param {String} [alphabet] - Characters to prepare together on each color sheet.
   * @returns {SequenceGlyphCache|undefined} Existing or newly allocated cache, or native SVG text.
   */
  static forContext(ctx, font, cache, alphabet) {
    if (ctx.getSerializedSvg) { return; }
    const transform = ctx.getTransform();
    const pixelRatio = Math.max(2, Math.abs(transform.a), Math.abs(transform.d));
    if (cache?.font !== font.css || cache.pixelRatio !== pixelRatio) {
      cache = new SequenceGlyphCache(font, pixelRatio, this.baselineOffsetForFont(ctx, font), alphabet);
    }
    return cache;
  }

  /**
   * @param {Font} font - Sequence font at its full detail size.
   * @param {Number} pixelRatio - Raster resolution relative to CSS pixels.
   * @param {Number} baselineOffset - Alphabetic baseline below the cap center.
   * @param {String} [alphabet] - Characters to prepare together on each color sheet.
   */
  constructor(font, pixelRatio, baselineOffset, alphabet = 'ACGTURYSWKMBDHVN•') {
    this.font = font.css;
    this.fontSize = font.height;
    this.pixelRatio = pixelRatio;
    this.baselineOffset = baselineOffset;
    this.alphabet = alphabet;
    this._colors = new Map();
  }

  /**
   * Return a centered glyph image, rasterizing only on a cache miss.
   * @param {String} base - Sequence character.
   * @param {String} color - CSS letter color, including any opacity.
   * @returns {Object} Shared image, source rectangle in raster pixels, and CSS dimensions.
   */
  get(base, color) {
    let sheet = this._colors.get(color);
    if (!sheet) {
      // Retain the three text styles without accumulating every intermediate
      // color chosen in the color picker.
      if (this._colors.size === 3) { this._colors.clear(); }
      sheet = this._createSheet(color);
      this._colors.set(color, sheet);
      // Paint the alphabet before the first image draw so the sheet
      // can be uploaded once and reused throughout the frame.
      for (const letter of this.alphabet) { this.get(letter, color); }
    }
    let glyph = sheet.glyphs.get(base);
    if (!glyph) {
      const metrics = sheet.ctx.measureText(base);
      const halfWidth = Math.ceil(Math.max(metrics.width / 2,
        metrics.actualBoundingBoxLeft || 0, metrics.actualBoundingBoxRight || 0)) + 2;
      const halfHeight = Math.ceil(Math.max(this.fontSize / 2,
        (metrics.actualBoundingBoxAscent || this.fontSize) - this.baselineOffset,
        (metrics.actualBoundingBoxDescent || 0) + this.baselineOffset)) + 2;
      const sourceWidth = Math.ceil(2 * halfWidth * this.pixelRatio);
      const sourceHeight = Math.ceil(2 * halfHeight * this.pixelRatio);
      let image = sheet.image;
      let ctx = sheet.ctx;
      let sourceX = 0;
      let sourceY = 0;
      if (sourceWidth <= sheet.pitch && sourceHeight <= sheet.pitch && sheet.nextSlot < 32) {
        sourceX = (sheet.nextSlot % 8) * sheet.pitch;
        sourceY = Math.floor(sheet.nextSlot / 8) * sheet.pitch;
        sheet.nextSlot++;
      } else {
        // Unusual characters or very wide custom glyphs retain their full bounds.
        image = document.createElement('canvas');
        image.width = sourceWidth;
        image.height = sourceHeight;
        ctx = this._configureContext(image, color);
      }
      const width = sourceWidth / this.pixelRatio;
      const height = sourceHeight / this.pixelRatio;
      ctx.fillText(base, sourceX / this.pixelRatio + width / 2,
        sourceY / this.pixelRatio + height / 2 + this.baselineOffset);
      glyph = {image, sourceX, sourceY, sourceWidth, sourceHeight, width, height};
      sheet.glyphs.set(base, glyph);
    }
    return glyph;
  }

  /**
   * Paint a cached glyph centered at fractional coordinates, without snapping.
   * @param {CanvasRenderingContext2D} ctx - Target drawing context.
   * @param {String} letter - Nucleotide or amino-acid character.
   * @param {String} color - CSS text color.
   * @param {Number} x - Glyph center x coordinate.
   * @param {Number} y - Glyph center y coordinate.
   * @param {Number} scaleFactor - Detail size relative to the cached font.
   * @returns {undefined} Paints the glyph, preserving context state.
   */
  draw(ctx, letter, color, x, y, scaleFactor) {
    const glyph = this.get(letter, color);
    const width = glyph.width * scaleFactor;
    const height = glyph.height * scaleFactor;
    ctx.drawImage(glyph.image, glyph.sourceX, glyph.sourceY, glyph.sourceWidth, glyph.sourceHeight,
      x - width / 2, y - height / 2, width, height);
  }

  /** Allocate one small sheet per text color. @private */
  _createSheet(color) {
    const pitch = Math.ceil((this.fontSize + 8) * this.pixelRatio);
    const image = document.createElement('canvas');
    image.width = pitch * 8;
    image.height = pitch * 4;
    return {image, ctx: this._configureContext(image, color), pitch, nextSlot: 0, glyphs: new Map()};
  }

  /** Configure a fresh glyph surface at the cache's fixed resolution. @private */
  _configureContext(image, color) {
    const ctx = image.getContext('2d');
    ctx.scale(this.pixelRatio, this.pixelRatio);
    ctx.font = this.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = color;
    return ctx;
  }
}

export default SequenceGlyphCache;
