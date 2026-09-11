import Viewer from '../src/Viewer';

describe('Sequence zoom detail', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="map"></div><div id="second-map"></div>';
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('uses horizontal base text by default and omits it from normal JSON', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'ATGC'}});

    expect(cgv.sequence.baseTextOrientation).toBe('horizontal');
    expect(cgv.sequence.toJSON()).not.toHaveProperty('baseTextOrientation');
    expect(cgv.sequence.toJSON({includeDefaults: true}).baseTextOrientation)
      .toBe('horizontal');
  });

  test('draws curved circular bases on the readable local tangent', () => {
    const cgv = new Viewer('#map', {
      sequence: {seq: 'ATGC', baseTextOrientation: 'curved'},
    });
    const ctx = cgv.canvas.context('map');
    const pointForBp = jest.spyOn(cgv.canvas, 'pointForBp').mockReturnValue({x: 12, y: 34});
    const orientation = jest.spyOn(cgv.canvas, 'tangentialTextOrientationForBp')
      .mockReturnValue({angle: 0.4, flipped: false});

    cgv.sequence._drawBase(ctx, 'A', 2, 100, 5);

    expect(pointForBp).toHaveBeenCalledWith(2, 100);
    expect(orientation).toHaveBeenCalledWith(2);
    expect(ctx.translate).toHaveBeenLastCalledWith(12, 34);
    expect(ctx.rotate).toHaveBeenLastCalledWith(0.4);
    expect(ctx.fillText).toHaveBeenLastCalledWith('A', 0, 5);
  });

  test('keeps horizontal circular bases unrotated', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'ATGC'}});
    const ctx = cgv.canvas.context('map');
    jest.spyOn(cgv.canvas, 'pointForBp').mockReturnValue({x: 12, y: 34});
    const orientation = jest.spyOn(cgv.canvas, 'tangentialTextOrientationForBp');
    ctx.rotate.mockClear();
    ctx.fillText.mockClear();

    cgv.sequence._drawBase(ctx, 'A', 2, 100, 5);

    expect(orientation).not.toHaveBeenCalled();
    expect(ctx.rotate).not.toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenLastCalledWith('A', 12, 39);
  });

  test('falls back to horizontal text on linear maps', () => {
    const cgv = new Viewer('#map', {
      sequence: {seq: 'ATGC', baseTextOrientation: 'curved'},
    });
    cgv.format = 'linear';
    const ctx = cgv.canvas.context('map');
    jest.spyOn(cgv.canvas, 'pointForBp').mockReturnValue({x: 12, y: 34});
    const orientation = jest.spyOn(cgv.canvas, 'tangentialTextOrientationForBp');
    ctx.rotate.mockClear();
    ctx.fillText.mockClear();

    cgv.sequence._drawBase(ctx, 'A', 2, 100, 5);

    expect(orientation).not.toHaveBeenCalled();
    expect(ctx.rotate).not.toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenLastCalledWith('A', 12, 39);
  });

  test('reuses one calculated angle for paired sequence bases', () => {
    const cgv = new Viewer('#map', {
      sequence: {seq: 'ATGC', baseTextOrientation: 'curved'},
    });
    const ctx = cgv.canvas.context('map');
    jest.spyOn(cgv.canvas, 'pointForBp').mockReturnValue({x: 12, y: 34});
    const orientation = jest.spyOn(cgv.canvas, 'tangentialTextOrientationForBp');
    ctx.rotate.mockClear();

    cgv.sequence._drawBase(ctx, 'A', 2, 105, 5, 0.4);
    cgv.sequence._drawBase(ctx, 'T', 2, 95, 5, 0.4);

    expect(orientation).not.toHaveBeenCalled();
    expect(ctx.rotate).toHaveBeenCalledTimes(2);
    expect(ctx.rotate).toHaveBeenLastCalledWith(0.4);
  });

  test('updates both settings and rejects unsupported values', () => {
    const cgv = new Viewer('#map', {
      sequence: {seq: 'ATGC'},
    });
    const listener = jest.fn();
    cgv.on('sequence-update.sequence-detail-test', listener);

    cgv.sequence.update({baseColorMode: 'byBase', baseTextOrientation: 'curved'});
    expect(cgv.sequence.baseColorMode).toBe('byBase');
    expect(cgv.sequence.baseTextOrientation).toBe('curved');
    expect(listener).toHaveBeenCalledWith({
      attributes: {baseColorMode: 'byBase', baseTextOrientation: 'curved'},
    });

    jest.spyOn(console, 'error').mockImplementation(() => {});
    cgv.sequence.update({baseColorMode: 'invalid', baseTextOrientation: 'invalid'});
    expect(cgv.sequence.baseColorMode).toBe('byBase');
    expect(cgv.sequence.baseTextOrientation).toBe('curved');
  });

  test('round trips curved base text orientation', () => {
    const firstViewer = new Viewer('#map', {
      sequence: {seq: 'ATGC', baseTextOrientation: 'curved'},
    });
    const json = firstViewer.io.toJSON();
    const secondViewer = new Viewer('#second-map');

    expect(json.cgview.sequence.baseTextOrientation).toBe('curved');
    secondViewer.io.loadJSON(json);
    expect(secondViewer.sequence.baseTextOrientation).toBe('curved');
  });

  test('never returns an upside-down tangential angle', () => {
    const cgv = new Viewer('#map', {sequence: {length: 360}});

    for (let bp = 1; bp <= 360; bp += 5) {
      const {angle} = cgv.canvas.tangentialTextOrientationForBp(bp);
      expect(angle).toBeGreaterThanOrEqual(-Math.PI / 2);
      expect(angle).toBeLessThanOrEqual(Math.PI / 2);
    }
  });
});
