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
      lineTo: jest.fn(),
      setLineDash: jest.fn(),
      stroke: jest.fn(),
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

  test('draws auto as an arc at the two-pixel threshold', () => {
    drawAutoArrow({pixelsPerBp: 2});

    expect(context.stroke).toHaveBeenCalledTimes(1);
    expect(context.fill).not.toHaveBeenCalled();
  });

  test('draws auto as an arrow above the two-pixel threshold', () => {
    drawAutoArrow({pixelsPerBp: 2.01});

    expect(context.fill).toHaveBeenCalledTimes(1);
    expect(context.stroke).not.toHaveBeenCalled();
  });

  test('caps an auto arrowhead at the current element length', () => {
    drawAutoArrow({pixelsPerBp: 1, start: 10, stop: 13});

    const firstPath = canvas.path.mock.calls[0];
    expect(firstPath[2]).toBeCloseTo(9.5);
    expect(firstPath[3]).toBeCloseTo(9.5);
    expect(canvas.pointForBp).toHaveBeenCalledWith(13.5, 100);
  });

  test('uses the configured arrowhead length when it fits', () => {
    drawAutoArrow({pixelsPerBp: 1, start: 10, stop: 19});

    const firstPath = canvas.path.mock.calls[0];
    expect(firstPath[2]).toBeCloseTo(9.5);
    expect(firstPath[3]).toBeCloseTo(13.5);
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

});
