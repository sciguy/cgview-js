import Viewer from '../src/Viewer';

describe('Track sizing', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '<div id="map"></div><div id="copy"></div>';
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function viewerWithTracks({format = 'circular', ratios = [1, 1], split = false, plot = false, ...options} = {}) {
    const cgv = new Viewer('#map', {
      width: 800,
      height: 600,
      sequence: {length: 10000},
      features: ratios.flatMap((ratio, index) => [
        {source: `source-${index}`, start: 100, stop: 300, strand: 1},
        {source: `source-${index}`, start: 500, stop: 700, strand: -1},
      ]),
      plots: [{source: 'coverage', positions: [1, 5000, 10000], scores: [0.2, 0.8, 0.4]}],
      ...options,
    });
    cgv.addTracks(ratios.map((thicknessRatio, index) => ({
      name: `Track ${index + 1}`,
      thicknessRatio,
      dataType: plot && index === ratios.length - 1 ? 'plot' : 'feature',
      dataMethod: 'source',
      dataKeys: plot && index === ratios.length - 1 ? 'coverage' : `source-${index}`,
      position: split && index === 0 ? 'both' : index % 2 === 0 ? 'outside' : 'inside',
      separateFeaturesBy: split && index === 0 ? 'strand' : 'none',
    })));
    cgv.format = format;
    return cgv;
  }

  // Set a known focal base and radial offset without a scheduled transition.
  function setView(cgv, zoom = 8, bp = 3471.25, offset = 13) {
    cgv.layout.zoom(zoom, bp);
    const domains = cgv.layout.domainsFor(bp, zoom, offset);
    cgv.scale.x.domain(domains.slice(0, 2));
    cgv.scale.y.domain(domains.slice(2));
    cgv.layout.updateLayout(true);
  }

  function widths(cgv) {
    return cgv.layout.visibleSlots().map(slot => slot.thickness);
  }

  test.each(['circular', 'linear'])('ratio mode equals the existing update API in %s maps', format => {
    const cgv = viewerWithTracks({format, ratios: [2, 1, 3], split: true, plot: true});
    const track = cgv.tracks(1);
    const original = cgv.io.toJSON();
    const settings = cgv.settings.toJSON();
    track.update({thicknessRatio: 4});
    const expected = widths(cgv);
    const expectedJSON = cgv.tracks().map(item => item.toJSON());
    cgv.io.loadJSON(original);

    expect(cgv.tracks(1).setThickness(4, {mode: 'ratio'})).toBe(cgv.tracks(1));
    expect(widths(cgv)).toEqual(expected);
    expect(cgv.tracks().map(item => item.toJSON())).toEqual(expectedJSON);
    expect(cgv.settings.toJSON()).toEqual(settings);
    expect(cgv.tracks(2).computedInitialSlotThickness).toBeLessThan(60 / 8);
  });

  test.each(['circular', 'linear'])('hits per-slot pixel targets and preserves neighbours in %s maps', format => {
    const cgv = viewerWithTracks({format, ratios: [2, 1, 3], split: true, plot: true});
    const track = cgv.tracks(1);
    const neighbours = cgv.tracks().slice(1).map(item => [item, item.computedInitialSlotThickness, item.thicknessRatio]);
    expect(track.slots().length).toBe(2);

    for (const target of [20, 8, 70, 0.25, 25]) {
      track.setThickness(target, {mode: 'pixels'});
      expect(track.computedInitialSlotThickness).toBeCloseTo(target, 8);
      track.slots().forEach(slot => expect(slot.thickness).toBeCloseTo(target, 8));
      neighbours.forEach(([other, thickness, ratio]) => {
        expect(other.computedInitialSlotThickness).toBeCloseTo(thickness, 8);
        expect(other.slots(1).thickness).toBeCloseTo(thickness, 8);
        expect(other.thicknessRatio).toBe(ratio);
      });
    }
    const featureBefore = track.computedInitialSlotThickness;
    cgv.tracks(3).setThickness(35, {mode: 'pixels'});
    expect(cgv.tracks(3).slots(1).thickness).toBeCloseTo(35, 8);
    expect(track.computedInitialSlotThickness).toBeCloseTo(featureBefore, 8);
  });

  test.each(['circular', 'linear'])('uses actual dimensions and map limits in portrait %s maps', format => {
    const cgv = viewerWithTracks({format, width: 400, height: 900,
      settings: {initialMapThicknessProportion: 0.7, maxMapThicknessProportion: 0.05}});
    const before = cgv.tracks(2).computedInitialSlotThickness;
    cgv.tracks(1).setThickness(40, {mode: 'pixels'});
    expect(cgv.tracks(1).slots(1).thickness).toBeCloseTo(40, 8);
    expect(cgv.tracks(2).slots(1).thickness).toBeCloseTo(before, 8);
  });

  test.each(['circular', 'linear'])('a single track can resize without another ratio as an anchor in %s maps', format => {
    const cgv = viewerWithTracks({format, ratios: [3], split: true});
    cgv.tracks(1).setThickness(20, {mode: 'pixels'});
    expect(widths(cgv)).toEqual([20, 20]);
    expect(cgv.tracks(1).thicknessRatio).toBe(3);
  });

  test.each(['circular', 'linear'])('preserves focal position at low and high zoom in %s maps', format => {
    const cgv = viewerWithTracks({format, ratios: [2, 1, 3], split: true});
    const move = jest.spyOn(cgv, 'moveTo');
    const zoomTo = jest.spyOn(cgv, 'zoomTo');
    for (const zoom of [1.5, 8]) {
      setView(cgv, zoom);
      const before = cgv.bpFloat;
      const offset = cgv.bbOffset;
      const other = cgv.tracks(2).computedInitialSlotThickness;
      for (const value of [20, 35, 12]) {
        cgv.tracks(1).setThickness(value, {mode: 'pixels'});
        expect(cgv.zoomFactor).toBe(zoom);
        expect(cgv.bpFloat).toBeCloseTo(before, 7);
        expect(cgv.bbOffset).toBeCloseTo(offset, 7);
        expect(cgv.tracks(1).computedInitialSlotThickness).toBeCloseTo(value, 8);
        expect(cgv.tracks(2).computedInitialSlotThickness).toBeCloseTo(other, 8);
        expect(cgv.tracks(1).slots(1).thickness).toBeLessThanOrEqual(cgv.settings.maxSlotThickness + 1e-8);
      }
    }
    expect(move).not.toHaveBeenCalled();
    expect(zoomTo).not.toHaveBeenCalled();
    expect(cgv.canvas.node('ui').__transition).toBeUndefined();
  });

  test('cancels an in-flight recenter instead of queuing another slider animation', () => {
    const cgv = viewerWithTracks();
    setView(cgv);
    cgv.moveTo(7000, undefined, {duration: 500});
    const before = cgv.bpFloat;
    cgv.tracks(1).setThickness(40, {mode: 'pixels'});
    expect(cgv.canvas.node('ui').__transition).toBeUndefined();
    jest.advanceTimersByTime(1000);
    expect(cgv.bpFloat).toBeCloseTo(before, 7);
  });

  test('overview readout is pure, including during an outer batch', () => {
    const cgv = viewerWithTracks();
    setView(cgv);
    const geometry = widths(cgv);
    const domains = [cgv.scale.x.domain(), cgv.scale.y.domain()];
    const layout = jest.spyOn(cgv.layout, 'updateLayout');
    const trigger = jest.spyOn(cgv, 'trigger');
    expect(cgv.tracks(1).computedInitialSlotThickness).toBeCloseTo(30);
    expect(widths(cgv)).toEqual(geometry);
    expect([cgv.scale.x.domain(), cgv.scale.y.domain()]).toEqual(domains);
    expect(cgv.zoomFactor).toBe(8);
    expect(layout).not.toHaveBeenCalled();
    expect(trigger).not.toHaveBeenCalled();
    cgv.layout.batchProportionUpdates(() => {
      cgv.tracks(1).update({thicknessRatio: 2});
      expect(cgv.tracks(1).computedInitialSlotThickness).toBeCloseTo(40);
      cgv.tracks(2).setThickness(15, {mode: 'pixels'});
    });
    expect(cgv.tracks(1).computedInitialSlotThickness).toBeCloseTo(40);
    expect(cgv.tracks(2).computedInitialSlotThickness).toBeCloseTo(15);
  });

  test('pixel sizing is proportional again after canvas resizing', () => {
    const cgv = viewerWithTracks();
    cgv.tracks(1).setThickness(20, {mode: 'pixels'});
    cgv.resize(400, 300);
    expect(cgv.tracks(1).computedInitialSlotThickness).toBeCloseTo(10);
    cgv.tracks(1).setThickness(20, {mode: 'pixels'});
    expect(cgv.tracks(1).slots(1).thickness).toBeCloseTo(20);
  });

  test.each([undefined, null, {}, {mode: 'fixed'}, {mode: 'Pixels'}])('requires an explicit valid mode: %p', options => {
    const cgv = viewerWithTracks();
    expect(() => cgv.tracks(1).setThickness(20, options)).toThrow(TypeError);
  });

  test.each([0, -1, NaN, Infinity, -Infinity, '20', null, undefined])('rejects invalid API values without mutation: %p', value => {
    const cgv = viewerWithTracks();
    const settings = cgv.settings.toJSON();
    const layout = jest.spyOn(cgv.layout, '_calculateMaxMapThickness');
    for (const mode of ['ratio', 'pixels']) {
      expect(() => cgv.tracks(1).setThickness(value, {mode})).toThrow(RangeError);
    }
    expect(cgv.tracks(1).thicknessRatio).toBe(1);
    expect(cgv.settings.toJSON()).toEqual(settings);
    expect(layout).not.toHaveBeenCalled();
  });

  test('hidden, removed, loading, and slotless tracks have predictable behaviour', () => {
    const cgv = viewerWithTracks();
    const hidden = cgv.tracks(1);
    hidden.update({visible: false});
    const slotless = cgv.addTracks({dataKeys: 'absent', separateFeaturesBy: 'type'})[0];
    const removed = cgv.addTracks({dataKeys: 'source-0'})[0];
    removed.remove();
    for (const track of [hidden, slotless, removed]) {
      expect(track.computedInitialSlotThickness).toBeUndefined();
      expect(() => track.setThickness(20, {mode: 'pixels'})).toThrow(/visible track with visible slots/);
    }
    hidden.setThickness(2, {mode: 'ratio'});
    slotless.setThickness(3, {mode: 'ratio'});
    expect(hidden.thicknessRatio).toBe(2);
    expect(slotless.thicknessRatio).toBe(3);
    cgv._loading = true;
    expect(cgv.tracks(2).computedInitialSlotThickness).toBeUndefined();
    expect(() => cgv.tracks(2).setThickness(20, {mode: 'pixels'})).toThrow(/loaded/);
    cgv._loading = false;
  });

  test('counts only visible slots and excludes hidden tracks', () => {
    const cgv = viewerWithTracks({ratios: [1, 1, 100], split: true});
    cgv.tracks(3).update({visible: false});
    cgv.tracks(1).slots(2).visible = false;
    cgv.layout._adjustProportions();
    const other = cgv.tracks(2).computedInitialSlotThickness;
    cgv.tracks(1).setThickness(20, {mode: 'pixels'});
    expect(cgv.tracks(1).slots(1).thickness).toBeCloseTo(20);
    expect(cgv.tracks(2).computedInitialSlotThickness).toBeCloseTo(other);
    expect(cgv.tracks(3).thicknessRatio).toBe(100);
    cgv.tracks(1).slots(1).visible = false;
    expect(cgv.tracks(1).computedInitialSlotThickness).toBeUndefined();
    expect(() => cgv.tracks(1).setThickness(20, {mode: 'pixels'})).toThrow();
  });

  test('loads and saves maxSlotThickness with legacy defaults', () => {
    const cgv = viewerWithTracks({settings: {maxSlotThickness: 90}});
    expect(cgv.settings.maxSlotThickness).toBe(90);
    cgv.settings.update({maxSlotThickness: 120});
    expect(cgv.layout.maxSlotThickness).toBe(120);
    expect(cgv.io.toJSON().cgview.settings.maxSlotThickness).toBe(120);
    cgv.io.loadJSON({cgview: {version: '1.8.0', sequence: {length: 10000}}});
    expect(cgv.settings.maxSlotThickness).toBe(50);
    expect(cgv.io.toJSON().cgview.settings.maxSlotThickness).toBe(50);
  });

  test.each(['circular', 'linear'])('round-trips only ratios and settings in %s maps', format => {
    const cgv = viewerWithTracks({format, ratios: [2, 1, 3], split: true, plot: true});
    cgv.tracks(1).setThickness(65, {mode: 'pixels'});
    const json = cgv.io.toJSON();
    json.cgview.tracks.forEach(track => {
      expect(track).not.toHaveProperty('computedInitialSlotThickness');
      expect(track).not.toHaveProperty('thickness');
      expect(track).not.toHaveProperty('thicknessMode');
    });
    const copy = new Viewer('#copy', {width: 800, height: 600});
    copy.io.loadJSON(json);
    expect(copy.settings.toJSON()).toEqual(cgv.settings.toJSON());
    copy.tracks().forEach((track, i) => {
      expect(track.thicknessRatio).toBe(cgv.tracks()[i].thicknessRatio);
      expect(track.computedInitialSlotThickness).toBeCloseTo(cgv.tracks()[i].computedInitialSlotThickness, 8);
    });
  });

  test('validates stored sizing values and avoids redundant calculations', () => {
    const cgv = viewerWithTracks({ratios: [NaN, Infinity, -1]});
    cgv.tracks().forEach(track => expect(track.thicknessRatio).toBe(1));
    const calculation = jest.spyOn(cgv.layout, '_calculateMaxMapThickness');
    for (const value of [NaN, Infinity, -1, 0, 'invalid']) {
      cgv.tracks(1).update({thicknessRatio: value});
      cgv.settings.update({initialMapThicknessProportion: value, maxMapThicknessProportion: value, maxSlotThickness: value});
    }
    cgv.settings.update({maxSlotThickness: 0.5});
    cgv.settings.update({initialMapThicknessProportion: 0.1, maxMapThicknessProportion: 0.5, maxSlotThickness: 50});
    cgv.tracks(1).setThickness(1, {mode: 'ratio'});
    cgv.tracks(1).setThickness(cgv.tracks(1).computedInitialSlotThickness, {mode: 'pixels'});
    expect(calculation).not.toHaveBeenCalled();
    expect(cgv.settings.maxSlotThickness).toBe(50);
    expect(cgv.settings.initialMapThicknessProportion).toBe(0.1);
    expect(cgv.settings.maxMapThicknessProportion).toBe(0.5);
    cgv.tracks(1).update({thicknessRatio: '2'});
    expect(cgv.tracks(1).thicknessRatio).toBe(2);
  });

  test('batches coordinated layout and notifies observers after final geometry', () => {
    const cgv = viewerWithTracks();
    const calculation = jest.spyOn(cgv.layout, '_calculateMaxMapThickness');
    const layout = jest.spyOn(cgv.layout, 'updateLayout');
    const events = [];
    for (const event of ['settings-update', 'tracks-update']) {
      cgv.on(event, payload => {
        events.push([event, payload]);
        expect(cgv.tracks(1).slots(1).thickness).toBeCloseTo(80);
        expect(cgv.tracks(2).slots(1).thickness).toBeCloseTo(30);
      });
    }
    cgv.tracks(1).setThickness(80, {mode: 'pixels'});
    expect(calculation).toHaveBeenCalledTimes(1);
    expect(layout).toHaveBeenCalledTimes(1);
    expect(events.map(([event]) => event)).toEqual(['settings-update', 'tracks-update']);
    expect(events[0][1].attributes.maxSlotThickness).toBeCloseTo(80);
    expect(events[1][1].attributes.thicknessRatio).toBeCloseTo(80 / 30);
  });

  test('batches direct settings updates, nested calls, no-ops, and flushes on exceptions', () => {
    const cgv = viewerWithTracks();
    const calculation = jest.spyOn(cgv.layout, '_calculateMaxMapThickness');
    cgv.settings.update({initialMapThicknessProportion: 0.2, maxMapThicknessProportion: 0.7, maxSlotThickness: 70});
    expect(calculation).toHaveBeenCalledTimes(1);
    calculation.mockClear();
    expect(cgv.layout.batchProportionUpdates(() => {
      cgv.tracks(1).setThickness(30, {mode: 'pixels'});
      cgv.tracks(2).setThickness(40, {mode: 'pixels'});
      return 42;
    })).toBe(42);
    expect(calculation).toHaveBeenCalledTimes(1);
    expect(cgv.tracks(1).slots(1).thickness).toBeCloseTo(30);
    expect(cgv.tracks(2).slots(1).thickness).toBeCloseTo(40);
    calculation.mockClear();
    cgv.layout.batchProportionUpdates(() => {});
    expect(calculation).not.toHaveBeenCalled();
    expect(() => cgv.layout.batchProportionUpdates(() => {
      cgv.tracks(1).update({thicknessRatio: 2});
      throw new Error('test interruption');
    })).toThrow('test interruption');
    expect(calculation).toHaveBeenCalledTimes(1);
    expect(cgv.layout._proportionUpdateDepth).toBe(0);
  });

  test.each(['circular', 'linear'])('handles a shared overview cap and successive track edits in %s maps', format => {
    const cgv = viewerWithTracks({format, ratios: [4, 1, 2], settings: {initialMapThicknessProportion: 0.9}});
    expect(widths(cgv)).toEqual([50, 12.5, 25]);
    cgv.tracks(2).setThickness(80, {mode: 'pixels'});
    expect(widths(cgv)[0]).toBeCloseTo(50);
    expect(widths(cgv)[1]).toBeCloseTo(80);
    expect(widths(cgv)[2]).toBeCloseTo(25);
    cgv.tracks(3).setThickness(20, {mode: 'pixels'});
    expect(widths(cgv)[0]).toBeCloseTo(50);
    expect(widths(cgv)[1]).toBeCloseTo(80);
    expect(cgv.settings.maxSlotThickness).toBeCloseTo(80);
    setView(cgv, cgv.maxZoomFactor);
    widths(cgv).forEach(width => expect(width).toBeLessThanOrEqual(cgv.settings.maxSlotThickness + 1e-8));
  });

  test('preserves a cap-and-floor layout when the requested target is compatible', () => {
    const cgv = viewerWithTracks({ratios: [0.01, 1, 2, 100], settings: {initialMapThicknessProportion: 0.9}});
    const before = widths(cgv);
    expect(before[0]).toBeCloseTo(1);
    cgv.tracks(3).setThickness(5, {mode: 'pixels'});
    widths(cgv).forEach((width, i) => expect(width).toBeCloseTo(i === 2 ? 5 : before[i], 8));
  });

  test('rejects incompatible floor targets and overflow before mutation', () => {
    const cgv = viewerWithTracks({ratios: [0.01, 1, 2, 100], settings: {initialMapThicknessProportion: 0.9}});
    const before = widths(cgv);
    const settings = cgv.settings.toJSON();
    const ratios = cgv.tracks().map(track => track.thicknessRatio);
    const calculation = jest.spyOn(cgv.layout, '_calculateMaxMapThickness');
    expect(() => cgv.tracks(3).setThickness(0.5, {mode: 'pixels'})).toThrow(/shared limits/);
    expect(() => cgv.tracks(3).setThickness(Number.MAX_VALUE, {mode: 'pixels'})).toThrow(RangeError);
    expect(widths(cgv)).toEqual(before);
    expect(cgv.settings.toJSON()).toEqual(settings);
    expect(cgv.tracks().map(track => track.thicknessRatio)).toEqual(ratios);
    expect(calculation).not.toHaveBeenCalled();
  });

  test('rejects a circular target that would create a negative backbone radius', () => {
    const cgv = viewerWithTracks({ratios: [1]});
    const settings = cgv.settings.toJSON();
    const radius = cgv.backbone.centerOffset;
    expect(() => cgv.tracks(1).setThickness(800, {mode: 'pixels'})).toThrow(/map geometry/);
    expect(cgv.settings.toJSON()).toEqual(settings);
    expect(cgv.backbone.centerOffset).toBe(radius);
  });

  test.each([0.000001, 0.1, 1, 30, 50, 100, 150])('handles fractional ratios and pixel target %p', target => {
    const cgv = viewerWithTracks({ratios: [1 / 3, 5 / 7, 1.1]});
    const others = cgv.tracks().slice(1).map(track => track.computedInitialSlotThickness);
    cgv.tracks(1).setThickness(target, {mode: 'pixels'});
    expect(cgv.tracks(1).slots(1).thickness).toBeCloseTo(target, 9);
    cgv.tracks().slice(1).forEach((track, i) => expect(track.computedInitialSlotThickness).toBeCloseTo(others[i], 9));
  });
});
