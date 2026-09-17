import Viewer from '../src/Viewer';

describe.each(['circular', 'linear'])('Along-backbone tracks in %s maps', format => {
  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '<div id="map"></div>';
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function createViewer(options = {}) {
    const cgv = new Viewer('#map', {
      width: 800,
      height: 600,
      sequence: {seq: 'ATG'.repeat(10000)},
      features: [
        {source: 'test', start: 900, stop: 1100, strand: 1},
        {source: 'test', start: 1200, stop: 1400, strand: -1},
      ],
      ...options,
    });
    cgv.addTracks(['along', 'inside', 'outside'].map(position => ({
      position, dataType: 'feature', dataMethod: 'source', dataKeys: 'test', separateFeaturesBy: 'none',
    })));
    cgv.format = format;
    return cgv;
  }

  function drawAtZoom(cgv, zoom) {
    cgv.layout.zoom(zoom, 1000);
    const domains = cgv.layout.domainsFor(1000, cgv.zoomFactor, 0);
    cgv.scale.x.domain(domains.slice(0, 2));
    cgv.scale.y.domain(domains.slice(2));
    cgv.drawFast();
  }

  function expectClearance(cgv) {
    const along = cgv.tracks(1).slots(1);
    expect(along.bbOffset).toBeCloseTo(0);
    expect((along.thickness - cgv.backbone.adjustedThickness) / 2).toBeGreaterThanOrEqual(5 - 1e-8);

    const divider = cgv.dividers.track;
    const expectedGap = 2 * divider.adjustedSpacing + divider.adjustedThickness;
    for (const track of cgv.tracks().slice(1)) {
      const neighbor = track.slots(1);
      const gap = Math.abs(neighbor.bbOffset) - neighbor.thickness / 2 - along.thickness / 2;
      expect(gap).toBeCloseTo(expectedGap);
      expect(gap).toBeGreaterThan(0);
    }
  }

  test('expands for manual backbone thickness and restores the larger normal slot width', () => {
    const cgv = createViewer();
    cgv.drawFast();
    const normal = cgv.tracks(1).slots(1).thickness;
    const neighborWidths = cgv.tracks().slice(1).map(track => track.slots(1).thickness);
    const ratios = cgv.tracks().map(track => track.thicknessRatio);
    const settings = cgv.settings.toJSON();

    cgv.backbone.update({thickness: 80});
    cgv.drawFast();

    expect(cgv.tracks(1).slots(1).thickness).toBe(90);
    expectClearance(cgv);
    expect(cgv.tracks().slice(1).map(track => track.slots(1).thickness)).toEqual(neighborWidths);
    expect(cgv.tracks().map(track => track.thicknessRatio)).toEqual(ratios);
    expect(cgv.settings.toJSON()).toEqual(settings);

    cgv.backbone.update({thickness: 5});
    cgv.drawFast();
    expect(cgv.tracks(1).slots(1).thickness).toBe(normal);
    expectClearance(cgv);
  });

  test('follows sequence and translation expansion through zoom and same-zoom visibility changes', () => {
    const cgv = createViewer();
    const overview = cgv.tracks(1).slots(1).thickness;

    for (const translationVisible of [false, true]) {
      cgv.sequence.translation.visible = translationVisible;
      for (const zoom of [1, 4, 80, 200]) {
        drawAtZoom(cgv, zoom);
        expectClearance(cgv);
      }
      if (translationVisible) {
        expect(cgv.tracks(1).slots(1).thickness).toBeGreaterThan(cgv.settings.maxSlotThickness);
      }
    }

    const expanded = cgv.tracks(1).slots(1).thickness;
    cgv.sequence.translation.visible = false;
    cgv.drawFast();
    expect(cgv.tracks(1).slots(1).thickness).toBeLessThan(expanded);
    expectClearance(cgv);

    cgv.sequence.visible = false;
    cgv.drawFast();
    expect(cgv.backbone.bpThicknessAddition).toBe(0);
    expectClearance(cgv);

    drawAtZoom(cgv, 1);
    expect(cgv.tracks(1).slots(1).thickness).toBe(overview);
  });

  test('keeps custom padding outside every centered slot, including with hidden dividers', () => {
    const cgv = createViewer({backbone: {thickness: 80}, dividers: {track: {spacing: 4, thickness: 2}}});
    cgv.tracks(1).update({separateFeaturesBy: 'strand'});

    for (const visible of [true, false]) {
      cgv.dividers.track.update({visible});
      cgv.drawFast();
      expectClearance(cgv);
      for (const slot of cgv.tracks(1).slots()) {
        expect(slot.thickness).toBe(90);
        expect(slot.bbOffset).toBeCloseTo(0);
      }
    }
  });

  test('finishes overlapping strand features before drawing sequence detail in a full redraw', () => {
    const cgv = createViewer();
    cgv.tracks(1).update({separateFeaturesBy: 'strand'});
    drawAtZoom(cgv, 200);
    const strands = cgv.tracks(1).slots().map(slot => jest.spyOn(slot, 'draw'));
    const sequence = jest.spyOn(cgv.sequence, 'draw');

    cgv.layout.drawFull();
    while (cgv.layout.fullDrawInProgress) { jest.runOnlyPendingTimers(); }

    expect(sequence).toHaveBeenCalled();
    for (const strand of strands) {
      expect(strand).toHaveBeenCalled();
      expect(strand.mock.invocationCallOrder.at(-1)).toBeLessThan(sequence.mock.invocationCallOrder.at(-1));
    }
  });

  test('applies the rendered minimum only over a visible backbone on the first visible track', () => {
    const cgv = createViewer({backbone: {thickness: 80}});
    const along = cgv.tracks(1);
    const normal = along.computedInitialSlotThickness;
    expect(along.slots(1).thickness).toBe(90);

    cgv.backbone.visible = false;
    cgv.drawFast();
    expect(along.slots(1).thickness).toBe(normal);

    cgv.backbone.visible = true;
    along.move(1);
    cgv.drawFast();
    expect(along.slots(1).thickness).toBe(normal);
    expect(along.slots(1).bbOffset).toBeGreaterThan(0);

    cgv.tracks(1).visible = false;
    cgv.drawFast();
    expect(along.slots(1).thickness).toBe(90);
    expect(along.slots(1).bbOffset).toBeCloseTo(0);
  });
});
