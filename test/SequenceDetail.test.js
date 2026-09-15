import Viewer from '../src/Viewer';

describe('Sequence zoom detail', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="map"></div><div id="second-map"></div>';
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('uses horizontal base text by default and omits it from normal JSON', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'ATGC'}});

    expect(cgv.sequence.baseTextOrientation).toBe('horizontal');
    expect(cgv.sequence.toJSON()).not.toHaveProperty('baseTextOrientation');
    expect(cgv.sequence.toJSON({includeDefaults: true}).baseTextOrientation)
      .toBe('horizontal');
  });

  test('lets smaller bases match amino-acid height without changing their saved font', () => {
    const cgv = new Viewer('#map', {sequence: {
      seq: 'ATG'.repeat(100), font: 'sans-serif,plain,10', translation: {visible: true},
    }});
    const sequence = cgv.sequence;
    const translation = sequence.translation;
    const ctx = cgv.canvas.context('map');
    const baseWidth = sequence.bpSpacing - sequence.bpMargin;

    for (const size of [11, 13]) {
      translation.font = `monospace,bold,${size}`;
      const cell = sequence._baseCellGeometry(1, 100);
      const layout = translation._layoutForScale(1);
      expect(sequence._baseGlyphsForContext(ctx).fontSize).toBe(size);
      expect(sequence._baseDetailFont.family).toBe('sans-serif');
      expect(sequence._baseDetailFont.style).toBe('plain');
      expect(2 * cell.halfHeight + cell.borderWidth).toBe(layout.highlightHeight);
      expect(2 * sequence._baseRowCenterOffset - layout.highlightHeight).toBe(sequence.bpMargin);
      expect(sequence._baseRowCenterOffset + layout.highlightHeight / 2).toBeLessThan(sequence.baseThickness / 2);
      expect(sequence.detailScaleFactor(baseWidth)).toBe(1);
    }

    expect(sequence.font.string).toBe('sans-serif,plain,10');
    expect(sequence.toJSON().font).toBe('sans-serif,plain,10');
    translation.visible = false;
    expect(sequence._baseGlyphsForContext(ctx).fontSize).toBe(10);
    sequence.font = 'sans-serif,plain,16';
    translation.visible = true;
    expect(sequence._baseGlyphsForContext(ctx).fontSize).toBe(16);
  });

  test('draws curved circular bases on the readable local tangent', () => {
    const cgv = new Viewer('#map', {
      sequence: {seq: 'ATGC', baseTextOrientation: 'curved'},
    });
    const ctx = cgv.canvas.context('map');
    const pointForBp = jest.spyOn(cgv.canvas, 'pointForBp').mockReturnValue({x: 12, y: 34});
    const orientation = jest.spyOn(cgv.canvas, 'tangentialTextOrientationForBp')
      .mockReturnValue({angle: 0.4, flipped: false});

    cgv.sequence._drawBase(ctx, 'A', 2, 100, 5);

    expect(pointForBp).toHaveBeenCalledWith(2, 100);
    expect(orientation).toHaveBeenCalledWith(2);
    expect(ctx.translate).toHaveBeenLastCalledWith(12, 34);
    expect(ctx.rotate).toHaveBeenLastCalledWith(0.4);
    expect(ctx.fillText).toHaveBeenLastCalledWith('A', 0, 5);
  });

  test('keeps horizontal circular bases unrotated', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'ATGC'}});
    const ctx = cgv.canvas.context('map');
    jest.spyOn(cgv.canvas, 'pointForBp').mockReturnValue({x: 12, y: 34});
    const orientation = jest.spyOn(cgv.canvas, 'tangentialTextOrientationForBp');
    ctx.rotate.mockClear();
    ctx.fillText.mockClear();

    cgv.sequence._drawBase(ctx, 'A', 2, 100, 5);

    expect(orientation).toHaveBeenCalledWith(2);
    expect(ctx.rotate).not.toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenLastCalledWith('A', 12, 39);
  });

  test('falls back to horizontal text on linear maps', () => {
    const cgv = new Viewer('#map', {
      sequence: {seq: 'ATGC', baseTextOrientation: 'curved'},
    });
    cgv.format = 'linear';
    const ctx = cgv.canvas.context('map');
    jest.spyOn(cgv.canvas, 'pointForBp').mockReturnValue({x: 12, y: 34});
    const orientation = jest.spyOn(cgv.canvas, 'tangentialTextOrientationForBp');
    ctx.rotate.mockClear();
    ctx.fillText.mockClear();

    cgv.sequence._drawBase(ctx, 'A', 2, 100, 5);

    expect(orientation).not.toHaveBeenCalled();
    expect(ctx.rotate).not.toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenLastCalledWith('A', 12, 39);
  });

  test('reuses one calculated angle for paired sequence bases', () => {
    const cgv = new Viewer('#map', {
      sequence: {seq: 'ATGC', baseTextOrientation: 'curved'},
    });
    const ctx = cgv.canvas.context('map');
    jest.spyOn(cgv.canvas, 'pointForBp').mockReturnValue({x: 12, y: 34});
    const orientation = jest.spyOn(cgv.canvas, 'tangentialTextOrientationForBp');
    ctx.rotate.mockClear();

    const tangent = {angle: 0.4, flipped: false};
    cgv.sequence._drawBase(ctx, 'A', 2, 105, 5, tangent);
    cgv.sequence._drawBase(ctx, 'T', 2, 95, 5, tangent, -1);

    expect(orientation).not.toHaveBeenCalled();
    expect(ctx.rotate).toHaveBeenCalledTimes(2);
    expect(ctx.rotate).toHaveBeenLastCalledWith(0.4);
  });

  test('updates both settings and rejects unsupported values', () => {
    const cgv = new Viewer('#map', {
      sequence: {seq: 'ATGC'},
    });
    const listener = jest.fn();
    cgv.on('sequence-update.sequence-detail-test', listener);

    cgv.sequence.update({baseColorMode: 'byBase', baseTextOrientation: 'curved'});
    expect(cgv.sequence.baseColorMode).toBe('byBase');
    expect(cgv.sequence.baseTextOrientation).toBe('curved');
    expect(listener).toHaveBeenCalledWith({
      attributes: {baseColorMode: 'byBase', baseTextOrientation: 'curved'},
    });

    jest.spyOn(console, 'error').mockImplementation(() => {});
    cgv.sequence.update({baseColorMode: 'invalid', baseTextOrientation: 'invalid'});
    expect(cgv.sequence.baseColorMode).toBe('byBase');
    expect(cgv.sequence.baseTextOrientation).toBe('curved');
  });

  test('round trips curved base text orientation', () => {
    const firstViewer = new Viewer('#map', {
      sequence: {seq: 'ATGC', baseTextOrientation: 'curved'},
    });
    const json = firstViewer.io.toJSON();
    const secondViewer = new Viewer('#second-map');

    expect(json.cgview.sequence.baseTextOrientation).toBe('curved');
    secondViewer.io.loadJSON(json);
    expect(secondViewer.sequence.baseTextOrientation).toBe('curved');
  });

  test('never returns an upside-down tangential angle', () => {
    const cgv = new Viewer('#map', {sequence: {length: 360}});

    for (let bp = 1; bp <= 360; bp += 5) {
      const {angle} = cgv.canvas.tangentialTextOrientationForBp(bp);
      expect(angle).toBeGreaterThanOrEqual(-Math.PI / 2);
      expect(angle).toBeLessThanOrEqual(Math.PI / 2);
    }
  });

  test('adjoining nucleotide chevrons leave a 1 px gap on both linear strands', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'ATG'.repeat(100)}});
    cgv.format = 'linear';
    const sequence = cgv.sequence;
    const ctx = cgv.canvas.context('map');
    const cell = sequence._baseCellGeometry(1, 100);
    for (const strand of [1, -1]) {
      const edges = [];
      for (const bp of [10, 10 + strand]) {
        ctx.moveTo.mockClear();
        ctx.lineTo.mockClear();
        sequence._drawBase(ctx, 'A', bp, 100, 5, undefined, strand, cell);
        edges.push({head: ctx.lineTo.mock.calls.slice(0, 3),
          tail: [ctx.moveTo.mock.calls[0], ctx.lineTo.mock.calls[4], ctx.lineTo.mock.calls[3]]});
      }
      for (let i = 0; i < 3; i++) {
        const gap = (edges[1].tail[i][0] - edges[0].head[i][0]) * strand - cell.borderWidth;
        expect(gap).toBeCloseTo(1, 10);
        expect(edges[0].head[i][1]).toBeCloseTo(edges[1].tail[i][1], 10);
      }
      const origin = cgv.canvas.pointForBp(10, 100);
      expect((edges[0].head[1][0] - origin.x) * strand).toBeGreaterThan(0);
    }
    const translationCell = sequence.translation._cellGeometry(sequence.translation._layoutForScale(1), 100);
    expect(cell.tipLength / cell.halfHeight).toBeLessThan(translationCell.tipLength / translationCell.halfHeight);
  });

  test('leaves a 1 px gap between curved nucleotide boxes on short circular maps', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'ATG'.repeat(32)}});
    const sequence = cgv.sequence;
    const cell = sequence._baseCellGeometry(1, 100);
    const pointForBp = jest.spyOn(cgv.canvas, 'pointForBp');
    const ctx = cgv.canvas.context('map');
    expect(cell.curved).toBe(true);
    for (const strand of [1, -1]) {
      const boundaries = [];
      for (const bp of [20, 20 + strand]) {
        pointForBp.mockClear();
        ctx.arc.mockClear();
        sequence._drawBase(ctx, 'A', bp, 100, 5, undefined, strand, cell);
        boundaries.push({head: pointForBp.mock.calls[1], notch: pointForBp.mock.calls[3]});
        expect(ctx.arc).toHaveBeenCalledTimes(2);
      }
      const gap = (boundaries[1].notch[0] - boundaries[0].head[0]) * strand * cell.pixelsPerBp - cell.borderWidth;
      expect(gap).toBeCloseTo(1, 10);
      expect(boundaries[0].head[1]).toBe(boundaries[1].notch[1]);
    }
  });
});
