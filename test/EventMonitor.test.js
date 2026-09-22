import Viewer from '../src/Viewer';

describe('EventMonitor', () => {

  let cgv;

  beforeEach(() => {
    document.body.innerHTML = '<div id="map"></div>';
    cgv = new Viewer('#map');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('track label events', () => {
    beforeEach(() => {
      cgv = new Viewer('#map', {
        width: 800,
        height: 600,
        sequence: {length: 1000},
        features: [
          {name: 'Forward', source: 'genes', start: 1, stop: 1000},
          {name: 'Reverse', source: 'genes', start: 1, stop: 1000, strand: -1},
        ],
      });
      cgv.addPlots({name: 'Coverage', source: 'coverage', positions: [1], scores: [0.5]});
      cgv.addTracks([
        {name: 'Genes', dataType: 'feature', dataMethod: 'source', dataKeys: 'genes', position: 'around', separateFeaturesBy: 'strand'},
        {name: 'Coverage', dataType: 'plot', dataMethod: 'source', dataKeys: 'coverage', position: 'inside'},
      ]);
      cgv.legend.visible = false;
    });

    function zoomedPlans(format, zoom = 8) {
      cgv.format = format;
      cgv.layout.zoom(zoom, 500);
      cgv.layout.updateLayout(true);
      return cgv.layout._trackLabelRenderer.plans();
    }

    function eventAt(point) {
      return cgv.eventMonitor._createEvent({offsetX: point.x, offsetY: point.y});
    }

    test.each(['circular', 'linear'])('reports the track and exact slot on click and hover events in %s maps', (format) => {
      const plans = zoomedPlans(format);
      expect(plans).toHaveLength(3);
      for (const type of ['mousemove', 'click']) {
        const listener = jest.fn();
        cgv.on(`${type}.track-label-test`, listener);
        for (const plan of plans) {
          const point = cgv.canvas.pointForBp(plan.bp, plan.centerOffset);
          const mouseEvent = new MouseEvent(type, {view: window});
          Object.defineProperties(mouseEvent, {
            offsetX: {value: point.x},
            offsetY: {value: point.y},
          });
          cgv.canvas.node('ui').dispatchEvent(mouseEvent);
          expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({
            elementType: 'trackLabel', element: plan.track, slot: plan.slot, d3: mouseEvent,
          }));
        }
        expect(listener).toHaveBeenCalledTimes(plans.length);
      }
    });

    test.each(['circular', 'linear'])('keeps features and plots interactive outside the label bounds in %s maps', (format) => {
      const plans = zoomedPlans(format);
      expect(plans).toHaveLength(3);
      for (const plan of plans) {
        const pixelsPerBp = cgv.canvas.pixelsPerBp(plan.centerOffset);
        const beside = cgv.canvas.pointForBp(plan.bp + (plan.totalWidth / 2 + 4) / pixelsPerBp, plan.centerOffset);
        const above = cgv.canvas.pointForBp(plan.bp, plan.centerOffset + 9);
        for (const point of [beside, above]) {
          const event = eventAt(point);
          expect(event.elementType).toBe(plan.track.type);
          expect(event.slot).toBe(plan.slot);
          expect(event.element).toBe(plan.track.type === 'plot' ? plan.slot._plot : plan.slot.features().first);
        }
      }
    });

    test.each(['circular', 'linear'])('preserves fractional label positions at high zoom in %s maps', (format) => {
      const [plan] = zoomedPlans(format, 100);
      expect(plan.totalWidth / cgv.canvas.pixelsPerBp(plan.centerOffset)).toBeLessThan(1);
      const point = cgv.canvas.pointForBp(plan.bp, plan.centerOffset);
      expect(eventAt(point)).toEqual(expect.objectContaining({elementType: 'trackLabel', element: plan.track}));
    });

    test('does not intercept map events when labels are disabled or tracks are hidden, unnamed, or removed', () => {
      const [plan] = zoomedPlans('linear');
      const point = cgv.canvas.pointForBp(plan.bp, plan.centerOffset);
      expect(eventAt(point).elementType).toBe('trackLabel');

      cgv.settings.showTrackLabels = false;
      expect(eventAt(point).elementType).toBe('feature');
      cgv.settings.showTrackLabels = true;
      plan.track.name = '';
      expect(eventAt(point).elementType).toBe('feature');
      plan.track.name = 'Genes';
      plan.track.visible = false;
      expect(eventAt(point).elementType).not.toBe('trackLabel');
      plan.track.visible = true;
      plan.track.remove();
      expect(eventAt(point).elementType).not.toBe('trackLabel');
    });

    test('keeps legends and captions ahead of overlapping track labels', () => {
      const [plan] = zoomedPlans('linear');
      const point = cgv.canvas.pointForBp(plan.bp, plan.centerOffset);
      const caption = cgv.addCaptions({name: 'Caption'})[0];
      jest.spyOn(caption.box, 'containsPt').mockReturnValue(true);
      expect(eventAt(point)).toEqual(expect.objectContaining({elementType: 'caption', element: caption}));

      cgv.legend.visible = true;
      const item = cgv.legend.items().first;
      jest.spyOn(cgv.legend.box, 'containsPt').mockReturnValue(true);
      jest.spyOn(item, '_textContainsPoint').mockReturnValue(true);
      expect(eventAt(point)).toEqual(expect.objectContaining({elementType: 'legendItem', element: item}));
    });
  });

  test.each(['circular', 'linear'])('prefers visible translation lanes and keeps the DNA backbone fallback in %s maps', (format) => {
    cgv = new Viewer('#map', {sequence: {seq: 'ATGAAATAACCC', translation: {visible: true}}});
    cgv.format = format;
    jest.spyOn(cgv.backbone, 'pixelsPerBp').mockReturnValue(20);
    const center = cgv.backbone.adjustedCenterOffset;
    const lane = cgv.sequence.translation._layoutForScale(1).firstLaneCenterOffset;
    for (const strand of [1, -1]) {
      const point = cgv.canvas.pointForBp(2, center + strand * lane);
      const event = cgv.eventMonitor._createEvent({offsetX: point.x, offsetY: point.y});
      expect(event.elementType).toBe('translation');
      expect(event.element).toEqual(expect.objectContaining({
        codon: strand === 1 ? 'ATG' : 'CAT', signedFrame: strand,
      }));
    }
    const point = cgv.canvas.pointForBp(2, center);
    expect(cgv.eventMonitor._createEvent({offsetX: point.x, offsetY: point.y}).elementType).toBe('backbone');
    cgv.sequence.translation.visible = false;
    expect(cgv.eventMonitor._getElement(undefined, 2, cgv.backbone.adjustedCenterOffset, 0, 0))
      .toEqual({elementType: 'backbone', element: cgv.backbone});
  });

  test('retains the contig popover outside translation lanes on assembled maps', () => {
    cgv = new Viewer('#map', {sequence: {
      contigs: [{seq: 'ATGAAA'}, {seq: 'TAACCC'}], translation: {visible: true},
    }});
    expect(cgv.eventMonitor._getElement(undefined, 8, cgv.backbone.adjustedCenterOffset, 0, 0))
      .toEqual({elementType: 'contig', element: cgv.contigs(2)});
  });

  test('keeps features and captions ahead of translation hit testing', () => {
    const hitTest = jest.spyOn(cgv.sequence.translation, 'hitTest').mockReturnValue({codon: 'ATG'});
    const feature = {visible: true, fullLength: 3};
    const slot = {findFeaturesForBp: () => [feature]};
    expect(cgv.eventMonitor._getElement(slot, 2, 100, 0, 0))
      .toEqual({elementType: 'feature', element: feature});
    const caption = cgv.addCaptions({name: 'Caption'})[0];
    jest.spyOn(caption.box, 'containsPt').mockReturnValue(true);
    expect(cgv.eventMonitor._getElement(undefined, 2, 100, 0, 0))
      .toEqual({elementType: 'caption', element: caption});
    expect(hitTest).not.toHaveBeenCalled();
  });

  test('clears transient hover state when the pointer leaves the viewer', () => {
    const listener = jest.fn();
    const uiCanvas = cgv.canvas.node('ui');
    cgv.on('mouseleave.test', listener);
    cgv.eventMonitor._mouse = {elementType: 'feature'};
    cgv.highlighter.showPopoverBox({
      html: 'Feature popover',
      position: {x: 10, y: 10}
    });
    cgv.clear = jest.fn();

    uiCanvas.dispatchEvent(new MouseEvent('mouseleave'));

    expect(cgv.mouse).toBeUndefined();
    expect(cgv.clear).toHaveBeenCalledWith('ui');
    expect(cgv.highlighter.popoverBox.style('visibility')).toBe('hidden');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('clears a highlighted legend swatch when the pointer leaves the viewer', () => {
    const legendItem = cgv.legend.addItems({name: 'Feature'})[0];
    legendItem.swatchHighlighted = true;
    cgv.canvas.cursor = 'pointer';
    cgv.legend.draw = jest.fn();

    cgv.canvas.node('ui').dispatchEvent(new MouseEvent('mouseleave'));

    expect(cgv.legend.highlightedSwatchedItem).toBeUndefined();
    expect(cgv.canvas.cursor).toBe('auto');
    expect(cgv.legend.draw).toHaveBeenCalledTimes(1);
  });

});
