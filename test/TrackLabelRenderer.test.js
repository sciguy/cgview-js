import Viewer from '../src/Viewer';

describe('Track labels', () => {

  beforeEach(() => {
    document.body.innerHTML = '<div id="map"></div>';
  });

  function viewerWithTrack(options = {}) {
    const {format = 'circular', settings = {}, track = {}, ...viewerOptions} = options;
    const cgv = new Viewer('#map', {
      width: 800,
      height: 600,
      settings,
      sequence: {length: 1000},
      features: [{name: 'example', source: 'genes', start: 100, stop: 300}],
      ...viewerOptions,
    });
    cgv.addTracks({
      name: 'Genes',
      dataType: 'feature',
      dataMethod: 'source',
      dataKeys: 'genes',
      position: 'outside',
      separateFeaturesBy: 'none',
      ...track,
    });
    cgv.format = format;
    return cgv;
  }

  function zoomForLabels(cgv, zoomFactor = 8) {
    cgv.layout.zoom(zoomFactor, 500);
    cgv.layout.updateLayout(true);
  }

  test('is enabled by default and round-trips through Settings JSON', () => {
    const cgv = viewerWithTrack();

    expect(cgv.settings.showTrackLabels).toBe(true);
    expect(cgv.io.toJSON().cgview.settings.showTrackLabels).toBe(true);

    cgv.settings.update({showTrackLabels: false});
    expect(cgv.settings.showTrackLabels).toBe(false);
    expect(cgv.io.toJSON().cgview.settings.showTrackLabels).toBe(false);
  });

  test('does not redraw or plan track names at overview scale', () => {
    const cgv = viewerWithTrack();
    const drawFull = jest.spyOn(cgv, 'drawFull');

    expect(cgv.layout._trackLabelRenderer.plans()).toEqual([]);
    cgv.settings.update({showTrackLabels: false});

    expect(drawFull).not.toHaveBeenCalled();
  });

  test('draws a curved, halo-protected name in a zoomed circular map', () => {
    const cgv = viewerWithTrack();
    zoomForLabels(cgv);
    const ctx = cgv.canvas.context('foreground');
    ctx.fillText.mockClear();
    ctx.strokeText.mockClear();

    cgv.layout._trackLabelRenderer.draw();

    expect(ctx.strokeText.mock.calls.map(call => call[0])).toEqual(Array.from('Genes'));
    expect(ctx.fillText.mock.calls.map(call => call[0])).toEqual(Array.from('Genes'));
  });

  test('draws one straight name just inside the leading edge of a linear map', () => {
    const cgv = viewerWithTrack({format: 'linear'});
    zoomForLabels(cgv);
    const ctx = cgv.canvas.context('foreground');
    const [plan] = cgv.layout._trackLabelRenderer.plans(ctx);
    const point = cgv.canvas.pointForBp(plan.bp, plan.centerOffset);
    ctx.fillText.mockClear();
    ctx.strokeText.mockClear();

    cgv.layout._trackLabelRenderer.draw();

    expect(ctx.strokeText).toHaveBeenCalledWith('Genes', 0, 0);
    expect(ctx.fillText).toHaveBeenCalledWith('Genes', 0, 0);
    expect(point.x - (plan.totalWidth / 2)).toBeCloseTo(12, 1);
  });

  test('labels each visible side of an around track and includes plot tracks', () => {
    const cgv = viewerWithTrack({
      track: {position: 'around', separateFeaturesBy: 'strand'},
      plots: [{
        name: 'Coverage values',
        source: 'coverage',
        positions: [1, 500, 1000],
        scores: [0.2, 0.8, 0.4],
      }],
    });
    cgv.addTracks({
      name: 'Coverage',
      dataType: 'plot',
      dataMethod: 'source',
      dataKeys: 'coverage',
      position: 'inside',
    });
    zoomForLabels(cgv);

    const plans = cgv.layout._trackLabelRenderer.plans();

    expect(plans.map(plan => plan.track.name)).toEqual(['Genes', 'Genes', 'Coverage']);
    expect(plans.map(plan => plan.characters.join(''))).toEqual(['Genes (+)', 'Genes (-)', 'Coverage']);
    expect(plans.map(plan => plan.position).sort()).toEqual(['inside', 'inside', 'outside']);
  });

  test('labels each reading-frame slot', () => {
    const cgv = viewerWithTrack({
      format: 'linear',
      track: {separateFeaturesBy: 'readingFrame'},
    });
    zoomForLabels(cgv);

    const plans = cgv.layout._trackLabelRenderer.plans();

    expect(plans.map(plan => plan.characters.join(''))).toEqual([
      'Genes (+1)',
      'Genes (+2)',
      'Genes (+3)',
      'Genes (-1)',
      'Genes (-2)',
      'Genes (-3)',
    ]);
  });

  test('uses feature types as slot details', () => {
    const cgv = viewerWithTrack({
      features: [
        {name: 'cds', source: 'genes', type: 'CDS', start: 100, stop: 200},
        {name: 'trna', source: 'genes', type: 'tRNA', start: 300, stop: 400},
      ],
      track: {separateFeaturesBy: 'type'},
    });
    zoomForLabels(cgv);

    const plans = cgv.layout._trackLabelRenderer.plans();

    expect(plans.map(plan => plan.characters.join(''))).toEqual(['Genes (CDS)', 'Genes (tRNA)']);
  });

  test('uses feature legends as slot details', () => {
    const cgv = viewerWithTrack({
      features: [
        {name: 'first', source: 'genes', legend: 'Forward genes', start: 100, stop: 200},
        {name: 'second', source: 'genes', legend: 'Reverse genes', start: 300, stop: 400},
      ],
      track: {separateFeaturesBy: 'legend'},
    });
    zoomForLabels(cgv);

    const plans = cgv.layout._trackLabelRenderer.plans();

    expect(plans.map(plan => plan.characters.join(''))).toEqual([
      'Genes (Forward genes)',
      'Genes (Reverse genes)',
    ]);
  });

  test('honors the option at label zoom and refreshes the visible result', () => {
    const cgv = viewerWithTrack();
    zoomForLabels(cgv);
    const drawFull = jest.spyOn(cgv, 'drawFull');

    cgv.settings.update({showTrackLabels: false});

    expect(cgv.layout._trackLabelRenderer.plans()).toEqual([]);
    expect(drawFull).toHaveBeenCalledTimes(1);
  });

  test('honors disabled track labels loaded from JSON', () => {
    const cgv = viewerWithTrack({settings: {showTrackLabels: false}});
    zoomForLabels(cgv);

    expect(cgv.settings.showTrackLabels).toBe(false);
    expect(cgv.layout._trackLabelRenderer.plans()).toEqual([]);
  });

  test('truncates long track names with an ellipsis', () => {
    const name = 'A very long feature track name that cannot fit at full width';
    const cgv = viewerWithTrack({track: {name}});
    const ctx = cgv.canvas.context('foreground');
    ctx.measureText.mockImplementation(() => ({width: 10}));
    zoomForLabels(cgv);

    const [plan] = cgv.layout._trackLabelRenderer.plans(ctx);
    const text = plan.characters.join('');

    expect(text.endsWith('…')).toBe(true);
    expect(text).not.toBe(name);
    expect(plan.totalWidth).toBeLessThanOrEqual(150);
    expect(plan.characters.length).toBeGreaterThan(4);
  });

  test('preserves a short slot detail while truncating the track name', () => {
    const name = 'A very long feature track name that cannot fit at full width';
    const cgv = viewerWithTrack({track: {name, separateFeaturesBy: 'strand'}});
    const ctx = cgv.canvas.context('foreground');
    ctx.measureText.mockImplementation(() => ({width: 10}));
    zoomForLabels(cgv);

    const plan = cgv.layout._trackLabelRenderer.plans(ctx).find(candidate => candidate.detail === '+');
    const text = plan.characters.join('');

    expect(text.endsWith('… (+)')).toBe(true);
    expect(plan.totalWidth).toBeLessThanOrEqual(150);
  });

  test('preserves a short track name while truncating a long slot detail', () => {
    const detail = 'Very long feature type that cannot fit at full width';
    const cgv = viewerWithTrack({
      features: [{name: 'example', source: 'genes', type: detail, start: 100, stop: 300}],
      track: {separateFeaturesBy: 'type'},
    });
    const ctx = cgv.canvas.context('foreground');
    ctx.measureText.mockImplementation(() => ({width: 10}));
    zoomForLabels(cgv);

    const [plan] = cgv.layout._trackLabelRenderer.plans(ctx);
    const text = plan.characters.join('');

    expect(text).toMatch(/^Genes \(.+…\)$/);
    expect(plan.totalWidth).toBeLessThanOrEqual(150);
  });

  test('caches slot descriptors until relevant viewer data changes', () => {
    const cgv = viewerWithTrack();
    zoomForLabels(cgv);
    const renderer = cgv.layout._trackLabelRenderer;
    const buildTrackList = jest.spyOn(renderer, '_buildTrackList');

    renderer.plans();
    renderer.plans();

    expect(buildTrackList).toHaveBeenCalledTimes(1);

    cgv.updateTracks(cgv.tracks().first, {loadProgress: 50});
    renderer.plans();

    expect(buildTrackList).toHaveBeenCalledTimes(1);

    cgv.updateTracks(cgv.tracks().first, {separateFeaturesBy: 'strand'});
    const plans = renderer.plans();

    expect(buildTrackList).toHaveBeenCalledTimes(2);
    expect(plans.map(plan => plan.detail)).toEqual(['-', '+']);
  });

  test('uses contrasting text and a background-colored halo', () => {
    const cgv = viewerWithTrack({settings: {backgroundColor: 'white'}});
    zoomForLabels(cgv);
    const ctx = cgv.canvas.context('foreground');
    let fillColors = [];
    let haloColors = [];
    ctx.fillText.mockImplementation(() => fillColors.push(ctx.fillStyle));
    ctx.strokeText.mockImplementation(() => haloColors.push(ctx.strokeStyle));

    cgv.layout._trackLabelRenderer.draw();

    expect(new Set(fillColors)).toEqual(new Set(['rgba(0, 0, 0, 0.78)']));
    expect(new Set(haloColors)).toEqual(new Set(['#ffffff']));

    cgv.settings.update({backgroundColor: '#111827'});
    fillColors = [];
    haloColors = [];
    cgv.layout._trackLabelRenderer.draw();

    expect(new Set(fillColors)).toEqual(new Set(['rgba(255, 255, 255, 0.78)']));
    expect(new Set(haloColors)).toEqual(new Set(['#111827']));
  });

  test('completes the circular halo pass before drawing any glyph fills', () => {
    const cgv = viewerWithTrack();
    zoomForLabels(cgv);
    const ctx = cgv.canvas.context('foreground');
    ctx.fillText.mockClear();
    ctx.strokeText.mockClear();
    ctx.rotate.mockClear();

    cgv.layout._trackLabelRenderer.draw();

    const glyphCount = Array.from('Genes').length;
    expect(ctx.rotate).toHaveBeenCalledTimes(glyphCount * 2);
    expect(ctx.rotate.mock.calls.slice(0, glyphCount)).toEqual(ctx.rotate.mock.calls.slice(glyphCount));
    expect(Math.max(...ctx.strokeText.mock.invocationCallOrder))
      .toBeLessThan(Math.min(...ctx.fillText.mock.invocationCallOrder));
  });

  test('draws foreground track labels after map data and before overlays', () => {
    const cgv = viewerWithTrack();
    const drawSlots = jest.spyOn(cgv.layout, 'drawAllSlots').mockImplementation(() => {});
    const drawSequence = jest.spyOn(cgv.sequence, 'draw').mockImplementation(() => {});
    const drawTrackLabels = jest.spyOn(cgv.layout._trackLabelRenderer, 'draw').mockImplementation(() => {});
    const drawCenterLine = jest.spyOn(cgv.centerLine, 'draw').mockImplementation(() => {});

    cgv.layout.drawExport();

    expect(drawSlots.mock.invocationCallOrder[0]).toBeLessThan(drawTrackLabels.mock.invocationCallOrder[0]);
    expect(drawSequence.mock.invocationCallOrder[0]).toBeLessThan(drawTrackLabels.mock.invocationCallOrder[0]);
    expect(drawTrackLabels.mock.invocationCallOrder[0]).toBeLessThan(drawCenterLine.mock.invocationCallOrder[0]);
  });
});
