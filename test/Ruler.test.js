import Viewer from '../src/Viewer';

describe('Ruler labels', () => {

  beforeEach(() => {
    document.body.innerHTML = '<div id="map"></div>';
  });

  function viewer(options = {}) {
    return new Viewer('#map', {
      width: 800,
      height: 600,
      sequence: {length: 1000},
      ...options,
    });
  }

  test('uses backward-compatible label defaults and serializes them', () => {
    const cgv = viewer();

    expect(cgv.ruler.labelPosition).toBe('inside');
    expect(cgv.ruler.labelOrientation).toBe('horizontal');
    expect(cgv.ruler.toJSON()).toMatchObject({
      labelPosition: 'inside',
      labelOrientation: 'horizontal',
    });
  });

  test('updates and round-trips ruler label presentation', () => {
    const cgv = viewer({
      ruler: {
        labelPosition: 'outside',
        labelOrientation: 'curved',
      },
    });

    expect(cgv.ruler.labelPosition).toBe('outside');
    expect(cgv.ruler.labelOrientation).toBe('curved');

    cgv.ruler.update({labelPosition: 'both'});
    expect(cgv.io.toJSON().cgview.ruler).toMatchObject({
      labelPosition: 'both',
      labelOrientation: 'curved',
    });
  });

  test('keeps the current value when an invalid presentation is supplied', () => {
    const cgv = viewer({
      ruler: {
        labelPosition: 'outside',
        labelOrientation: 'curved',
      },
    });
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    cgv.ruler.update({labelPosition: 'outer', labelOrientation: 'tangential'});

    expect(cgv.ruler.labelPosition).toBe('outside');
    expect(cgv.ruler.labelOrientation).toBe('curved');
    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  test.each([
    ['inside', true, false],
    ['outside', false, true],
    ['both', true, true],
    ['none', false, false],
  ])('draws labels at the requested %s position', (labelPosition, insideLabels, outsideLabels) => {
    const cgv = viewer({ruler: {labelPosition}});
    jest.spyOn(cgv.ruler, '_updateTicks').mockImplementation(() => {});
    const drawForCenterOffset = jest.spyOn(cgv.ruler, 'drawForCenterOffset').mockImplementation(() => {});

    cgv.ruler.draw(100, 200, 'foreground');

    expect(drawForCenterOffset).toHaveBeenNthCalledWith(1, 98, 'inner', insideLabels, 'foreground');
    expect(drawForCenterOffset).toHaveBeenNthCalledWith(2, 202, 'outer', outsideLabels, 'foreground');
  });

  test('places an outside horizontal label away from the map with a halo', () => {
    const cgv = viewer({ruler: {labelPosition: 'outside'}});
    const ctx = cgv.canvas.context('foreground');
    const pointForBp = jest.spyOn(cgv.canvas, 'pointForBp');
    const clockPositionForBp = jest.spyOn(cgv.layout, 'clockPositionForBp');
    ctx.fillText.mockClear();
    ctx.strokeText.mockClear();

    cgv.ruler.drawLabel(250, '250', 150, 'outer', 'foreground');

    expect(pointForBp).toHaveBeenCalledWith(250, 160);
    expect(clockPositionForBp).toHaveBeenCalledWith(250, true);
    expect(ctx.strokeText).toHaveBeenCalledWith('250 bp', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('250 bp', expect.any(Number), expect.any(Number));
    expect(ctx.strokeText.mock.invocationCallOrder[0])
      .toBeLessThan(ctx.fillText.mock.invocationCallOrder[0]);
  });

  test('uses the shared arc renderer and caches curved ruler measurements', () => {
    const cgv = viewer({ruler: {labelPosition: 'outside', labelOrientation: 'curved'}});
    const ctx = cgv.canvas.context('foreground');
    const drawTextAlongArc = jest.spyOn(cgv.canvas, 'drawTextAlongArc').mockReturnValue(true);
    ctx.measureText.mockClear();

    cgv.ruler.drawLabel(250, '250', 150, 'outer', 'foreground');

    expect(drawTextAlongArc).toHaveBeenCalledWith(expect.objectContaining({
      layer: 'foreground',
      bp: 250,
      centerOffset: 165,
      characters: Array.from('250 bp'),
      haloWidth: 5,
    }));
    expect(ctx.measureText).toHaveBeenCalledTimes(Array.from('250 bp').length);

    ctx.measureText.mockClear();
    cgv.ruler.drawLabel(250, '250', 150, 'outer', 'foreground');
    expect(ctx.measureText).not.toHaveBeenCalled();

    cgv.ruler.font = 'serif, plain, 12';
    cgv.ruler.drawLabel(250, '250', 150, 'outer', 'foreground');
    expect(ctx.measureText).toHaveBeenCalledTimes(Array.from('250 bp').length);
  });

  test('falls back to protected horizontal labels in linear maps', () => {
    const cgv = viewer({
      ruler: {labelPosition: 'outside', labelOrientation: 'curved'},
    });
    cgv.format = 'linear';
    const ctx = cgv.canvas.context('foreground');
    const drawTextAlongArc = jest.spyOn(cgv.canvas, 'drawTextAlongArc');
    ctx.fillText.mockClear();
    ctx.strokeText.mockClear();

    cgv.ruler.drawLabel(250, '250', 150, 'outer', 'foreground');

    expect(drawTextAlongArc).not.toHaveBeenCalled();
    expect(ctx.strokeText).toHaveBeenCalledWith('250 bp', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('250 bp', expect.any(Number), expect.any(Number));
    expect(ctx.strokeText.mock.invocationCallOrder[0])
      .toBeLessThan(ctx.fillText.mock.invocationCallOrder[0]);
  });

  test('draws the ruler on the foreground after map data and track labels', () => {
    const cgv = viewer();
    const drawSlots = jest.spyOn(cgv.layout, 'drawAllSlots').mockImplementation(() => {});
    const drawSequence = jest.spyOn(cgv.sequence, 'draw').mockImplementation(() => {});
    const drawTrackLabels = jest.spyOn(cgv.layout._trackLabelRenderer, 'draw').mockImplementation(() => {});
    const drawRuler = jest.spyOn(cgv.ruler, 'draw').mockImplementation(() => {});

    cgv.layout.drawExport();

    expect(drawSlots.mock.invocationCallOrder[0]).toBeLessThan(drawRuler.mock.invocationCallOrder[0]);
    expect(drawSequence.mock.invocationCallOrder[0]).toBeLessThan(drawRuler.mock.invocationCallOrder[0]);
    expect(drawTrackLabels.mock.invocationCallOrder[0]).toBeLessThan(drawRuler.mock.invocationCallOrder[0]);
    expect(drawRuler).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 'foreground');
  });
});
