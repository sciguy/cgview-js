import Viewer from '../src/Viewer';

describe.each(['circular', 'linear'])('Hidden backbone detail space in %s maps', format => {
  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '<div id="map"></div>';
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function createViewer({along = false, sequence = {seq: 'ATG'.repeat(1000)}} = {}) {
    const cgv = new Viewer('#map', {
      width: 800, height: 600, sequence,
      backbone: {visible: false},
      features: [{source: 'test', start: 900, stop: 1100}],
    });
    const positions = along ? ['along', 'inside', 'outside'] : ['inside', 'outside'];
    cgv.addTracks(positions.map(position => ({
      position, dataType: 'feature', dataMethod: 'source', dataKeys: 'test', separateFeaturesBy: 'none',
    })));
    cgv.format = format;
    return cgv;
  }

  function zoomToDetail(cgv) {
    cgv.layout.zoom(cgv.maxZoomFactor, 1000);
    const domains = cgv.layout.domainsFor(1000, cgv.zoomFactor, 0);
    cgv.scale.x.domain(domains.slice(0, 2));
    cgv.scale.y.domain(domains.slice(2));
    cgv.drawFast();
  }

  function neighborEdges(cgv) {
    return cgv.tracks().filter(track => track.position !== 'along').map(track => {
      const slot = track.slots(1);
      return Math.abs(slot.bbOffset) - slot.thickness / 2;
    });
  }

  function expectDetailClearance(cgv) {
    const sequence = cgv.sequence;
    const pixels = cgv.backbone.pixelsPerBp();
    const geometry = sequence.translation._layoutForScale(
      sequence.translation.scaleFactor(pixels), sequence.detailScaleFactor(pixels)
    );
    const along = cgv.tracks().find(track => track.position === 'along');
    const detailEdge = geometry.backboneEdgeOffset;
    const divider = cgv.dividers.track;
    if (along) {
      const slot = along.slots(1);
      expect(slot.bbOffset).toBeCloseTo(0);
      expect(slot.thickness / 2 - detailEdge).toBeGreaterThanOrEqual(5 - 1e-8);
      for (const edge of neighborEdges(cgv)) {
        expect(edge - slot.thickness / 2)
          .toBeCloseTo(2 * divider.adjustedSpacing + divider.adjustedThickness);
      }
    } else {
      for (const edge of neighborEdges(cgv)) {
        expect(edge - detailEdge).toBeGreaterThanOrEqual(divider.adjustedSpacing - 1e-8);
      }
    }
  }

  test.each([false, true])('reserves bases and translations with along=%s while keeping the backbone hidden', along => {
    const cgv = createViewer({along});
    for (const translationVisible of [false, true]) {
      cgv.sequence.translation.visible = translationVisible;
      zoomToDetail(cgv);
      expectDetailClearance(cgv);
      expect(cgv.backbone.visible).toBe(false);
      expect(cgv.backbone.adjustedThickness).toBe(0);
    }

    const drawElement = jest.spyOn(cgv.canvas, 'drawElement');
    cgv.backbone.draw();
    expect(drawElement).not.toHaveBeenCalled();
    expect(cgv.eventMonitor._getElement(undefined, 1000, cgv.backbone.adjustedCenterOffset, 0, 0).elementType)
      .not.toBe('backbone');
  });

  test('tracks the detail fade and reverses the expansion without leaving an overview gap', () => {
    const cgv = createViewer();
    zoomToDetail(cgv);
    const pixels = jest.spyOn(cgv.backbone, 'pixelsPerBp');
    const bases = jest.spyOn(cgv.sequence, '_drawBase');
    const edges = [];
    // All draws keep the same zoom, also exercising layout invalidation.
    for (const value of [0.5, 1.4, 1.6, 2, 4, 8, 12, 18, 12, 8, 4, 2, 1.6, 1.4, 0.5]) {
      pixels.mockReturnValue(value);
      bases.mockClear();
      cgv.drawFast();
      const edge = neighborEdges(cgv)[0];
      edges.push(edge);
      if (value <= 1.5) {
        expect(bases).not.toHaveBeenCalled();
        expect(edge).toBeCloseTo(cgv.dividers.track.adjustedSpacing);
      } else {
        expect(bases).toHaveBeenCalled();
        expectDetailClearance(cgv);
      }
    }
    expect(edges.slice(0, 7)).toEqual(edges.slice(8).reverse());
  });

  test.each([false, true])('updates same-zoom fonts, spacing, and visibility with along=%s', along => {
    const cgv = createViewer({along});
    zoomToDetail(cgv);
    const originalEdge = neighborEdges(cgv)[0];
    cgv.sequence.translation.update({font: 'monospace,plain,20', laneSpacing: 5, edgePadding: 7});
    // Translation updates promise synchronous layout, before the next draw.
    expect(neighborEdges(cgv)[0]).toBeGreaterThan(originalEdge);
    expectDetailClearance(cgv);

    cgv.sequence.update({font: 'sans-serif,plain,24'});
    cgv.drawFast();
    expectDetailClearance(cgv);

    cgv.sequence.translation.visible = false;
    cgv.drawFast();
    expectDetailClearance(cgv);

    cgv.sequence.visible = false;
    cgv.drawFast();
    const collapsedEdges = neighborEdges(cgv);
    if (along) {
      expect(cgv.tracks(1).slots(1).thickness).toBeCloseTo(cgv.settings.maxSlotThickness);
    } else {
      collapsedEdges.forEach(edge => expect(edge).toBeCloseTo(cgv.dividers.track.adjustedSpacing));
    }

    cgv.sequence.visible = true;
    cgv.sequence.translation.visible = true;
    cgv.drawFast();
    expectDetailClearance(cgv);
    neighborEdges(cgv).forEach((edge, index) => expect(edge).toBeGreaterThan(collapsedEdges[index]));
  });

  test('hiding an expanded backbone retains the space and showing it again paints the same geometry', () => {
    const cgv = createViewer({along: true});
    cgv.backbone.visible = true;
    zoomToDetail(cgv);
    const edges = neighborEdges(cgv);
    const alongThickness = cgv.tracks(1).slots(1).thickness;

    for (const visible of [false, true, false]) {
      cgv.backbone.visible = visible;
      cgv.drawFast();
      expect(neighborEdges(cgv)).toEqual(edges);
      expect(cgv.tracks(1).slots(1).thickness).toBe(alongThickness);
      expectDetailClearance(cgv);
    }
  });

  test.each(['drawFast', 'drawFull', 'drawExport'])('preserves clearance through %s', method => {
    const cgv = createViewer({along: true});
    cgv.tracks(1).update({separateFeaturesBy: 'strand'});
    zoomToDetail(cgv);
    cgv.layout[method]();
    while (cgv.layout.fullDrawInProgress) { jest.runOnlyPendingTimers(); }
    expectDetailClearance(cgv);
    expect(cgv.backbone.adjustedThickness).toBe(0);
  });

  test('reserves visible placeholder bases without reserving translation lanes', () => {
    const cgv = createViewer({sequence: {length: 3000}});
    zoomToDetail(cgv);
    expect(cgv.sequence.translation.thickness).toBe(0);
    expectDetailClearance(cgv);
  });
});
