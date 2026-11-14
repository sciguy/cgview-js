import Viewer from '../src/Viewer';
import CGRange from '../src/CGRange';
import settleExternalLabels from './helpers/settleExternalLabels';

describe('Inline feature labels', () => {
  let viewers;

  beforeEach(() => {
    viewers = [];
    document.body.innerHTML = '<div id="map"></div>';
  });

  afterEach(() => {
    for (const viewer of viewers) {
      viewer.stopAnimate();
      clearTimeout(viewer.layout._slotTimeoutID);
      viewer.annotation._externalLabels.destroy();
    }
  });

  function viewerWithFeatures(options = {}) {
    const {
      annotation = {},
      backbone = {},
      features = [],
      format = 'circular',
      legend = {},
      sequence = {length: 1000},
      settings = {},
      track,
    } = options;
    const cgv = new Viewer('#map', {
      width: 800,
      height: 600,
      annotation,
      backbone,
      features,
      legend,
      sequence,
      settings,
    });
    viewers.push(cgv);
    if (track) {
      cgv.addTracks({
        name: 'Genes',
        dataType: 'feature',
        dataMethod: 'source',
        dataKeys: 'test',
        position: 'outside',
        separateFeaturesBy: 'none',
        ...track,
      });
    }
    cgv.format = format;
    cgv.layout.updateLayout(true);
    return cgv;
  }

  function fullRange(cgv) {
    return new CGRange(cgv.sequence.mapContig, 1, cgv.sequence.length);
  }

  test('defaults to automatic labels and serializes inline configuration', () => {
    const cgv = viewerWithFeatures();

    expect(cgv.annotation.labelPosition).toBe('auto');
    expect(cgv.annotation.inlineLabelAllowShrinking).toBe(true);
    expect(cgv.annotation.inlineLabelAllowTruncation).toBe(false);

    cgv.annotation.update({
      labelPosition: 'inline',
      inlineLabelAllowShrinking: false,
      inlineLabelAllowTruncation: true,
      inlineLabelColor: 'white',
    });
    expect(cgv.annotation.toJSON()).toMatchObject({
      labelPosition: 'inline',
      inlineLabelAllowShrinking: false,
      inlineLabelAllowTruncation: true,
      inlineLabelColor: 'rgba(255,255,255,1)',
    });
    expect(cgv.annotation.toJSON()).not.toHaveProperty('inlineLabelMinFontSize');
    expect(cgv.annotation.toJSON()).not.toHaveProperty('inlineLabelPadding');

    cgv.annotation.labelPosition = 'outside';
    expect(cgv.annotation.labelPosition).toBe('outside');
    cgv.annotation.labelPosition = 'unsupported';
    expect(cgv.annotation.labelPosition).toBe('auto');
  });

  test('shrinks fitting labels to the internal floor and rejects smaller space', () => {
    const cgv = viewerWithFeatures({
      annotation: {
        font: 'sans-serif, plain, 16',
        labelPosition: 'inline',
      },
      features: [{name: 'shrink me', start: 100, stop: 200, legend: 'Feature'}],
    });
    const feature = cgv.features(1);
    const renderer = cgv.annotation._featureLabelRenderer;
    const ctx = cgv.canvas.context('map');
    ctx.measureText.mockImplementation(text => ({width: Array.from(String(text)).length * 10}));
    const pixelsPerBp = jest.spyOn(cgv.canvas, 'pixelsPerBp').mockReturnValue(0.6);

    const metrics = renderer.metricsFor(feature, 100, 20, fullRange(cgv));
    expect(metrics.fontSize).toBeGreaterThanOrEqual(8);
    expect(metrics.fontSize).toBeLessThan(16);

    pixelsPerBp.mockReturnValue(0.3);
    expect(renderer.metricsFor(feature, 100, 20, fullRange(cgv))).toBeUndefined();
  });

  test('fits shrinking labels in tenth-pixel increments', () => {
    const cgv = viewerWithFeatures({
      annotation: {
        font: 'sans-serif, plain, 16',
        labelPosition: 'inline',
      },
      features: [{name: 'smooth', start: 100, stop: 300, legend: 'Feature'}],
    });
    const feature = cgv.features(1);
    const renderer = cgv.annotation._featureLabelRenderer;
    const measurement = {
      characters: Array.from(feature.name),
      widths: Array.from(feature.name, () => 10),
      prefixWidths: [0, 10, 20, 30, 40, 50, 60],
      curvedWidth: 100,
      linearWidth: 100,
    };

    const plan = renderer._textPlan(feature, 73.4, 15.75, measurement);

    expect(plan.fontSize).toBe(11.7);
    expect(plan.widthScale).toBeCloseTo(11.7 / 16);
  });

  test('scales straight text around a stable baseline origin', () => {
    const cgv = viewerWithFeatures({
      annotation: {font: 'sans-serif, plain, 16', labelPosition: 'inline'},
      features: [{name: 'stable', start: 100, stop: 300, legend: 'Feature'}],
      format: 'linear',
    });
    const feature = cgv.features(1);
    const renderer = cgv.annotation._featureLabelRenderer;
    const ctx = cgv.canvas.context('map');
    ctx.scale.mockClear();
    ctx.fillText.mockClear();

    renderer._drawStraightLabel(ctx, feature, {
      bp: 200,
      centerOffset: 20,
      color: feature.color.contrastColor(),
      text: feature.name,
      widthScale: 0.75,
    });

    expect(ctx.scale).toHaveBeenCalledWith(0.75, 0.75);
    expect(ctx.fillText).toHaveBeenCalledWith('stable', 0, 0);
  });

  test('passes the natural font and render scale to curved text', () => {
    const cgv = viewerWithFeatures({
      annotation: {font: 'sans-serif, plain, 16', labelPosition: 'inline'},
      features: [{name: 'stable', start: 100, stop: 300, legend: 'Feature'}],
    });
    const feature = cgv.features(1);
    const renderer = cgv.annotation._featureLabelRenderer;
    const drawTextAlongArc = jest.spyOn(cgv.canvas, 'drawTextAlongArc');

    renderer._drawCurvedLabel(feature, {
      bp: 200,
      centerOffset: 100,
      characters: Array.from(feature.name),
      widths: Array.from(feature.name, () => 8),
      widthScale: 0.75,
      textWidth: 36,
      color: feature.color.contrastColor(),
    }, 'ui');

    expect(drawTextAlongArc).toHaveBeenCalledWith(expect.objectContaining({
      font: feature.label.font.css,
      layer: 'ui',
      widthScale: 0.75,
    }));
  });

  test('can disable shrinking independently of truncation', () => {
    const cgv = viewerWithFeatures({
      annotation: {
        font: 'sans-serif, plain, 16',
        labelPosition: 'inline',
        inlineLabelAllowShrinking: false,
      },
      features: [{name: 'full size', start: 100, stop: 300, legend: 'Feature'}],
    });
    const feature = cgv.features(1);
    const renderer = cgv.annotation._featureLabelRenderer;
    cgv.canvas.context('map').measureText
      .mockImplementation(text => ({width: Array.from(String(text)).length * 10}));
    const measurement = renderer._measurementFor(feature);
    const availableWidth = renderer._baseTextWidth(measurement) * 0.8;

    expect(renderer._textPlan(feature, availableWidth, 20, measurement)).toBeUndefined();

    cgv.annotation.update({inlineLabelAllowShrinking: true});
    expect(renderer._textPlan(feature, availableWidth, 20, measurement).fontSize).toBe(12.8);
  });

  test('truncates labels with an ellipsis only when enabled', () => {
    const cgv = viewerWithFeatures({
      annotation: {
        font: 'sans-serif, plain, 14',
        labelPosition: 'inline',
        inlineLabelAllowShrinking: false,
        inlineLabelAllowTruncation: true,
      },
      legend: {items: [{name: 'Feature', decoration: 'arc'}]},
      features: [{name: 'long descriptive label', start: 100, stop: 300, legend: 'Feature'}],
    });
    const feature = cgv.features(1);
    const renderer = cgv.annotation._featureLabelRenderer;
    const ctx = cgv.canvas.context('map');
    ctx.measureText.mockImplementation(text => ({width: Array.from(String(text)).length * 10}));
    const measurement = renderer._measurementFor(feature);
    const targetWidth = measurement.prefixWidths[6] + measurement.ellipsisWidth;
    const totalPadding = 8; // Inline labels reserve 4px on each side.
    const slotThickness = feature.label.font.size + totalPadding;
    jest.spyOn(cgv.canvas, 'pixelsPerBp')
      .mockReturnValue((targetWidth + totalPadding) / feature.length);
    feature.label.width = 200;

    const metrics = renderer.metricsFor(feature, 100, slotThickness, fullRange(cgv));

    expect(metrics.text).toBe('long d…');
    expect(metrics.characters).toEqual(Array.from('long d…'));
    expect(metrics.fontSize).toBe(14);
    expect(metrics.textWidth).toBeLessThanOrEqual(metrics.availableWidth + 0.01);

    cgv.annotation.update({inlineLabelAllowTruncation: false});
    expect(renderer.metricsFor(feature, 100, slotThickness, fullRange(cgv))).toBeUndefined();
  });

  test('uses bpFloat to move clipped labels continuously above one pixel per bp', () => {
    const cgv = viewerWithFeatures({
      annotation: {labelPosition: 'inline'},
      features: [{name: 'spanning feature', source: 'test', start: 1, stop: 1000, legend: 'Feature'}],
      format: 'linear',
      track: {},
    });
    const renderer = cgv.annotation._featureLabelRenderer;
    const slot = cgv.tracks(1).slots(1);
    cgv.layout.zoom(5, 500);
    cgv.layout.updateLayout();
    const visibleRange = jest.spyOn(cgv.canvas, 'visibleRangeForCenterOffset');
    const currentPlacement = () => {
      renderer.beginDraw();
      const drawingRange = cgv.canvas.visibleRangeForCenterOffset(slot.centerOffset, {
        margin: slot.thickness,
      });
      return renderer._placementsForSlot(slot, drawingRange).get(cgv.features(1));
    };

    const beforePan = currentPlacement();
    const beforePanBp = cgv.bpFloat;
    cgv.layout.translate(0.25, 0);
    const afterPan = currentPlacement();
    const afterPanBp = cgv.bpFloat;
    const panDelta = Math.abs(afterPan.bp - beforePan.bp);

    expect(cgv.canvas.pixelsPerBp(slot.centerOffset)).toBeGreaterThan(1);
    expect(visibleRange).toHaveBeenCalledWith(slot.centerOffset, {
      margin: slot.thickness,
      float: true,
    });
    expect(beforePan.bp).toBeCloseTo(beforePanBp, 10);
    expect(afterPan.bp).toBeCloseTo(afterPanBp, 10);
    expect(panDelta).toBeGreaterThan(0);
    expect(panDelta).toBeLessThan(1);
  });

  test('rejects labels that cannot fit before measuring individual glyphs', () => {
    const cgv = viewerWithFeatures({
      annotation: {font: 'sans-serif, plain, 12', labelPosition: 'inline'},
      features: [{name: 'far too wide', start: 100, stop: 200, legend: 'Feature'}],
    });
    const feature = cgv.features(1);
    const renderer = cgv.annotation._featureLabelRenderer;
    feature.label.width = 80;
    jest.spyOn(cgv.canvas, 'pixelsPerBp').mockReturnValue(0.1);
    const measure = jest.spyOn(renderer, '_measurementFor');

    expect(renderer.metricsFor(feature, 100, 20, fullRange(cgv))).toBeUndefined();
    expect(measure).not.toHaveBeenCalled();
  });

  test('retains the pre-measurement width guard when truncation is enabled', () => {
    const cgv = viewerWithFeatures({
      annotation: {labelPosition: 'inline', inlineLabelAllowTruncation: true},
      features: [{name: 'far too wide to show', start: 100, stop: 200, legend: 'Feature'}],
    });
    const feature = cgv.features(1);
    const renderer = cgv.annotation._featureLabelRenderer;
    jest.spyOn(cgv.canvas, 'pixelsPerBp').mockReturnValue(0.01);
    const measure = jest.spyOn(renderer, '_measurementFor');

    expect(renderer.metricsFor(feature, 100, 20, fullRange(cgv))).toBeUndefined();
    expect(measure).not.toHaveBeenCalled();
  });

  test('reuses the cached label width for linear measurement', () => {
    const cgv = viewerWithFeatures({
      features: [{name: 'cached width', start: 100, stop: 500, legend: 'Feature'}],
      format: 'linear',
    });
    const feature = cgv.features(1);
    const renderer = cgv.annotation._featureLabelRenderer;
    const ctx = cgv.canvas.context('map');
    feature.label.width = 42;
    ctx.measureText.mockClear();

    expect(renderer._measurementFor(feature).linearWidth).toBe(42);
    expect(ctx.measureText).not.toHaveBeenCalledWith('cached width');
  });

  test('curves circular labels and keeps linear labels straight', () => {
    const circular = viewerWithFeatures({
      annotation: {font: 'sans-serif, plain, 14', labelPosition: 'inline'},
      features: [{name: 'curved', start: 300, stop: 700, legend: 'Feature'}],
    });
    const circularContext = circular.canvas.context('map');
    jest.spyOn(circular.canvas, 'pixelsPerBp').mockReturnValue(1);
    circularContext.fillText.mockClear();
    circularContext.rotate.mockClear();

    circular.annotation._featureLabelRenderer.draw(
      [circular.features(1)],
      150,
      24,
      fullRange(circular)
    );

    expect(circularContext.fillText.mock.calls.map(call => call[0])).toEqual(Array.from('curved'));
    expect(circularContext.rotate).toHaveBeenCalledTimes(Array.from('curved').length);

    document.body.innerHTML = '<div id="map"></div>';
    const linear = viewerWithFeatures({
      annotation: {font: 'sans-serif, plain, 14', labelPosition: 'inline'},
      features: [{name: 'straight', start: 300, stop: 700, legend: 'Feature'}],
      format: 'linear',
    });
    const linearContext = linear.canvas.context('map');
    jest.spyOn(linear.canvas, 'pixelsPerBp').mockReturnValue(1);
    linearContext.fillText.mockClear();
    linearContext.rotate.mockClear();

    linear.annotation._featureLabelRenderer.draw(
      [linear.features(1)],
      0,
      24,
      fullRange(linear)
    );

    expect(linearContext.fillText).toHaveBeenCalledTimes(1);
    expect(linearContext.fillText).toHaveBeenCalledWith('straight', 0, 0);
    expect(linearContext.rotate).not.toHaveBeenCalled();
  });

  test('uses outside labels only when automatic inline placement is unavailable', async () => {
    const cgv = viewerWithFeatures({
      annotation: {labelPosition: 'auto'},
      features: [
        {name: 'fits inline', source: 'test', start: 100, stop: 300, legend: 'Feature'},
        {name: 'needs fallback', source: 'test', start: 500, stop: 502, legend: 'Feature'},
      ],
      track: {},
    });
    const visibleRange = fullRange(cgv);
    jest.spyOn(cgv.canvas, 'pixelsPerBp').mockReturnValue(1);
    jest.spyOn(cgv.canvas, 'visibleRangeForCenterOffset').mockReturnValue(visibleRange);

    cgv.annotation.draw(100, 150, false);
    await settleExternalLabels(cgv);

    const outsideNames = cgv.annotation._visibleLabels.map(label => label.feature.name);
    expect(outsideNames).toContain('needs fallback');
    expect(outsideNames).not.toContain('fits inline');
    expect(cgv.annotation.labelStats).toEqual({total: 2, drawn: 1});
    const slot = cgv.tracks(1).slots(1);
    slot.draw(cgv.canvas, false);
    expect(cgv.annotation.labelStats).toEqual({total: 2, drawn: 2});
    slot.draw(cgv.canvas, false);
    expect(cgv.annotation.labelStats.drawn).toBe(2);
  });

  test('skips outside-label membership checks when no inline labels fit', async () => {
    const cgv = viewerWithFeatures({
      annotation: {labelPosition: 'auto'},
      features: [
        {name: 'first fallback', source: 'test', start: 100, stop: 200, legend: 'Feature'},
        {name: 'second fallback', source: 'test', start: 300, stop: 400, legend: 'Feature'},
      ],
      track: {},
    });
    const renderer = cgv.annotation._featureLabelRenderer;
    const inlineFeatures = {size: 0, has: jest.fn()};
    jest.spyOn(renderer, 'visibleInlineFeatures').mockReturnValue(inlineFeatures);

    cgv.annotation.draw(100, 150, false);
    await settleExternalLabels(cgv);

    expect(inlineFeatures.has).not.toHaveBeenCalled();
    expect(cgv.annotation._visibleLabels.map(label => label.feature.name))
      .toEqual(expect.arrayContaining(['first fallback', 'second fallback']));
  });

  test('draws inline labels after all feature bodies in a slot pass', () => {
    const cgv = viewerWithFeatures({
      annotation: {labelPosition: 'inline'},
      features: [{name: 'feature', source: 'test', start: 100, stop: 500, legend: 'Feature'}],
      track: {},
    });
    const slot = cgv.tracks(1).slots(1);
    jest.spyOn(cgv.canvas, 'visibleRangeForCenterOffset').mockReturnValue(fullRange(cgv));
    const drawFeature = jest.spyOn(cgv.features(1), 'draw').mockImplementation(() => {});
    const drawLabels = jest.spyOn(cgv.annotation, 'drawFeatureLabels').mockImplementation(() => {});

    slot.draw(cgv.canvas, false);

    expect(drawFeature).toHaveBeenCalledTimes(1);
    expect(drawLabels).toHaveBeenCalledWith(
      [cgv.features(1)],
      slot.centerOffset,
      slot.thickness,
      expect.any(CGRange),
      slot
    );
    expect(drawFeature.mock.invocationCallOrder[0])
      .toBeLessThan(drawLabels.mock.invocationCallOrder[0]);
  });

  test('redraws a highlighted inline label on ui after the feature body', () => {
    const cgv = viewerWithFeatures({
      annotation: {labelPosition: 'inline'},
      features: [{name: 'feature', source: 'test', start: 100, stop: 500, legend: 'Feature'}],
      format: 'linear',
      track: {},
    });
    const feature = cgv.features(1);
    const renderer = cgv.annotation._featureLabelRenderer;
    const slot = cgv.tracks(1).slots(1);
    const visibleRange = fullRange(cgv);
    const mapContext = cgv.canvas.context('map');
    const uiContext = cgv.canvas.context('ui');
    slot._visibleRange = visibleRange;
    jest.spyOn(renderer, '_placementsForSlot').mockReturnValue(new Map([[feature, {
      bp: 300,
      centerOffset: slot.centerOffset,
      characters: Array.from(feature.name),
      widths: Array.from(feature.name, () => 8),
      widthScale: 1,
      textWidth: 56,
      text: feature.name,
      color: feature.color.contrastColor(),
    }]]));
    const drawFeature = jest.spyOn(feature, 'draw').mockImplementation(() => {});
    mapContext.fillText.mockClear();
    uiContext.fillText.mockClear();

    feature.highlight(slot);

    expect(drawFeature).toHaveBeenCalledWith(
      'ui',
      slot.centerOffset,
      slot.thickness,
      visibleRange,
      {color: expect.anything()}
    );
    expect(uiContext.fillText).toHaveBeenCalledWith(feature.name, 0, 0);
    expect(mapContext.fillText).not.toHaveBeenCalled();
    expect(drawFeature.mock.invocationCallOrder[0])
      .toBeLessThan(uiContext.fillText.mock.invocationCallOrder[0]);
  });

  test('uses the complete visible set for stable collision choices during fast draws', () => {
    const cgv = viewerWithFeatures({
      annotation: {labelPosition: 'inline'},
      features: [
        {name: 'winner', source: 'test', start: 100, stop: 500, legend: 'Feature'},
        {name: 'loser', source: 'test', start: 150, stop: 450, legend: 'Feature'},
      ],
      track: {},
    });
    const renderer = cgv.annotation._featureLabelRenderer;
    const slot = cgv.tracks(1).slots(1);
    const visibleRange = fullRange(cgv);
    jest.spyOn(cgv.canvas, 'pixelsPerBp').mockReturnValue(1);
    const drawCurvedLabel = jest.spyOn(renderer, '_drawCurvedLabel').mockImplementation(() => {});

    renderer.beginDraw();
    renderer.draw([cgv.features(2)], slot.centerOffset, slot.thickness, visibleRange, slot);
    expect(drawCurvedLabel).not.toHaveBeenCalled();
    expect(cgv.annotation.labelStats).toEqual({total: 2, drawn: 0});

    renderer.draw([cgv.features(1)], slot.centerOffset, slot.thickness, visibleRange, slot);
    expect(drawCurvedLabel).toHaveBeenCalledTimes(1);
    expect(drawCurvedLabel.mock.calls[0][0]).toBe(cgv.features(1));
    expect(cgv.annotation.labelStats.drawn).toBe(1);
  });

  test('live label counts exclude unnamed features and exports, and reset on clear/hide', () => {
    const cgv = viewerWithFeatures({
      format: 'linear', annotation: {labelPosition: 'inline'},
      features: [
        {name: 'first', start: 100, stop: 300, legend: 'Feature'},
        {name: 'second', start: 600, stop: 900, legend: 'Feature'},
        {start: 950, stop: 990, legend: 'Feature'},
      ],
    });
    jest.spyOn(cgv.canvas, 'pixelsPerBp').mockReturnValue(1);
    const renderer = cgv.annotation._featureLabelRenderer, range = fullRange(cgv);
    renderer.beginDraw();
    renderer.draw([cgv.features(1)], 0, 24, range);
    expect(cgv.annotation.labelStats).toEqual({total: 2, drawn: 1});
    renderer.draw([cgv.features(1)], 0, 24, range);
    renderer.draw([cgv.features(2)], 0, 24, range, undefined, 'ui');
    expect(cgv.annotation.labelStats.drawn).toBe(1);

    cgv.layout._exporting = true;
    cgv.clear('map'); renderer.beginDraw();
    renderer.draw(cgv.features(), 0, 24, range);
    cgv.layout._exporting = false;
    expect(cgv.annotation.labelStats).toEqual({total: 2, drawn: 1});
    expect(cgv.annotation.toJSON({includeDefaults: true})).not.toHaveProperty('labelStats');

    const place = jest.spyOn(renderer, '_nonOverlappingPlacements');
    for (let i = 0; i < 20; i++) { expect(cgv.annotation.labelStats.drawn).toBe(1); }
    expect(place).not.toHaveBeenCalled();
    cgv.annotation.visible = false;
    expect(cgv.annotation.labelStats).toEqual({total: 2, drawn: 0});
    cgv.annotation.visible = true;
    cgv.clear('map');
    expect(cgv.annotation.labelStats.drawn).toBe(0);
    cgv.updateFeatures(cgv.features(2), {name: ''});
    expect(cgv.annotation.labelStats.total).toBe(1);
  });

  test('gives favorite features collision priority', () => {
    const cgv = viewerWithFeatures({
      annotation: {labelPosition: 'inline'},
      features: [
        {name: 'longer', source: 'test', start: 100, stop: 500, legend: 'Feature'},
        {name: 'favorite', source: 'test', start: 150, stop: 450, favorite: true, legend: 'Feature'},
      ],
      track: {},
    });
    const renderer = cgv.annotation._featureLabelRenderer;
    const slot = cgv.tracks(1).slots(1);
    jest.spyOn(cgv.canvas, 'pixelsPerBp').mockReturnValue(1);

    const placements = renderer._placementsForSlot(slot, fullRange(cgv));

    expect(placements.has(cgv.features(1))).toBe(false);
    expect(placements.has(cgv.features(2))).toBe(true);
  });

  test('uses continuous circular origin segments and the largest feature location', () => {
    const cgv = viewerWithFeatures({
      annotation: {font: 'sans-serif, plain, 14', labelPosition: 'inline'},
      legend: {items: [{name: 'Feature', decoration: 'arc'}]},
      features: [
        {name: 'origin feature', start: 900, stop: 100, legend: 'Feature'},
        {name: 'multi location', locations: [[100, 130], [400, 600]], legend: 'Feature'},
      ],
    });
    const renderer = cgv.annotation._featureLabelRenderer;
    jest.spyOn(cgv.canvas, 'pixelsPerBp').mockReturnValue(1);

    const wrappedRange = new CGRange(cgv.sequence.mapContig, 850, 150);
    const wrappedMetrics = renderer.metricsFor(cgv.features(1), 100, 20, wrappedRange);
    const locationMetrics = renderer.metricsFor(cgv.features(2), 100, 20, fullRange(cgv));

    expect(wrappedMetrics.bp).toBeCloseTo(1000);
    expect(locationMetrics.bp).toBeCloseTo(500);
  });

  describe.each(['circular', 'linear'])('%s arrow label placement', format => {
    // This radius gives circular labels their actual one-pixel-per-bp scale.
    const centerOffset = 1000 / (2 * Math.PI);

    function arrowViewer({strand, glyphWidth = 7, ...options}) {
      const cgv = viewerWithFeatures({format, ...options});
      if (format === 'linear') {
        jest.spyOn(cgv.canvas, 'pixelsPerBp').mockReturnValue(1);
      }
      cgv.canvas.context('map').measureText.mockImplementation(text => ({
        width: Array.from(String(text)).length * glyphWidth,
      }));
      for (const feature of cgv.features()) {
        feature.strand = strand;
        feature.label.width = Array.from(feature.name).length * glyphWidth;
      }
      return cgv;
    }

    test.each([1, -1])('weights arrow and auto labels toward the tail for strand %i', strand => {
      const cgv = arrowViewer({
        strand,
        annotation: {font: 'sans-serif, plain, 8', labelPosition: 'inline'},
        legend: {items: [
          {name: 'Arrow', decoration: 'arrow'},
          {name: 'Auto', decoration: 'auto'},
        ]},
        features: [
          {name: 'gene', start: 100, stop: 200, legend: 'Arrow'},
          {name: 'gene', start: 100, stop: 200, legend: 'Auto'},
        ],
      });
      const renderer = cgv.annotation._featureLabelRenderer;

      for (const arrowHeadLength of [0, 0.3, 1]) {
        cgv.settings.arrowHeadLength = arrowHeadLength;
        for (const feature of cgv.features()) {
          const metrics = renderer.metricsFor(feature, centerOffset, 20, fullRange(cgv));

          if (arrowHeadLength === 0) {
            expect(metrics.bp).toBeCloseTo(150);
          } else {
            expect((150 - metrics.bp) * strand).toBeGreaterThan(0);
            expect(Math.abs(metrics.bp - 150)).toBeLessThan(20 * arrowHeadLength / 2);
          }
          expect(metrics.text).toBe('gene');
          expect(metrics.textWidth).toBeLessThanOrEqual(metrics.availableWidth + 0.01);
        }
      }
    });

    test.each([1, -1])('fits labels using the whole arrow for strand %i', strand => {
      const cgv = arrowViewer({
        strand,
        annotation: {
          font: 'sans-serif, plain, 8',
          labelPosition: 'inline',
          inlineLabelAllowShrinking: false,
        },
        legend: {items: [
          {name: 'Arrow', decoration: 'arrow'},
          {name: 'Auto', decoration: 'auto'},
        ]},
        features: [
          {name: 'fit', start: 100, stop: 130, legend: 'Arrow'},
          {name: 'fit', start: 100, stop: 130, legend: 'Auto'},
        ],
      });
      const renderer = cgv.annotation._featureLabelRenderer;

      for (const feature of cgv.features()) {
        // A 31px feature with a 12px head previously left only 11px for text.
        const metrics = renderer.metricsFor(feature, centerOffset, 40, fullRange(cgv));

        expect(metrics.bp).toBeCloseTo(115 - strand);
        expect(metrics.fontSize).toBe(8);
        expect(metrics.text).toBe('fit');
        expect(metrics.textWidth).toBe(21);
        expect(metrics.availableWidth).toBeCloseTo(21);
      }
    });

    test.each([1, -1])('weights auto labels using the drawn head as zoom changes for strand %i', strand => {
      const cgv = arrowViewer({
        strand,
        glyphWidth: 3,
        annotation: {
          font: 'sans-serif, plain, 8',
          labelPosition: 'inline',
          inlineLabelAllowShrinking: false,
        },
        settings: {arrowHeadLength: 1},
        legend: {items: [{name: 'Auto', decoration: 'auto'}]},
        features: [{name: 'fit', start: 100, stop: 130, legend: 'Auto'}],
      });
      const feature = cgv.features(1);
      const renderer = cgv.annotation._featureLabelRenderer;
      const arrowHeadLength = jest.spyOn(cgv.canvas, 'arrowHeadLengthPixels');
      const stages = [
        {pixelsPerBp: 0.1, headLength: 0, fits: false},
        {pixelsPerBp: 1, headLength: 26, fits: true},
        {pixelsPerBp: 2, headLength: 40, fits: true},
      ];

      for (const {pixelsPerBp, headLength, fits} of stages) {
        const radius = centerOffset * pixelsPerBp;
        if (format === 'linear') {
          cgv.canvas.pixelsPerBp.mockReturnValue(pixelsPerBp);
        }
        expect(cgv.canvas.arrowHeadLengthPixels({
          autoArrow: true,
          centerOffset: radius,
          featureLengthBp: feature.length,
          width: 40,
        })).toBeCloseTo(headLength);
        arrowHeadLength.mockClear();

        const metrics = renderer.metricsFor(feature, radius, 40, fullRange(cgv));

        if (fits) {
          expect(arrowHeadLength).toHaveReturnedWith(headLength);
          expect((115 - metrics.bp) * strand).toBeGreaterThan(0);
          expect(Math.abs(metrics.bp - 115) * pixelsPerBp).toBeLessThan(headLength / 2);
          expect(metrics.fontSize).toBe(8);
          expect(metrics.text).toBe('fit');
          expect(metrics.textWidth).toBeLessThanOrEqual(metrics.availableWidth + 0.01);
        } else {
          expect(metrics).toBeUndefined();
        }
      }
    });

    test.each([1, -1])('shrinks centered labels safely inside large heads for strand %i', strand => {
      const cgv = arrowViewer({
        strand,
        glyphWidth: 10,
        annotation: {font: 'sans-serif, plain, 16', labelPosition: 'inline'},
        settings: {arrowHeadLength: 1},
        legend: {items: [{name: 'Arrow', decoration: 'arrow'}]},
        features: [{name: 'shrink', start: 100, stop: 160, legend: 'Arrow'}],
      });
      const feature = cgv.features(1);
      const renderer = cgv.annotation._featureLabelRenderer;
      const metrics = renderer.metricsFor(feature, centerOffset, 40, fullRange(cgv));

      expect((130 - metrics.bp) * strand).toBeGreaterThanOrEqual(0);
      expect(metrics.text).toBe('shrink');
      expect(metrics.fontSize).toBeGreaterThanOrEqual(8);
      expect(metrics.fontSize).toBeLessThan(16);
      expect(metrics.textWidth).toBeLessThanOrEqual(metrics.availableWidth + 0.01);
      expect(metrics.textWidth + 8).toBeLessThanOrEqual(feature.length + 0.01);
      if (format === 'linear') {
        // A straight head narrows by fontSize pixels at the text's outer edge.
        expect(metrics.textWidth / 2 + metrics.fontSize)
          .toBeLessThanOrEqual(feature.length / 2 + 0.01);
      }

      cgv.annotation.inlineLabelAllowShrinking = false;
      expect(renderer.metricsFor(feature, centerOffset, 40, fullRange(cgv))).toBeUndefined();
    });

    test.each([1, -1])('truncates centered labels safely inside large heads for strand %i', strand => {
      const cgv = arrowViewer({
        strand,
        glyphWidth: 5,
        annotation: {
          font: 'sans-serif, plain, 8',
          labelPosition: 'inline',
          inlineLabelAllowShrinking: false,
          inlineLabelAllowTruncation: true,
        },
        settings: {arrowHeadLength: 1},
        legend: {items: [{name: 'Arrow', decoration: 'arrow'}]},
        features: [{name: 'description', start: 100, stop: 150, legend: 'Arrow'}],
      });
      const feature = cgv.features(1);
      const renderer = cgv.annotation._featureLabelRenderer;
      const metrics = renderer.metricsFor(feature, centerOffset, 40, fullRange(cgv));

      expect((125 - metrics.bp) * strand).toBeGreaterThanOrEqual(0);
      expect(metrics.fontSize).toBe(8);
      expect(metrics.text.endsWith('…')).toBe(true);
      expect(metrics.text.length).toBeGreaterThanOrEqual(4);
      expect(feature.name.startsWith(metrics.text.slice(0, -1))).toBe(true);
      expect(metrics.textWidth).toBeLessThanOrEqual(metrics.availableWidth + 0.01);
      expect(metrics.textWidth + 8).toBeLessThanOrEqual(feature.length + 0.01);
      if (format === 'linear') {
        expect(metrics.textWidth / 2 + metrics.fontSize)
          .toBeLessThanOrEqual(feature.length / 2 + 0.01);
      }

      cgv.annotation.inlineLabelAllowTruncation = false;
      expect(renderer.metricsFor(feature, centerOffset, 40, fullRange(cgv))).toBeUndefined();
    });

    test.each([1, -1])('centers the visible segment when an arrow is clipped for strand %i', strand => {
      const cgv = arrowViewer({
        strand,
        annotation: {font: 'sans-serif, plain, 8', labelPosition: 'inline'},
        settings: {arrowHeadLength: 1},
        legend: {items: [{name: 'Arrow', decoration: 'arrow'}]},
        features: [{name: 'gene', start: 100, stop: 200, legend: 'Arrow'}],
      });
      const feature = cgv.features(1);
      const renderer = cgv.annotation._featureLabelRenderer;
      const clippedRanges = [
        {range: new CGRange(cgv.sequence.mapContig, 140, 250), center: 170.25},
        {range: new CGRange(cgv.sequence.mapContig, 1, 160), center: 129.75},
      ];

      for (const {range, center} of clippedRanges) {
        const metrics = renderer.metricsFor(feature, centerOffset, 20, range);

        const containsHead = strand === 1 ? range.containsMapBp(200) : range.containsMapBp(100);
        if (containsHead) {
          expect((center - metrics.bp) * strand).toBeGreaterThan(0);
        } else {
          expect(metrics.bp).toBeCloseTo(center);
        }
        expect(metrics.text).toBe('gene');
      }
    });

    test.each([1, -1])('changes weighting continuously as the tip enters the viewport for strand %i', strand => {
      const cgv = arrowViewer({
        strand,
        annotation: {font: 'sans-serif, plain, 8', labelPosition: 'inline'},
        settings: {arrowHeadLength: 1},
        legend: {items: [{name: 'Arrow', decoration: 'arrow'}]},
        features: [{name: 'gene', start: 100, stop: 200, legend: 'Arrow'}],
      });
      const feature = cgv.features(1), renderer = cgv.annotation._featureLabelRenderer;
      let previousBp, finalShift;
      for (let distance = 21; distance >= 0; distance -= 0.125) {
        const range = strand === 1 ? {start: 1, stop: 200 - distance} :
          {start: 100 + distance, stop: 1000};
        const segment = renderer._visibleSegments(feature, range)[0];
        const midpoint = segment.startEdge + segment.length / 2;
        const metrics = renderer.metricsFor(feature, centerOffset, 20, range);
        if (previousBp !== undefined) {
          expect(Math.abs(metrics.bp - previousBp)).toBeLessThan(0.125);
        }
        previousBp = metrics.bp;
        finalShift = (midpoint - metrics.bp) * strand;
      }
      expect(finalShift).toBeGreaterThan(4);
    });

    test.each([1, -1])('keeps long labels inside a partially visible head for strand %i', strand => {
      const cgv = arrowViewer({
        strand, glyphWidth: 15,
        annotation: {font: 'sans-serif, plain, 16', labelPosition: 'inline'},
        settings: {arrowHeadLength: 1},
        legend: {items: [{name: 'Arrow', decoration: 'arrow'}]},
        features: [{name: 'long label', start: 100, stop: 200, legend: 'Arrow'}],
      });
      const renderer = cgv.annotation._featureLabelRenderer;
      const range = strand === 1 ? {start: 1, stop: 199} : {start: 101, stop: 1000};
      const metrics = renderer.metricsFor(cgv.features(1), centerOffset, 20, range);
      expect(metrics).toBeDefined();
      expect(metrics.textWidth).toBeLessThanOrEqual(metrics.availableWidth + 0.01);
    });

    test.each([1, -1])('centers wrapped and multi-location arrows for strand %i', strand => {
      const cgv = arrowViewer({
        strand,
        annotation: {font: 'sans-serif, plain, 8', labelPosition: 'inline'},
        settings: {arrowHeadLength: 1},
        legend: {items: [{name: 'Arrow', decoration: 'arrow'}]},
        features: [
          {name: 'gene', start: 900, stop: 100, legend: 'Arrow'},
          {name: 'gene', locations: [[100, 130], [400, 600]], legend: 'Arrow'},
        ],
      });
      const renderer = cgv.annotation._featureLabelRenderer;
      const wrappedRange = new CGRange(cgv.sequence.mapContig, 850, 150);
      const wrappedMetrics = renderer.metricsFor(cgv.features(1), centerOffset, 20, wrappedRange);
      const locationMetrics = renderer.metricsFor(cgv.features(2), centerOffset, 20, fullRange(cgv));

      const midpoint = format === 'circular' ? 1000 : 950;
      let shift = midpoint - wrappedMetrics.bp;
      if (shift > 500) { shift -= 1000; }
      if (shift < -500) { shift += 1000; }
      // Linear splitting places the direct-strand arrow on the other segment.
      if (format === 'circular' || strand === -1) {
        expect(shift * strand).toBeGreaterThan(0);
      } else {
        expect(shift).toBeCloseTo(0);
      }
      if (strand === 1) {
        expect(locationMetrics.bp).toBeLessThan(500);
      } else {
        expect(locationMetrics.bp).toBeCloseTo(500);
      }
    });
  });

  test.each([1e8, 1e12])('circular arrow inset approaches linear geometry at radius %i', radius => {
    const cgv = viewerWithFeatures();
    const renderer = cgv.annotation._featureLabelRenderer;
    const inset = renderer._arrowHeadInset(40, 40, 8, radius);

    expect(Number.isFinite(inset)).toBe(true);
    expect(inset).toBeCloseTo(8, 5);
  });

  test('reserves track-label bounds before accepting feature labels', () => {
    const cgv = viewerWithFeatures({
      annotation: {labelPosition: 'inline'},
      features: [{name: 'feature', source: 'test', start: 100, stop: 500, legend: 'Feature'}],
      track: {},
    });
    const renderer = cgv.annotation._featureLabelRenderer;
    const slot = cgv.tracks(1).slots(1);
    const metrics = {
      bp: 200,
      centerOffset: slot.centerOffset,
      fontSize: 10,
      textWidth: 40,
      pixelsPerBp: 1,
    };
    jest.spyOn(renderer, 'metricsFor').mockReturnValue(metrics);
    jest.spyOn(cgv.layout._trackLabelRenderer, 'exclusionBounds').mockReturnValue([{
      slot,
      bp: 200,
      halfBp: 25,
      innerOffset: slot.centerOffset - 7,
      outerOffset: slot.centerOffset + 7,
    }]);

    const placements = renderer._nonOverlappingPlacements(
      [cgv.features(1)],
      slot.centerOffset,
      slot.thickness,
      fullRange(cgv),
      slot
    );

    expect(placements.size).toBe(0);
  });

  test('avoids readable backbone sequence and honors favorites and visibility', () => {
    const cgv = viewerWithFeatures({
      annotation: {labelPosition: 'inline', onlyDrawFavorites: true},
      sequence: {seq: 'A'.repeat(1000)},
      features: [
        {name: 'favorite', source: 'test', start: 100, stop: 500, favorite: true, legend: 'Feature'},
        {name: 'ordinary', source: 'test', start: 500, stop: 800, legend: 'Feature'},
      ],
      track: {position: 'along'},
    });
    const renderer = cgv.annotation._featureLabelRenderer;
    const slot = cgv.tracks(1).slots(1);
    const visibleRange = fullRange(cgv);
    jest.spyOn(cgv.canvas, 'pixelsPerBp').mockReturnValue(1);
    jest.spyOn(cgv.backbone, 'pixelsPerBp').mockReturnValue(10);

    expect(renderer.metricsFor(cgv.features(1), slot.centerOffset, slot.thickness, visibleRange, slot))
      .toBeUndefined();
    cgv.sequence.visible = false;
    expect(renderer.metricsFor(cgv.features(1), slot.centerOffset, slot.thickness, visibleRange, slot))
      .toBeDefined();
    expect(renderer.metricsFor(cgv.features(2), slot.centerOffset, slot.thickness, visibleRange, slot))
      .toBeUndefined();
    cgv.features(1).visible = false;
    expect(renderer.metricsFor(cgv.features(1), slot.centerOffset, slot.thickness, visibleRange, slot))
      .toBeUndefined();
  });

  test('chooses contrast after compositing and honors explicit color precedence', () => {
    const cgv = viewerWithFeatures({
      annotation: {labelPosition: 'inline'},
      settings: {backgroundColor: 'white'},
      legend: {items: [
        {name: 'Transparent dark', swatchColor: 'rgba(0,0,0,0.2)'},
        {name: 'Dark', swatchColor: '#205080'},
      ]},
      features: [
        {name: 'light surface', start: 100, stop: 300, legend: 'Transparent dark'},
        {name: 'dark surface', start: 400, stop: 600, legend: 'Dark'},
      ],
    });
    const renderer = cgv.annotation._featureLabelRenderer;

    expect(renderer._labelColor(cgv.features(1), undefined, 200).rgbaString)
      .toBe('rgba(0,0,0,1)');
    expect(renderer._labelColor(cgv.features(2), undefined, 500).rgbaString)
      .toBe('rgba(255,255,255,1)');

    cgv.annotation.update({color: 'magenta'});
    expect(renderer._labelColor(cgv.features(2), undefined, 500).rgbaString)
      .toBe('rgba(255,0,255,1)');
    cgv.annotation.update({inlineLabelColor: 'yellow'});
    expect(renderer._labelColor(cgv.features(2), undefined, 500).rgbaString)
      .toBe('rgba(255,255,0,1)');
  });

  test('uses the backbone color beneath a centered along-track feature', () => {
    const cgv = viewerWithFeatures({
      annotation: {labelPosition: 'inline'},
      backbone: {color: 'black'},
      legend: {items: [{name: 'Feature', swatchColor: 'rgba(255,255,255,0.2)'}]},
      features: [{name: 'feature', source: 'test', start: 100, stop: 500, legend: 'Feature'}],
      settings: {backgroundColor: 'white'},
      track: {position: 'along'},
    });
    const renderer = cgv.annotation._featureLabelRenderer;
    const slot = cgv.tracks(1).slots(1);

    expect(slot.bbOffset).toBeCloseTo(0);
    expect(renderer._labelColor(cgv.features(1), slot, 300).rgbaString)
      .toBe('rgba(255,255,255,1)');
    expect(renderer._labelColor(cgv.features(1), undefined, 300).rgbaString)
      .toBe('rgba(0,0,0,1)');

    cgv.backbone.visible = false;
    expect(renderer._labelColor(cgv.features(1), slot, 300).rgbaString)
      .toBe('rgba(0,0,0,1)');
  });

  test('inverts an explicit inline label color', () => {
    const cgv = viewerWithFeatures({
      annotation: {labelPosition: 'inline', inlineLabelColor: 'black'},
    });

    cgv.annotation.invertColors();

    expect(cgv.annotation.inlineLabelColor.rgbaString).toBe('rgba(255,255,255,1)');
  });
});
