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

  test('is enabled by default', () => {
    expect(cgv.selection.enabled).toBe(true);
  });

  test('selects one clicked feature and deselects other features', () => {
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
    cgv.selection.handleClick({
      elementType: 'label',
      element: features[0].label,
      d3: { shiftKey: false }
    });

    expect(features[0].selected).toBe(true);
  });

  test('escape clears selected features', () => {
    features[0].selected = true;
    features[1].selected = true;

    cgv.selection.handleKeydown({ key: 'Escape' });

    expect(features[0].selected).toBe(false);
    expect(features[1].selected).toBe(false);
    expect(features[2].selected).toBe(false);
    expect(cgv.draw).toHaveBeenCalledTimes(1);
  });

  test('clicking without a feature clears selected features', () => {
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

  test('marquee drag selects overlapping visible features and draws on UI layer', () => {
    cgv.canvas.drawElement = jest.fn();
    cgv.canvas.radiantLine = jest.fn();

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
    expect(cgv.canvas.radiantLine).toHaveBeenCalledTimes(2);
  });

  test('marquee drag reverses only features selected by the marquee', () => {
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
