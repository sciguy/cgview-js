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
      settings: {
        arrowHeadLength: 0.3,
        borderColor: {rgbaString: 'rgba(0,0,0,1)'},
        borderThickness: 1.5,
        showBorder: false,
        showShading: false,
      },
      scale: {bp: jest.fn(bp => bp / 100)},
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

  test('draws measured text along an arc with the complete halo pass first', () => {
    canvas.pixelsPerBp.mockReturnValue(2);

    const drawn = canvas.drawTextAlongArc({
      bp: 50,
      centerOffset: 100,
      characters: ['A', 'B'],
      widths: [10, 10],
      totalWidth: 20,
      font: 'normal 10px sans-serif',
      color: 'black',
      haloColor: 'white',
      haloWidth: 4,
    });

    expect(drawn).toBe(true);
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

});
