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
