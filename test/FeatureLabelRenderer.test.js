import Viewer from '../src/Viewer';
import CGRange from '../src/CGRange';

describe('Inline feature labels', () => {

  beforeEach(() => {
    document.body.innerHTML = '<div id="map"></div>';
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
    jest.spyOn(cgv.canvas, 'pixelsPerBp')
      .mockReturnValue((targetWidth + 4) / feature.length);
    feature.label.width = 200;

    const metrics = renderer.metricsFor(feature, 100, 20, fullRange(cgv));

    expect(metrics.text).toBe('long d…');
    expect(metrics.characters).toEqual(Array.from('long d…'));
    expect(metrics.fontSize).toBe(14);
    expect(metrics.textWidth).toBeLessThanOrEqual(metrics.availableWidth + 0.01);

    cgv.annotation.update({inlineLabelAllowTruncation: false});
    expect(renderer.metricsFor(feature, 100, 20, fullRange(cgv))).toBeUndefined();
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

  test('uses outside labels only when automatic inline placement is unavailable', () => {
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

    const outsideNames = cgv.annotation._visibleLabels.map(label => label.feature.name);
    expect(outsideNames).toContain('needs fallback');
    expect(outsideNames).not.toContain('fits inline');
  });

  test('skips outside-label membership checks when no inline labels fit', () => {
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

    renderer.draw([cgv.features(1)], slot.centerOffset, slot.thickness, visibleRange, slot);
    expect(drawCurvedLabel).toHaveBeenCalledTimes(1);
    expect(drawCurvedLabel.mock.calls[0][0]).toBe(cgv.features(1));
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

  test('reserves configured and automatic arrowheads from the label body', () => {
    const cgv = viewerWithFeatures({
      annotation: {labelPosition: 'inline'},
      legend: {items: [
        {name: 'Arrow', decoration: 'arrow'},
        {name: 'Auto', decoration: 'auto'},
      ]},
      features: [
        {name: 'gene', start: 100, stop: 200, strand: 1, legend: 'Arrow'},
        {name: 'A', start: 300, stop: 307, strand: 1, legend: 'Auto'},
        {name: 'B', start: 400, stop: 404, strand: 1, legend: 'Auto'},
        {name: 'reverse', start: 600, stop: 700, strand: -1, legend: 'Arrow'},
      ],
    });
    const renderer = cgv.annotation._featureLabelRenderer;
    jest.spyOn(cgv.canvas, 'pixelsPerBp').mockReturnValue(1);

    const metrics = renderer.metricsFor(cgv.features(1), 100, 20, fullRange(cgv));
    const reverseMetrics = renderer.metricsFor(cgv.features(4), 100, 20, fullRange(cgv));
    const growingAuto = renderer._usableSegment(
      cgv.features(2),
      {start: 300, stop: 307, length: 8},
      100,
      20,
      1
    );
    const shortAuto = renderer._usableSegment(
      cgv.features(3),
      {start: 400, stop: 404, length: 5},
      100,
      20,
      1
    );

    expect(metrics.bp).toBeCloseTo(147);
    expect(reverseMetrics.bp).toBeCloseTo(653);
    expect(growingAuto.stop).toBeCloseTo(304.5);
    expect(shortAuto.stop).toBeCloseTo(404.5);
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
