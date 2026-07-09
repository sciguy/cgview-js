import Viewer from '../src/Viewer';

describe('Selection', () => {

  let cgv;
  let features;

  beforeEach(() => {
    document.body.innerHTML = '<div id="map"></div>';
    cgv = new Viewer('#map', {
      sequence: { length: 1000 },
      features: [
        { name: 'f1', start: 10, stop: 20 },
        { name: 'f2', start: 30, stop: 40 },
        { name: 'f3', start: 50, stop: 60 },
      ],
    });
    features = cgv.features();
    cgv.draw = jest.fn();
  });

  afterEach(() => {
    cgv.selection.detach();
  });

  test('is disabled by default', () => {
    expect(cgv.selection.enabled).toBe(false);
  });

  test('can be enabled and disabled repeatedly from viewer events', () => {
    cgv.selection.enabled = true;
    cgv.trigger('click', {
      elementType: 'feature',
      element: features[0],
      d3: { shiftKey: false }
    });

    expect(features[0].selected).toBe(true);

    features[0].selected = false;
    cgv.draw.mockClear();
    cgv.selection.enabled = false;
    cgv.trigger('click', {
      elementType: 'feature',
      element: features[0],
      d3: { shiftKey: false }
    });

    expect(features[0].selected).toBe(false);
    expect(cgv.draw).not.toHaveBeenCalled();

    cgv.selection.enabled = true;
    cgv.trigger('click', {
      elementType: 'feature',
      element: features[0],
      d3: { shiftKey: false }
    });

    expect(features[0].selected).toBe(true);
    expect(cgv.draw).toHaveBeenCalledTimes(1);
  });

  test('triggers selection-update when enabled changes directly', () => {
    const listener = jest.fn();
    cgv.on('selection-update.test', listener);

    cgv.selection.enabled = true;
    cgv.selection.enabled = false;

    expect(listener).toHaveBeenCalledWith({ attributes: { enabled: true } });
    expect(listener).toHaveBeenCalledWith({ attributes: { enabled: false } });
  });

  test('does not select from direct click handling when disabled', () => {
    cgv.selection.handleClick({
      elementType: 'feature',
      element: features[0],
      d3: { shiftKey: false }
    });

    expect(features[0].selected).toBe(false);
    expect(cgv.draw).not.toHaveBeenCalled();
  });

  test('selects one clicked feature and deselects other features', () => {
    cgv.selection.enabled = true;
    features[1].selected = true;

    cgv.selection.handleClick({
      elementType: 'feature',
      element: features[0],
      d3: { shiftKey: false }
    });

    expect(features[0].selected).toBe(true);
    expect(features[1].selected).toBe(false);
    expect(features[2].selected).toBe(false);
    expect(cgv.draw).toHaveBeenCalledTimes(1);
  });

  test('shift-click adds a feature to the selection', () => {
    cgv.selection.enabled = true;
    features[1].selected = true;

    cgv.selection.handleClick({
      elementType: 'feature',
      element: features[0],
      d3: { shiftKey: true }
    });

    expect(features[0].selected).toBe(true);
    expect(features[1].selected).toBe(true);
    expect(features[2].selected).toBe(false);
  });

  test('selects a feature from its label click event', () => {
    cgv.selection.enabled = true;

    cgv.selection.handleClick({
      elementType: 'label',
      element: features[0].label,
      d3: { shiftKey: false }
    });

    expect(features[0].selected).toBe(true);
  });

  test('escape clears selected features', () => {
    cgv.selection.enabled = true;
    features[0].selected = true;
    features[1].selected = true;

    cgv.selection.handleKeydown({ key: 'Escape' });

    expect(features[0].selected).toBe(false);
    expect(features[1].selected).toBe(false);
    expect(features[2].selected).toBe(false);
    expect(cgv.draw).toHaveBeenCalledTimes(1);
  });

  test('clicking without a feature clears selected features', () => {
    cgv.selection.enabled = true;
    features[0].selected = true;
    features[1].selected = true;

    cgv.selection.handleClick({
      elementType: 'backbone',
      element: cgv.backbone,
      d3: { shiftKey: false }
    });

    expect(features[0].selected).toBe(false);
    expect(features[1].selected).toBe(false);
    expect(features[2].selected).toBe(false);
    expect(cgv.draw).toHaveBeenCalledTimes(1);
  });

  test('shift-mousedown over no element starts marquee selection', () => {
    cgv.selection.enabled = true;
    const preventDefault = jest.fn();

    cgv.selection.handleMousedown({
      bp: 5,
      elementType: undefined,
      d3: { shiftKey: true, preventDefault }
    });

    expect(cgv.selection.marqueeRange().start).toBe(5);
    expect(cgv.selection.marqueeRange().stop).toBe(5);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  test('shift-mousedown over map elements starts marquee selection', () => {
    cgv.selection.enabled = true;
    const elementTypes = ['feature', 'label', 'plot'];

    for (const elementType of elementTypes) {
      const preventDefault = jest.fn();
      cgv.selection.handleMousedown({
        bp: 5,
        elementType,
        d3: { shiftKey: true, preventDefault }
      });

      expect(cgv.selection.marqueeRange().start).toBe(5);
      expect(preventDefault).toHaveBeenCalledTimes(1);
      cgv.selection.handleMouseup({ bp: 5 });
    }
  });

  test('shift-mousedown over page chrome does not start marquee selection', () => {
    cgv.selection.enabled = true;

    cgv.selection.handleMousedown({
      bp: 5,
      elementType: 'legendItem',
      d3: { shiftKey: true, preventDefault: jest.fn() }
    });

    expect(cgv.selection.marqueeRange()).toBeUndefined();
  });

  test('marquee drag selects overlapping visible features and draws on UI layer', () => {
    cgv.selection.enabled = true;
    cgv.canvas.drawElement = jest.fn();
    cgv.canvas.path = jest.fn();
    cgv.canvas.radiantLine = jest.fn();
    const innerOffset = Math.min(cgv.layout.centerInsideOffset, cgv.layout.centerOutsideOffset);
    const outerOffset = Math.max(cgv.layout.centerInsideOffset, cgv.layout.centerOutsideOffset);
    const marqueeInnerOffset = innerOffset - 2;
    const marqueeOuterOffset = outerOffset + 2;
    const marqueeWidth = marqueeOuterOffset - marqueeInnerOffset;

    cgv.selection.handleMousedown({
      bp: 5,
      elementType: undefined,
      d3: { shiftKey: true, preventDefault: jest.fn() }
    });
    cgv.selection.handleMousemove({ bp: 35 });

    expect(features[0].selected).toBe(true);
    expect(features[1].selected).toBe(true);
    expect(features[2].selected).toBe(false);
    expect(cgv.canvas.drawElement).toHaveBeenCalledWith(expect.objectContaining({
      layer: 'ui',
      start: 5,
      stop: 35
    }));
    expect(cgv.canvas.drawElement.mock.calls[0][0].width).toBeCloseTo(marqueeWidth);
    expect(cgv.canvas.path).toHaveBeenCalledTimes(2);
    expect(cgv.canvas.path).toHaveBeenNthCalledWith(1, 'ui', marqueeInnerOffset, 5, 35);
    expect(cgv.canvas.path).toHaveBeenNthCalledWith(2, 'ui', marqueeOuterOffset, 5, 35);
    expect(cgv.canvas.radiantLine).toHaveBeenCalledTimes(2);
  });

  test('circular counterclockwise marquee uses the swept range instead of the inverse', () => {
    cgv.selection.enabled = true;
    const newFeatures = cgv.addFeatures([
      { name: 'near-start', start: 90, stop: 95 },
      { name: 'inverse-side', start: 500, stop: 510 },
    ]);

    cgv.selection.handleMousedown({
      bp: 100,
      elementType: undefined,
      d3: { shiftKey: true, preventDefault: jest.fn() }
    });
    cgv.selection.handleMousemove({ bp: 90 });

    expect(cgv.selection.marqueeRange().start).toBe(90);
    expect(cgv.selection.marqueeRange().stop).toBe(100);
    expect(newFeatures[0].selected).toBe(true);
    expect(newFeatures[1].selected).toBe(false);
    expect(features[0].selected).toBe(false);
  });

  test('circular counterclockwise marquee can cross the origin', () => {
    cgv.selection.enabled = true;
    const newFeatures = cgv.addFeatures([
      { name: 'near-origin', start: 990, stop: 995 },
      { name: 'inverse-side', start: 500, stop: 510 },
    ]);

    cgv.selection.handleMousedown({
      bp: 10,
      elementType: undefined,
      d3: { shiftKey: true, preventDefault: jest.fn() }
    });
    cgv.selection.handleMousemove({ bp: 990 });

    expect(cgv.selection.marqueeRange().start).toBe(990);
    expect(cgv.selection.marqueeRange().stop).toBe(10);
    expect(newFeatures[0].selected).toBe(true);
    expect(newFeatures[1].selected).toBe(false);
  });

  test('marquee drag reverses only features selected by the marquee', () => {
    cgv.selection.enabled = true;
    features[1].selected = true;
    cgv.canvas.drawElement = jest.fn();
    cgv.canvas.radiantLine = jest.fn();

    cgv.selection.handleMousedown({
      bp: 5,
      elementType: undefined,
      d3: { shiftKey: true, preventDefault: jest.fn() }
    });
    cgv.selection.handleMousemove({ bp: 65 });

    expect(features[0].selected).toBe(true);
    expect(features[1].selected).toBe(true);
    expect(features[2].selected).toBe(true);

    cgv.selection.handleMousemove({ bp: 20 });

    expect(features[0].selected).toBe(true);
    expect(features[1].selected).toBe(true);
    expect(features[2].selected).toBe(false);
  });

  test('marquee mouseup clears UI and suppresses the generated click', () => {
    cgv.selection.enabled = true;
    cgv.clear = jest.fn();
    cgv.canvas.drawElement = jest.fn();
    cgv.canvas.radiantLine = jest.fn();

    cgv.selection.handleMousedown({
      bp: 5,
      elementType: undefined,
      d3: { shiftKey: true, preventDefault: jest.fn() }
    });
    cgv.selection.handleMousemove({ bp: 35 });
    cgv.selection.handleMouseup({ bp: 35 });
    cgv.selection.handleClick({});

    expect(features[0].selected).toBe(true);
    expect(features[1].selected).toBe(true);
    expect(features[2].selected).toBe(false);
    expect(cgv.clear).toHaveBeenCalledWith('ui');
  });

  test('does not select from viewer click events when disabled', () => {
    cgv.selection.enabled = false;

    cgv.trigger('click', {
      elementType: 'feature',
      element: features[0],
      d3: { shiftKey: false }
    });

    expect(features[0].selected).toBe(false);
  });

});
