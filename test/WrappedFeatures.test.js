import Viewer from '../src/Viewer';
import CGRange from '../src/CGRange';
import Sequence from '../src/Sequence';
import settleExternalLabels from './helpers/settleExternalLabels';

describe('Contig-local wrapped features', () => {
  let viewer;
  let warn;

  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '<div id="map"></div>';
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    await Promise.resolve();
    viewer?.annotation._externalLabels.destroy();
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // Three short records make accidental traversal through either neighbor observable.
  function createViewer({topology = 'circular', target = 'B', format = 'circular', strand = 1,
    feature = {}, sequence, features} = {}) {
    viewer = new Viewer('#map', {
      width: 800, height: 600,
      sequence: sequence || {contigs: ['A', 'B', 'C'].map((name, index) => ({
        name, seq: 'ACG'[index].repeat(100), topology,
      }))},
      legend: {items: [{name: 'Gene', decoration: 'arrow'}]},
      features: features || [{name: 'G', contig: target, start: 90, stop: 10, strand,
        source: 'test', legend: 'Gene', ...feature}],
    });
    viewer.addTracks({name: 'Genes', dataMethod: 'source', dataKeys: 'test', separateFeaturesBy: 'none'});
    viewer.settings.update({format});
    return viewer.features(1);
  }

  const cases = ['circular', 'linear', 'unknown'].flatMap(topology =>
    ['circular', 'linear'].flatMap(format =>
      ['A', 'B', 'C'].flatMap(target => [1, -1].map(strand => ({topology, format, target, strand})))));

  test.each(cases)('$topology topology, $format display, contig $target, strand $strand', options => {
    const feature = createViewer(options);
    const offset = feature.contig.lengthOffset;
    const expected = [[offset + 90, offset + 100], [offset + 1, offset + 10]];
    expect([feature.start, feature.stop, feature.length, feature.mapRange.length]).toEqual([90, 10, 21, 21]);
    expect(feature.mapRanges.map(range => [range.start, range.stop])).toEqual(expected);
    expect(feature.mapRange.copy().mapRanges.map(range => [range.start, range.stop])).toEqual(expected);
    expect(feature.mapRange.onMap.length).toBe(21);
    expect(feature.mapRange.middle).toBe(offset + 100);
    const localSequence = feature.contig.seq.slice(89) + feature.contig.seq.slice(0, 10);
    expect(feature.seq).toBe(options.strand === 1 ? localSequence : Sequence.reverseComplement(localSequence));

    const slot = viewer.slots(1);
    expect(slot.findFeaturesForBp(offset + 95)).toContain(feature);
    expect(slot.findFeaturesForBp(offset + 5)).toContain(feature);
    expect(slot.findFeaturesForBp(offset + 50)).not.toContain(feature);
    expect(slot._featureNCList.find(1, 300)).toEqual([feature]);
    expect(slot._featureNCList.count(1, 300)).toBe(1);
    for (const neighbor of viewer.contigs().filter(contig => contig !== feature.contig)) {
      const bp = neighbor.lengthOffset + 50;
      expect(slot.findFeaturesForBp(bp)).not.toContain(feature);
      expect(feature.range.containsMapBp(bp)).toBe(false);
      expect(feature.mapRange.containsMapBp(bp)).toBe(false);
      expect(feature.mapRange.overlapsMapRange(new CGRange(viewer.sequence.mapContig, bp, bp))).toBe(false);
      expect(viewer.annotation._labelsNCList.find(bp, bp)).not.toContain(feature.label);
    }
    expect(viewer.annotation._featureLabelRenderer._featureRanges(feature)).toEqual(expected);
    expect(feature.label.bpDefault).toBe(offset + 100);

    const draw = jest.spyOn(viewer.canvas, 'drawElement').mockImplementation(() => {});
    feature.draw('map', 100, 20, new CGRange(viewer.sequence.mapContig, 1, 300));
    expect(draw.mock.calls.map(([options]) => [options.start, options.stop])).toEqual(expected);
    expect(draw.mock.calls.map(([options]) => options.decoration)).toEqual(options.strand === 1 ?
      ['arc', 'clockwise-arrow'] : ['counterclockwise-arrow', 'arc']);
  });

  test('anchors external and inline labels to the visible contig segment', () => {
    const feature = createViewer();
    const visibleRange = new CGRange(viewer.sequence.mapContig, 104, 108);
    viewer.annotation._visibleRange = visibleRange;
    viewer.annotation._calculatePositions([feature.label]);
    expect(feature.label.bp).toBe(106);
    const renderer = viewer.annotation._featureLabelRenderer;
    // Make this small visible interval readable so fitting does not hide the label.
    jest.spyOn(viewer.canvas, 'pixelsPerBp').mockReturnValue(10);
    const metrics = renderer.metricsFor(feature, 100, 20, visibleRange);
    expect(metrics).toBeDefined();
    expect(metrics.bp).toBeGreaterThanOrEqual(104);
    expect(metrics.bp).toBeLessThanOrEqual(108);
  });

  test.each(['adaptive', 'classic'].flatMap(method => ['circular', 'linear'].flatMap(format =>
    [false, true].map(locations => ({method, format, locations})))))(
    'publishes outside labels on the feature itself: $method, $format, joined=$locations', async ({method, format, locations}) => {
      jest.useRealTimers();
      const feature = createViewer({format, feature: {name: 'B: 90..10 (21 bp)',
        ...(locations ? {locations: [[90, 100], [1, 10]]} : {})}});
      viewer.addFeatures([
        {name: 'B tail: 90..100', contig: 'B', start: 90, stop: 100, source: 'test'},
        {name: 'B head: 1..10', contig: 'B', start: 1, stop: 10, source: 'test'},
      ]);
      viewer.annotation.update({labelMethod: method, labelPosition: 'outside'});
      viewer.layout.updateLayout(true);
      viewer.drawFull();
      await settleExternalLabels(viewer);
      const placement = viewer.annotation.externalLabelPlacements.find(item => item.label.feature === feature);
      expect(placement).toBeDefined();
      const onFeature = bp => [[190, 200], [101, 110]].some(([start, stop]) => bp >= start - 1e-6 && bp <= stop + 1e-6);
      expect(onFeature(placement.bp)).toBe(true);
      expect(onFeature(viewer.canvas.bpForPoint(placement.points[0], {float: true}))).toBe(true);
    }
  );

  test('selects the feature from its own segments but not from another contig', () => {
    const feature = createViewer();
    const selection = viewer.selection;
    selection._marquee = {initialSelectedFeatures: new Set(), selectedFeatures: new Set()};
    const range = jest.spyOn(selection, 'marqueeRange');
    range.mockReturnValue(new CGRange(viewer.sequence.mapContig, 240, 260));
    selection.selectFeaturesInMarquee();
    expect(feature.selected).toBe(false);
    range.mockReturnValue(new CGRange(viewer.sequence.mapContig, 104, 108));
    selection.selectFeaturesInMarquee();
    expect(feature.selected).toBe(true);
  });

  test('keeps clipped draw calls inside their original segments', () => {
    const feature = createViewer();
    const draw = jest.spyOn(viewer.canvas, 'drawElement').mockImplementation(() => {});
    feature.draw('map', 100, 20, new CGRange(viewer.sequence.mapContig, 104, 108));
    expect(draw).toHaveBeenCalledTimes(1);
    expect(draw.mock.calls[0][0]).toMatchObject({start: 101, stop: 110});
  });

  test.each([1, -1])('draws joined locations across the contig origin without a neighboring connector, strand %i', strand => {
    const feature = createViewer({strand, feature: {locations: [[90, 100], [1, 10]]}});
    const draw = jest.spyOn(viewer.canvas, 'drawElement').mockImplementation(() => {});
    feature.draw('map', 100, 20, new CGRange(viewer.sequence.mapContig, 1, 300));
    expect(draw.mock.calls.map(([options]) => [options.start, options.stop])).toEqual([[190, 200], [101, 110]]);
    expect(feature.length).toBe(21);
    expect(feature.seq).toBe((strand === 1 ? 'C' : 'G').repeat(21));
  });

  test('splits a genuine connector gap at the owning contig origin', () => {
    const feature = createViewer({feature: {locations: [[90, 95], [5, 10]]}});
    const draw = jest.spyOn(viewer.canvas, 'drawElement').mockImplementation(() => {});
    feature.draw('map', 100, 20, new CGRange(viewer.sequence.mapContig, 1, 300));
    expect(draw.mock.calls.map(([options]) => [options.start, options.stop])).toEqual([
      [190, 195], [105, 110], [196, 200], [101, 104],
    ]);
    expect(draw.mock.calls.slice(2).every(([options]) => options.decoration === 'arc')).toBe(true);
  });

  test.each([false, true])('preserves extraction when flipping contig orientation (locations=%s)', locations => {
    const feature = createViewer({feature: locations ? {locations: [[90, 100], [1, 10]]} : {}});
    const bases = feature.seq;
    const contig = feature.contig;
    contig.update({orientation: '-'});
    expect([feature.start, feature.stop, feature.strand]).toEqual([91, 11, -1]);
    expect(feature.seq).toBe(bases);
    expect(feature.mapRange.length).toBe(21);
    if (locations) { expect(feature.locations).toEqual([[91, 100], [1, 11]]); }
    contig.update({orientation: '+'});
    expect([feature.start, feature.stop, feature.strand]).toEqual([90, 10, 1]);
    expect(feature.seq).toBe(bases);
  });

  test('reprojects after contig reorder and visibility changes', () => {
    const feature = createViewer();
    viewer.contigs(1).update({visible: false});
    expect(feature.mapRanges.map(range => [range.start, range.stop])).toEqual([[90, 100], [1, 10]]);
    expect(viewer.slots(1).findFeaturesForBp(150)).not.toContain(feature);
    viewer.contigs(1).update({visible: true});
    feature.contig.move(0);
    expect(feature.mapRanges.map(range => [range.start, range.stop])).toEqual([[90, 100], [1, 10]]);
    expect(viewer.slots(1).findFeaturesForBp(150)).not.toContain(feature);
    expect(feature.label.bpDefault).toBe(100);
  });

  test('rebuilds index entries and labels after feature coordinate updates', () => {
    const feature = createViewer();
    feature.update({start: 80, stop: 20});
    expect(viewer.slots(1).findFeaturesForBp(115)).toContain(feature);
    feature.update({mapStart: 130, mapStop: 140});
    expect(viewer.slots(1).findFeaturesForBp(115)).not.toContain(feature);
    expect(viewer.slots(1).findFeaturesForBp(135)).toContain(feature);
    expect(feature.label.bpDefault).toBe(135);
    feature.update({locations: [[90, 100], [1, 10]]});
    expect(viewer.slots(1).findFeaturesForBp(105)).toContain(feature);
    expect(viewer.slots(1).findFeaturesForBp(250)).not.toContain(feature);
    expect(feature.label.bpDefault).toBe(200);
  });

  test('navigates to the owning contig to show both separated segments', () => {
    const feature = createViewer();
    const move = jest.spyOn(viewer, 'moveTo').mockImplementation(() => {});
    feature.moveTo(0);
    expect(move).toHaveBeenCalledWith(96, 205, {duration: 0, ease: undefined});
  });

  test.each(['circular', 'linear', 'unknown'])('round-trips %s topology without changing display or feature coordinates', topology => {
    createViewer({topology, format: 'linear'});
    const json = JSON.parse(JSON.stringify(viewer.io.toJSON()));
    expect(json.cgview.sequence.contigs.map(contig => contig.topology)).toEqual([topology, topology, topology]);
    viewer.io.loadJSON(json);
    expect(viewer.format).toBe('linear');
    expect(viewer.features(1).mapRange.length).toBe(21);
    expect(viewer.contigs(2).topology).toBe(topology);
    expect(viewer.sequence.topology).toBe('unknown');
  });

  test.each(['circular', 'linear', 'unknown'])('accepts %s topology in single-sequence shorthand', topology => {
    const feature = createViewer({sequence: {seq: 'A'.repeat(100), topology}, feature: {contig: undefined}});
    expect(viewer.contigs(1).topology).toBe(topology);
    expect(viewer.sequence.topology).toBe(topology);
    expect(viewer.sequence.isCircular).toBe(topology === 'circular');
    expect(viewer.sequence.isLinear).toBe(topology === 'linear');
    expect(feature.mapRange.length).toBe(21);
  });

  test.each(['circular', 'linear'])('preserves legacy whole-map origin wrapping in %s display', format => {
    const feature = createViewer({format, feature: {contig: undefined, start: 290, stop: 10}});
    expect(feature.mapRange.length).toBe(21);
    expect(feature.mapRanges.map(range => [range.start, range.stop])).toEqual([[290, 300], [1, 10]]);
    expect(viewer.slots(1)._featureNCList.find(295, 5)).toEqual([feature]);
    expect(viewer.slots(1).findFeaturesForBp(150)).not.toContain(feature);
  });

  test('defaults missing topology to unknown and warns once across repeated draws', async () => {
    const feature = createViewer({topology: undefined, sequence: {contigs: ['A', 'B', 'C'].map(name => ({name, length: 100}))}});
    await Promise.resolve();
    expect(feature.contig.topology).toBe('unknown');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/contig "B".*unknown.*"G" \(90\.\.10\).*unconfirmed/);
    viewer.drawFull();
    viewer.drawFast();
    feature.update({start: 90, stop: 10});
    await Promise.resolve();
    expect(warn).toHaveBeenCalledTimes(1);
    feature.contig.update({topology: 'linear'});
    await Promise.resolve();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[1][0]).toContain('conflicts with its declared linear topology');
    expect([feature.start, feature.stop, feature.contig.topology]).toEqual([90, 10, 'linear']);
    feature.contig.update({topology: 'circular'});
    await Promise.resolve();
    expect(warn).toHaveBeenCalledTimes(2);
    feature.contig.update({topology: 'unknown'});
    await Promise.resolve();
    expect(warn).toHaveBeenCalledTimes(3);
  });

  test('summarizes bulk import warnings by contig', async () => {
    createViewer({topology: 'unknown', features: Array.from({length: 7}, (_, index) => ({
      name: `wrapped-${index}`, contig: 'B', start: 90, stop: 10, source: 'test',
    }))});
    await Promise.resolve();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('7 wrapped feature(s)');
    expect(warn.mock.calls[0][0]).toContain('and 2 more');
  });

  test('retains the owning contig when converting a wrapped feature to map coordinates', () => {
    const feature = createViewer();
    const contig = feature.contig;
    feature.moveToMapContig();
    expect(feature.contig).toBe(contig);
    expect(feature.mapRanges.map(range => [range.start, range.stop])).toEqual([[190, 200], [101, 110]]);
    expect(contig.features()).toContain(feature);
    expect(warn.mock.calls[0][0]).toContain('must retain its contig');
  });

  test.each(['feature', 'shared', 'individual'].flatMap(api =>
    [false, true].map(coordinatesFirst => ({api, coordinatesFirst}))))(
    'applies compound map conversion atomically via $api (coordinatesFirst=$coordinatesFirst)', ({api, coordinatesFirst}) => {
      const feature = createViewer();
      const oldContig = feature.contig;
      const attributes = coordinatesFirst ? {start: 190, stop: 200, contig: undefined} :
        {contig: undefined, start: 190, stop: 200};
      if (api === 'feature') { feature.update(attributes); }
      if (api === 'shared') { viewer.updateFeatures([feature], attributes); }
      if (api === 'individual') { viewer.updateFeatures({[feature.cgvID]: attributes}); }
      expect(feature.contig).toBe(viewer.sequence.mapContig);
      expect([feature.start, feature.stop, feature.length]).toEqual([190, 200, 11]);
      expect(oldContig.features()).not.toContain(feature);
      expect(viewer.sequence.mapContig.features()).toContain(feature);
      expect(viewer.slots(1).findFeaturesForBp(195)).toContain(feature);
      expect(viewer.slots(1).findFeaturesForBp(105)).not.toContain(feature);
      expect(feature.label.bpDefault).toBe(195);
      expect(warn).not.toHaveBeenCalled();
    }
  );

  test('uses supplied map coordinates when converting with a map-contig object', () => {
    const feature = createViewer();
    feature.update({mapStop: 200, contig: viewer.sequence.mapContig});
    expect(feature.contig).toBe(viewer.sequence.mapContig);
    expect([feature.start, feature.stop, feature.length]).toEqual([190, 200, 11]);
  });

  test('uses replacement locations in the destination contig coordinates', () => {
    const feature = createViewer({feature: {locations: [[90, 100], [1, 10]]}});
    feature.update({locations: [[190, 195], [198, 200]], contig: undefined});
    expect(feature.contig).toBe(viewer.sequence.mapContig);
    expect(feature.locations).toEqual([[190, 195], [198, 200]]);
    expect([feature.start, feature.stop, feature.length]).toEqual([190, 200, 9]);
    expect(feature.seq).toBe('C'.repeat(9));
  });

  test('preserves joined segments when converting to map coordinates without replacement locations', () => {
    const feature = createViewer({feature: {locations: [[20, 30], [40, 50]]}});
    feature.update({contig: undefined});
    expect(feature.contig).toBe(viewer.sequence.mapContig);
    expect(feature.locations).toEqual([[120, 130], [140, 150]]);
    expect([feature.start, feature.stop, feature.length]).toEqual([120, 150, 22]);
    expect(feature.seq).toBe('C'.repeat(22));
  });

  test.each([
    {contig: 'missing'},
    {contig: undefined, locations: [[190, 180]]},
    {contig: undefined, start: 'invalid', stop: 200},
  ])('rejects invalid destination geometry without changing other fields: %p', attributes => {
    const feature = createViewer();
    const oldContig = feature.contig;
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    feature.update({name: 'changed', ...attributes});
    expect(feature.contig).toBe(oldContig);
    expect([feature.name, feature.start, feature.stop, feature.length]).toEqual(['G', 90, 10, 21]);
    expect(oldContig.features()).toContain(feature);
    expect(viewer.sequence.mapContig.features()).not.toContain(feature);
    expect(error).toHaveBeenCalledTimes(1);
  });

  test.each([false, true])('rejects an unsafe conversion without partially applying other fields (contigFirst=%s)', contigFirst => {
    const feature = createViewer();
    const oldContig = feature.contig;
    const attributes = contigFirst ? {contig: undefined, name: 'changed', start: 190, stop: 110} :
      {name: 'changed', start: 190, stop: 110, contig: undefined};
    const events = jest.fn();
    viewer.on('features-update.atomic-test', events);
    feature.update(attributes);
    expect(feature.contig).toBe(oldContig);
    expect([feature.name, feature.start, feature.stop, feature.length]).toEqual(['G', 90, 10, 21]);
    expect(oldContig.features()).toContain(feature);
    expect(viewer.sequence.mapContig.features()).not.toContain(feature);
    expect(viewer.slots(1).findFeaturesForBp(105)).toContain(feature);
    expect(events).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  test('keeps rejected records out of mixed update events', () => {
    const wrapped = createViewer();
    const ordinary = viewer.addFeatures({name: 'other', contig: 'C', start: 20, stop: 30})[0];
    const events = jest.fn();
    viewer.on('features-update.atomic-test', events);
    viewer.updateFeatures({
      [wrapped.cgvID]: {name: 'rejected', contig: undefined},
      [ordinary.cgvID]: {name: 'accepted'},
    });
    expect(wrapped.name).toBe('G');
    expect(ordinary.name).toBe('accepted');
    expect(events).toHaveBeenCalledTimes(1);
    expect(events.mock.calls[0][0].features).toEqual([ordinary]);
    expect(Object.keys(events.mock.calls[0][0].updates)).toEqual([ordinary.cgvID]);
  });

  test('does not repeat whole-map warnings when rebuilding the synthetic map contig', async () => {
    const feature = createViewer({feature: {contig: undefined, start: 290, stop: 10}});
    await Promise.resolve();
    expect(warn).toHaveBeenCalledTimes(1);
    viewer.contigs('B').update({name: 'renamed'});
    await Promise.resolve();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(feature.contig).toBe(viewer.sequence.mapContig);
    expect(feature.length).toBe(21);
  });

  test('warns for final edits only, including direct assignments', async () => {
    const feature = createViewer({topology: 'unknown', feature: {start: 20, stop: 30}});
    feature.update({start: 90, stop: 95});
    await Promise.resolve();
    expect(warn).not.toHaveBeenCalled();
    feature.stop = 10;
    await Promise.resolve();
    expect(warn).toHaveBeenCalledTimes(1);
    feature.start = 80;
    await Promise.resolve();
    expect(warn).toHaveBeenCalledTimes(2);
  });

  test('does not warn for circular topology or removed features', async () => {
    const feature = createViewer();
    await Promise.resolve();
    expect(warn).not.toHaveBeenCalled();
    feature.contig.topology = 'unknown';
    feature.remove();
    await Promise.resolve();
    expect(warn).not.toHaveBeenCalled();
  });
});
