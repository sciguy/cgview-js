import Canvas from '../src/Canvas';

jest.mock('d3', () => ({}));

describe('Canvas', () => {

  let canvas;
  let context;

  beforeEach(() => {
    context = {
      beginPath: jest.fn(),
      closePath: jest.fn(),
      fill: jest.fn(),
      fillText: jest.fn(),
      lineTo: jest.fn(),
      restore: jest.fn(),
      rotate: jest.fn(),
      save: jest.fn(),
      scale: jest.fn(),
      setLineDash: jest.fn(),
      stroke: jest.fn(),
      strokeText: jest.fn(),
      translate: jest.fn(),
    };
    canvas = Object.create(Canvas.prototype);
    canvas._viewer = {
      legend: {defaultMinArcLength: 1},
      sequence: {
        length: 100,
        lengthOfRange(start, stop) {
          return stop >= start ? stop - start : this.length + (stop - start);
        },
      },
      scale: {bp: jest.fn(bp => bp / 100)},
      settings: {
        arrowHeadLength: 0.3,
        borderColor: {rgbaString: 'rgba(0,0,0,1)'},
        borderThickness: 1.5,
        adaptiveBorderThickness: false,
        showBorder: false,
        showShading: false,
      },
      zoomFactor: 1,
    };
    canvas._layerNames = ['map'];
    canvas._layers = {map: {ctx: context}};
    canvas._pixelLengthThreshold = 0.1;
    canvas.path = jest.fn();
    canvas.pointForBp = jest.fn((bp, centerOffset) => ({
      x: bp,
      y: centerOffset,
    }));
    canvas.pixelsPerBp = jest.fn();
  });

  function drawAutoArrow({pixelsPerBp, start = 10, stop = 10, width = 20}) {
    canvas.pixelsPerBp.mockReturnValue(pixelsPerBp);
    canvas.drawElement({
      layer: 'map',
      start,
      stop,
      centerOffset: 100,
      width,
      decoration: 'clockwise-arrow',
      autoArrow: true,
      showShading: false,
      showBorder: false,
      minArcLength: 0,
    });
  }

  test('draws auto as an arc at the minimum-length threshold', () => {
    drawAutoArrow({pixelsPerBp: 5});

    expect(context.stroke).toHaveBeenCalledTimes(1);
    expect(context.fill).not.toHaveBeenCalled();
  });

  test('draws auto as an arrow above the minimum-length threshold', () => {
    drawAutoArrow({pixelsPerBp: 5.01});

    expect(context.fill).toHaveBeenCalledTimes(1);
    expect(context.stroke).not.toHaveBeenCalled();
  });

  test('grows the auto arrowhead while preserving the minimum body', () => {
    drawAutoArrow({pixelsPerBp: 1, start: 10, stop: 17});

    const firstPath = canvas.path.mock.calls[0];
    expect(firstPath[2]).toBeCloseTo(9.5);
    expect(firstPath[3]).toBeCloseTo(14.5);
    expect(canvas.pointForBp).toHaveBeenCalledWith(17.5, 100);
  });

  test('uses the configured arrowhead length when it fits', () => {
    drawAutoArrow({pixelsPerBp: 1, start: 10, stop: 21});

    const firstPath = canvas.path.mock.calls[0];
    expect(firstPath[2]).toBeCloseTo(9.5);
    expect(firstPath[3]).toBeCloseTo(15.5);
    expect(canvas.pointForBp).toHaveBeenCalledWith(21.5, 100);
  });

  test('keeps the configured arrowhead length while the body grows', () => {
    drawAutoArrow({pixelsPerBp: 1, start: 10, stop: 25});

    const firstPath = canvas.path.mock.calls[0];
    expect(firstPath[2]).toBeCloseTo(9.5);
    expect(firstPath[3]).toBeCloseTo(19.5);
    expect(canvas.pointForBp).toHaveBeenCalledWith(25.5, 100);
  });

  test('preserves the existing short-arrow expansion', () => {
    canvas.pixelsPerBp.mockReturnValue(1);

    canvas.drawElement({
      layer: 'map',
      start: 10,
      stop: 13,
      centerOffset: 100,
      width: 20,
      decoration: 'clockwise-arrow',
      showShading: false,
      showBorder: false,
    });

    expect(canvas.pointForBp).toHaveBeenCalledWith(14.55, 100);
  });

  test('reports the same configured and automatic arrowhead lengths used for drawing', () => {
    canvas.pixelsPerBp.mockReturnValue(1);

    expect(canvas.arrowHeadLengthPixels({centerOffset: 100, featureLengthBp: 20, width: 20})).toBe(6);
    expect(canvas.arrowHeadLengthPixels({autoArrow: true, centerOffset: 100, featureLengthBp: 5, width: 20})).toBe(0);
    expect(canvas.arrowHeadLengthPixels({autoArrow: true, centerOffset: 100, featureLengthBp: 8, width: 20})).toBe(3);
    expect(canvas.arrowHeadLengthPixels({autoArrow: true, centerOffset: 100, featureLengthBp: 20, width: 20})).toBe(6);
  });

  test('uses translation border overrides without changing the default feature border', () => {
    canvas.pixelsPerBp.mockReturnValue(12);
    const options = {start: 10, stop: 12, centerOffset: 100, width: 16, showBorder: true};
    canvas.drawElement({...options, borderColor: 'green', borderThickness: 0.4});
    expect(context.strokeStyle).toBe('green');
    expect(context.lineWidth).toBe(0.4);

    canvas.drawElement(options);
    expect(context.strokeStyle).toBe('rgba(0,0,0,1)');
    expect(context.lineWidth).toBe(1.5);
  });

  describe.each(['arc', 'clockwise-arrow', 'counterclockwise-arrow'])('%s borders', decoration => {
    function borderWidths(options = {}) {
      const widths = [];
      context.stroke.mockImplementation(() => {
        if (context.strokeStyle === 'rgba(0,0,0,1)') { widths.push(context.lineWidth); }
      });
      canvas.drawElement({
        start: 10, stop: 29, centerOffset: 100, width: 20,
        decoration, color: 'red', showBorder: true, ...options,
      });
      return widths;
    }

    test('keeps the configured width through zoom and size changes when adaptation is off', () => {
      for (const zoom of [1, 1.5, 2, 10]) {
        canvas._viewer.zoomFactor = zoom;
        canvas.pixelsPerBp.mockReturnValue(zoom);
        expect(borderWidths({stop: 10})).toEqual([1.5]);
        expect(borderWidths()).toEqual([1.5]);
      }
    });

    test('suppresses tiny and thin elements before minimum-length expansion', () => {
      canvas._viewer.settings.adaptiveBorderThickness = true;
      canvas.pixelsPerBp.mockReturnValue(1);
      expect(borderWidths({stop: 10, minArcLength: 10})).toEqual([]);
      expect(borderWidths({stop: 11})).toEqual([]);
      expect(borderWidths({width: 2})).toEqual([]);
    });

    test('grows borders with screen size up to the configured maximum', () => {
      canvas._viewer.settings.adaptiveBorderThickness = true;
      canvas._viewer.zoomFactor = 2;
      const widths = [1, 2, 3, 4, 6, 8, 16].map(pixels => {
        canvas.pixelsPerBp.mockReturnValue(pixels);
        return borderWidths({stop: 10})[0] || 0;
      });
      expect(widths.slice(0, 2)).toEqual([0, 0]);
      expect(widths[2]).toBeGreaterThan(0);
      expect(widths[3]).toBeGreaterThan(widths[2]);
      expect(widths[4]).toBeGreaterThan(widths[3]);
      expect(widths.slice(-2)).toEqual([1.5, 1.5]);
    });

    test('uses both screen dimensions to reduce borders', () => {
      canvas._viewer.settings.adaptiveBorderThickness = true;
      canvas.pixelsPerBp.mockReturnValue(1);
      const short = borderWidths({stop: 13});
      const thin = borderWidths({width: 4});
      const large = borderWidths();
      expect(short).toEqual(thin);
      expect(short[0]).toBeGreaterThan(0);
      expect(short[0]).toBeLessThan(large[0]);
    });

    test('also multiplies size-adjusted borders by zoom, capped at zoom 2', () => {
      canvas._viewer.settings.adaptiveBorderThickness = true;
      // Keep screen geometry fixed to isolate the additional zoom multiplier.
      canvas.pixelsPerBp.mockReturnValue(1);
      for (const [zoom, multiplier] of [[1, 0.5], [1.5, 0.75], [2, 1], [10, 1]]) {
        canvas._viewer.zoomFactor = zoom;
        expect(borderWidths({stop: 13})[0]).toBeCloseTo(0.5 * multiplier);
        expect(borderWidths()[0]).toBeCloseTo(1.5 * multiplier);
        expect(borderWidths({stop: 10})).toEqual([]);
      }
    });

    test('measures origin-spanning elements consistently', () => {
      canvas._viewer.settings.adaptiveBorderThickness = true;
      canvas.pixelsPerBp.mockReturnValue(1);
      expect(borderWidths({start: 98, stop: 2})).toEqual(borderWidths({start: 10, stop: 14}));
    });

    test('preserves explicit widths and selection outlines on tiny elements', () => {
      canvas._viewer.settings.adaptiveBorderThickness = true;
      canvas.pixelsPerBp.mockReturnValue(1);
      expect(borderWidths({stop: 10, borderThickness: 0.4})).toEqual([0.4]);
      expect(borderWidths({stop: 10, selected: true, showBorder: false})).toEqual([2.5]);
      expect(context.setLineDash).toHaveBeenCalledWith([3, 1]);
      expect(context.setLineDash).toHaveBeenLastCalledWith([]);
    });

    test('omits zero-width and disabled borders', () => {
      canvas.pixelsPerBp.mockReturnValue(1);
      expect(borderWidths({borderThickness: 0})).toEqual([]);
      canvas._viewer.settings.borderThickness = 0;
      expect(borderWidths()).toEqual([]);
      canvas._viewer.settings.borderThickness = 1.5;
      canvas._viewer.settings.adaptiveBorderThickness = true;
      expect(borderWidths({showBorder: false})).toEqual([]);
    });
  });

  test('keeps shaded edges narrow when the backbone expands for translations', () => {
    canvas.pixelsPerBp.mockReturnValue(12);
    const widths = [];
    context.stroke.mockImplementation(() => widths.push(context.lineWidth));
    canvas.drawElement({
      start: 10, stop: 12, centerOffset: 100, width: 160,
      showShading: true, shadingWidth: 2,
    });
    expect(widths).toEqual([156, 2, 2]);
  });

  test('draws all straight-text halos before fills and restores the context state', () => {
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    canvas.drawText(ctx, ['Title', 'Subtitle'], 10, 20, {
      lineHeight: 15, haloColor: 'rgba(255,255,255,0.5)', haloWidth: 3,
    });
    expect(ctx.strokeText.mock.calls).toEqual([['Title', 10, 20], ['Subtitle', 10, 35]]);
    expect(ctx.fillText.mock.calls).toEqual(ctx.strokeText.mock.calls);
    expect(Math.max(...ctx.strokeText.mock.invocationCallOrder))
      .toBeLessThan(Math.min(...ctx.fillText.mock.invocationCallOrder));
    expect(ctx.strokeStyle).toBe('#ff0000');
    expect(ctx.lineWidth).toBe(1);
    expect(ctx.getLineDash()).toEqual([2, 4]);
  });

  test('draws curved text with a complete halo pass before glyph fills', () => {
    canvas.pixelsPerBp.mockReturnValue(2);

    expect(canvas.drawTextAlongArc({
      bp: 50,
      centerOffset: 100,
      characters: ['A', 'B'],
      widths: [4, 6],
      totalWidth: 10,
      font: 'normal 12px sans-serif',
      color: 'black',
      haloColor: 'white',
      haloWidth: 3,
    })).toBe(true);

    expect(context.strokeText.mock.calls.map(call => call[0])).toEqual(['A', 'B']);
    expect(context.fillText.mock.calls.map(call => call[0])).toEqual(['A', 'B']);
    expect(Math.max(...context.strokeText.mock.invocationCallOrder))
      .toBeLessThan(Math.min(...context.fillText.mock.invocationCallOrder));
    expect(context.rotate).toHaveBeenCalledTimes(4);
  });

  test('reverses the glyph path when curved text is on the lower semicircle', () => {
    canvas.pixelsPerBp.mockReturnValue(2);
    canvas._viewer.scale.bp.mockReturnValue(3 * Math.PI / 4);

    canvas.drawTextAlongArc({
      bp: 50,
      centerOffset: 100,
      characters: ['A', 'B'],
      widths: [10, 10],
      totalWidth: 20,
      font: 'normal 10px sans-serif',
      color: 'black',
    });

    expect(canvas.pointForBp.mock.calls.map(call => call[0])).toEqual([52.5, 47.5]);
  });

  test('skips curved text when its measurements are incomplete', () => {
    canvas.pixelsPerBp.mockReturnValue(2);

    const drawn = canvas.drawTextAlongArc({
      bp: 50,
      centerOffset: 100,
      characters: ['A', 'B'],
      widths: [10],
      totalWidth: 10,
      font: 'normal 10px sans-serif',
      color: 'black',
    });

    expect(drawn).toBe(false);
    expect(context.fillText).not.toHaveBeenCalled();
  });

  test('scales curved glyphs around their fixed centers', () => {
    canvas.pixelsPerBp.mockReturnValue(2);

    expect(canvas.drawTextAlongArc({
      bp: 50,
      centerOffset: 100,
      characters: ['A', 'B'],
      widths: [4, 6],
      widthScale: 0.75,
      totalWidth: 7.5,
      font: 'normal 12px sans-serif',
      color: 'black',
    })).toBe(true);

    expect(context.scale.mock.calls).toEqual([
      [0.75, 0.75],
      [0.75, 0.75],
    ]);
  });

});
