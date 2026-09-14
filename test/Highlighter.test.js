import Viewer from '../src/Viewer';

describe('Highlighter', () => {

  let cgv;

  beforeEach(() => {
    document.body.innerHTML = '<div id="map"></div>';
    cgv = new Viewer('#map');
    cgv.highlighter.feature.popovers = false;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('shows amino-acid, codon, range, signed frame, status, and genetic-code details', () => {
    cgv = new Viewer('#map', {sequence: {seq: 'ATGAAATAACCC', translation: {visible: true}}});
    jest.spyOn(cgv.backbone, 'pixelsPerBp').mockReturnValue(20);
    const translation = cgv.sequence.translation;
    const lane = translation._layoutForScale(1).firstLaneCenterOffset;
    const draw = jest.spyOn(cgv, 'draw');
    const drawFast = jest.spyOn(cgv, 'drawFast');
    for (const [bp, strand, title, codon, position, status] of [
      [2, 1, 'M (Methionine)', 'ATG', '1–3', 'Start codon'],
      [5, 1, 'K (Lysine)', 'AAA', '4–6', undefined],
      [8, 1, '* (Stop)', 'TAA', '7–9', 'Stop codon'],
      [2, -1, 'H (Histidine)', 'CAT', '1–3', undefined],
    ]) {
      const element = translation.hitTest(bp, cgv.backbone.adjustedCenterOffset + strand * lane);
      cgv.highlighter.mouseOver({elementType: 'translation', element, canvasX: 10, canvasY: 10});
      const text = cgv.highlighter.popoverBox.text();
      expect(text).toContain(title);
      expect(text).toContain(`Codon: ${codon}`);
      expect(text).toContain(`Position: ${position} bp`);
      expect(text).toContain(`Frame: ${strand === 1 ? '+1' : '-1'}`);
      expect(text).toContain('Genetic code: 11 (Bacterial and Plant Plastid)');
      if (status) { expect(text).toContain(`Status: ${status}`); }
      else { expect(text).not.toContain('Status:'); }
      expect(cgv.highlighter.popoverBox.style('visibility')).toBe('visible');
    }
    expect(draw).not.toHaveBeenCalled();
    expect(drawFast).not.toHaveBeenCalled();
  });

  test('supports custom translation popovers and independent visibility controls', () => {
    const popoverContents = jest.fn(() => '<div>Custom translation</div>');
    cgv = new Viewer('#map', {highlighter: {translation: {popoverContents}}});
    const highlighter = cgv.highlighter;
    const event = {elementType: 'translation', element: {codon: 'ATG'}, canvasX: 10, canvasY: 10};
    expect(highlighter.translation.highlighting).toBe(false);
    highlighter.mouseOver(event);
    expect(popoverContents).toHaveBeenCalledWith(event);
    expect(highlighter.popoverBox.text()).toBe('Custom translation');
    highlighter.translation.popovers = false;
    highlighter.mouseOver(event);
    expect(highlighter.popoverBox.style('visibility')).toBe('hidden');
    highlighter.translation.popovers = true;
    highlighter.visible = false;
    highlighter.mouseOver(event);
    expect(highlighter.popoverBox.style('visibility')).toBe('hidden');
  });

  test('displays unrecognized codon characters as text', () => {
    cgv = new Viewer('#map', {sequence: {seq: '<G>', translation: {visible: true}}});
    jest.spyOn(cgv.backbone, 'pixelsPerBp').mockReturnValue(20);
    const translation = cgv.sequence.translation;
    const offset = cgv.backbone.adjustedCenterOffset + translation._layoutForScale(1).firstLaneCenterOffset;
    const element = translation.hitTest(2, offset);
    cgv.highlighter.mouseOver({elementType: 'translation', element, canvasX: 10, canvasY: 10});
    expect(cgv.highlighter.popoverBox.text()).toContain('X (Unknown)');
    expect(cgv.highlighter.popoverBox.text()).toContain('Codon: <G>');
    expect(cgv.highlighter.popoverBox.node().querySelector('g')).toBeNull();
  });

  test('keeps visible legends and captions above feature highlights', () => {
    cgv.legend.addItems({name: 'Feature'});
    cgv.legend.refresh();
    const caption = cgv.addCaptions({name: 'Map title'})[0];
    const feature = {highlight: jest.fn()};
    const ctx = cgv.canvas.context('ui');
    const clearRect = jest.spyOn(ctx, 'clearRect');

    cgv.highlighter.mouseOver({
      elementType: 'feature',
      element: feature,
      slot: undefined,
    });

    const legendBox = cgv.legend.box;
    const captionBox = caption.box;
    expect(feature.highlight).toHaveBeenCalledTimes(1);
    expect(clearRect).toHaveBeenCalledWith(
      legendBox.x - 1,
      legendBox.y - 1,
      legendBox.width + 2,
      legendBox.height + 2,
    );
    expect(clearRect).toHaveBeenCalledWith(
      captionBox.x - 1,
      captionBox.y - 1,
      captionBox.width + 2,
      captionBox.height + 2,
    );
  });

  test('does not clear space for hidden overlays', () => {
    cgv.legend.visible = false;
    const caption = cgv.addCaptions({name: 'Hidden', visible: false})[0];
    const ctx = cgv.canvas.context('ui');
    const clearRect = jest.spyOn(ctx, 'clearRect');

    cgv.highlighter.mouseOver({
      elementType: 'feature',
      element: {highlight: jest.fn()},
      slot: undefined,
    });

    expect(clearRect).not.toHaveBeenCalledWith(
      cgv.legend.box.x - 1,
      cgv.legend.box.y - 1,
      cgv.legend.box.width + 2,
      cgv.legend.box.height + 2,
    );
    expect(clearRect).not.toHaveBeenCalledWith(
      caption.box.x - 1,
      caption.box.y - 1,
      caption.box.width + 2,
      caption.box.height + 2,
    );
  });

});
