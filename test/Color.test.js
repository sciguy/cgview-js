import Color from '../src/Color';

describe('Color contrast', () => {

  test('calculates WCAG relative luminance and contrast ratios', () => {
    const black = new Color('black');
    const white = new Color('white');

    expect(black.relativeLuminance).toBe(0);
    expect(white.relativeLuminance).toBe(1);
    expect(black.contrastRatio(white)).toBeCloseTo(21);
  });

  test('alpha-composites colors without changing either input', () => {
    const foreground = new Color('rgba(0,0,0,0.25)');
    const background = new Color('white');
    const composite = foreground.compositeOver(background);

    expect(composite.rgba).toEqual({r: 191, g: 191, b: 191, a: 1});
    expect(foreground.rgbaString).toBe('rgba(0,0,0,0.25)');
    expect(background.rgbaString).toBe('rgba(255,255,255,1)');
  });

  test('chooses the candidate with greater contrast', () => {
    expect(new Color('#f0b040').contrastColor().rgbaString).toBe('rgba(0,0,0,1)');
    expect(new Color('#205080').contrastColor().rgbaString).toBe('rgba(255,255,255,1)');
  });
});
