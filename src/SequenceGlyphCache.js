/**
 * Cache horizontal nucleotide glyphs at a fixed resolution. Scaling these
 * images avoids canvas text snapping to new pixel rows as the map zooms.
 */
class SequenceGlyphCache {
  /**
   * @param {Font} font - Sequence font at its full detail size.
   * @param {Number} pixelRatio - Raster resolution relative to CSS pixels.
   * @param {Number} baselineOffset - Alphabetic baseline below the cap center.
   */
  constructor(font, pixelRatio, baselineOffset) {
    this.font = font.css;
    this.fontSize = font.height;
    this.pixelRatio = pixelRatio;
    this.baselineOffset = baselineOffset;
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
      // Retain black, white, and a custom single color without accumulating
      // every intermediate color chosen in the color picker.
      if (this._colors.size === 3) { this._colors.clear(); }
      sheet = this._createSheet(color);
      this._colors.set(color, sheet);
      // Paint the nucleotide alphabet before the first image draw so the sheet
      // can be uploaded once and reused throughout the frame.
      for (const letter of 'ACGTURYSWKMBDHVN•') { this.get(letter, color); }
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
