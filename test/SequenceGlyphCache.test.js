import Font from '../src/Font';
import SequenceGlyphCache from '../src/SequenceGlyphCache';

describe('Sequence glyph cache', () => {
  afterEach(() => jest.restoreAllMocks());

  test('reuses cap metrics across zooms and invalidates them after a font mutation', () => {
    const ctx = document.createElement('canvas').getContext('2d');
    const font = new Font('monospace,plain,11');
    ctx.font = '6px serif';
    ctx.textBaseline = 'middle';
    const measure = jest.spyOn(ctx, 'measureText').mockReturnValue({actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 0});

    expect(SequenceGlyphCache.baselineOffsetForFont(ctx, font)).toBe(4);
    expect(SequenceGlyphCache.baselineOffsetForFont(ctx, font)).toBe(4);
    expect(measure).toHaveBeenCalledTimes(1);
    expect(ctx.font).toBe('6px serif');
    expect(ctx.textBaseline).toBe('middle');

    font.size = 14;
    measure.mockReturnValue({actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 0});
    expect(SequenceGlyphCache.baselineOffsetForFont(ctx, font)).toBe(5);
    expect(measure).toHaveBeenCalledTimes(2);
  });

  test('reuses glyphs without new text measurement and handles raster and SVG export contexts', () => {
    const ctx = document.createElement('canvas').getContext('2d');
    const font = new Font('monospace,plain,11');
    const cache = SequenceGlyphCache.forContext(ctx, font, undefined, 'ACDEFGHIKLMNPQRSTVWYBXZJUO*');
    const glyph = cache.get('H', 'black');
    const measure = jest.spyOn(glyph.image.getContext('2d'), 'measureText');
    measure.mockClear();
    for (const scale of [0.5, 0.501, 0.625, 1]) {
      cache.draw(ctx, 'H', 'black', 10.1, 12.7, scale);
    }
    expect(measure).not.toHaveBeenCalled();
    expect(SequenceGlyphCache.forContext(ctx, font, cache)).toBe(cache);

    ctx.scale(4, 4);
    const exportedCache = SequenceGlyphCache.forContext(ctx, font, cache);
    expect(exportedCache).not.toBe(cache);
    expect(exportedCache.pixelRatio).toBe(4);
    ctx.getSerializedSvg = () => '<svg />';
    expect(SequenceGlyphCache.forContext(ctx, font, exportedCache)).toBeUndefined();
  });
});
