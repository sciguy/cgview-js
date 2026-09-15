import Viewer from '../src/Viewer';
import CGRange from '../src/CGRange';

describe('SequenceTranslation', () => {

  beforeEach(() => {
    document.body.innerHTML = '<div id="map"></div>';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('is visible by default and preserves an explicit hidden setting', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'ATGAAATAACCC'}});
    const baseThickness = cgv.sequence.baseThickness;

    expect(cgv.sequence.translation.visible).toBe(true);
    expect(cgv.sequence.thickness).toBeGreaterThan(baseThickness);
    expect(cgv.sequence.toJSON().translation.visible).toBe(true);
    expect(cgv.sequence.toJSON({includeDefaults: true}).translation.visible).toBe(true);

    cgv.sequence.translation.color = 'navy';
    expect(cgv.sequence.toJSON().translation.color).toBe('rgba(0,0,128,1)');
    cgv.sequence.translation.visible = false;
    expect(cgv.sequence.thickness).toBe(baseThickness);
    const json = cgv.io.toJSON();
    expect(json.cgview.sequence.translation.visible).toBe(false);
    cgv.io.loadJSON(json);
    expect(cgv.sequence.translation.visible).toBe(false);
  });

  test('batches size-affecting updates into one synchronous layout refresh', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'ATGAAATAACCC'}});
    const translation = cgv.sequence.translation;
    const refreshThickness = jest.spyOn(cgv.backbone, 'refreshThickness');
    const adjustProportions = jest.spyOn(cgv.layout, '_adjustProportions');

    translation.update({
      visible: true,
      font: 'monospace,bold,13',
      laneSpacing: 3,
      edgePadding: 7,
    });

    expect(refreshThickness).toHaveBeenCalledTimes(1);
    expect(adjustProportions).toHaveBeenCalledTimes(1);
    expect(adjustProportions).toHaveBeenCalledWith({duration: 0});
    expect(refreshThickness.mock.invocationCallOrder[0])
      .toBeLessThan(adjustProportions.mock.invocationCallOrder[0]);
  });

  test('does not recalculate layout for translation style-only updates', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'ATGAAATAACCC'}});
    const adjustProportions = jest.spyOn(cgv.layout, '_adjustProportions');

    cgv.sequence.translation.update({
      color: 'navy',
      startColor: 'green',
      highlightStopCodons: false,
    });

    expect(adjustProportions).not.toHaveBeenCalled();
  });

  test('refreshes layout for direct visibility changes', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'ATGAAATAACCC', translation: {visible: false}}});
    const adjustProportions = jest.spyOn(cgv.layout, '_adjustProportions');

    cgv.sequence.translation.visible = true;

    expect(adjustProportions).toHaveBeenCalledTimes(1);
    expect(adjustProportions).toHaveBeenCalledWith({duration: 0});
  });

  test('does not recalculate layout when translation has zero thickness at the current zoom', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'A'.repeat(1000), translation: {visible: false}}});
    jest.spyOn(cgv.backbone, 'pixelsPerBp').mockReturnValue(0.5);
    const refreshThickness = jest.spyOn(cgv.backbone, 'refreshThickness');
    const adjustProportions = jest.spyOn(cgv.layout, '_adjustProportions');
    const previousThickness = cgv.backbone.adjustedThickness;

    cgv.sequence.translation.update({visible: true});

    expect(refreshThickness).toHaveBeenCalledTimes(1);
    expect(cgv.backbone.adjustedThickness).toBe(previousThickness);
    expect(adjustProportions).not.toHaveBeenCalled();
  });

  test('forces slot layout when a draw changes backbone detail thickness', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'ATGAAATAACCC'}});
    const updateLayout = jest.spyOn(cgv.layout, 'updateLayout');
    jest.spyOn(cgv.backbone, 'refreshThickness').mockImplementation(() => {
      cgv.backbone._bpThicknessAddition += 10;
    });

    cgv.layout.drawMapWithoutSlots(true);

    expect(updateLayout).toHaveBeenCalledWith(true);
  });

  test('uses exact lane spacing and explicit translation-edge clearance', () => {
    const cgv = new Viewer('#map', {
      sequence: {seq: 'ATGAAATAACCC', translation: {visible: true, laneSpacing: 2, edgePadding: 6}},
    });
    const translation = cgv.sequence.translation;
    for (const scaleFactor of [1, 0.5]) {
      const layout = translation._layoutForScale(scaleFactor);
      const firstInnerEdge = layout.firstLaneCenterOffset - (layout.laneHeight / 2);
      const trailingEdgeGap = layout.backboneEdgeOffset - layout.outerLaneEdgeOffset;

      expect(firstInnerEdge - (cgv.sequence.baseThickness * scaleFactor / 2)).toBeCloseTo(layout.edgePadding);
      expect(layout.laneStep - layout.laneHeight).toBeCloseTo(layout.laneSpacing);
      expect(trailingEdgeGap).toBeCloseTo(layout.edgePadding);
      expect((layout.laneHeight - layout.highlightHeight) / 2).toBeCloseTo(scaleFactor);
      expect((layout.highlightHeight - (translation.font.height * scaleFactor)) / 2)
        .toBeCloseTo(2.5 * scaleFactor);
      expect(
        ((layout.highlightHeight - (translation.font.height * scaleFactor)) / 2) -
        layout.highlightBorderWidth
      ).toBeCloseTo(1.5 * scaleFactor);
      expect(layout.highlightBorderWidth).toBeCloseTo(scaleFactor);
    }
    expect(translation.strandThickness).toBe(
      (3 * translation.laneHeight) + (2 * translation.laneSpacing) + (2 * translation.edgePadding)
    );
    expect(translation.thickness).toBe(2 * translation.strandThickness);
  });



  test('translates all direct frames from the map origin', () => {
    const cgv = new Viewer('#map', {
      sequence: {seq: 'ATGAAATAACCC', translation: {visible: true}},
      settings: {geneticCode: 11},
    });
    const translation = cgv.sequence.translation;
    const contig = cgv.contigs(1);
    const range = new CGRange(cgv.sequence.mapContig, 1, cgv.sequence.length);
    const table = cgv.codonTables.byID(11);

    expect(translation.codonsForRange(contig, range, 1, 1, table).map(c => c.aminoAcid)).toEqual(['M', 'K', '*', 'P']);
    expect(translation.codonsForRange(contig, range, 1, 2, table).map(c => c.start)).toEqual([2, 5, 8]);
    expect(translation.codonsForRange(contig, range, 1, 3, table).map(c => c.start)).toEqual([3, 6, 9]);
  });

  test('anchors reverse frames at the end of each contig', () => {
    const cgv = new Viewer('#map', {
      sequence: {seq: 'ATGAAATAACCC', translation: {visible: true}},
    });
    const translation = cgv.sequence.translation;
    const contig = cgv.contigs(1);
    const range = new CGRange(cgv.sequence.mapContig, 1, cgv.sequence.length);
    const table = cgv.codonTables.byID(11);

    expect(translation.codonsForRange(contig, range, -1, 1, table).map(c => c.start)).toEqual([1, 4, 7, 10]);
    expect(translation.codonsForRange(contig, range, -1, 2, table).map(c => c.start)).toEqual([3, 6, 9]);
    expect(translation.codonsForRange(contig, range, -1, 3, table).map(c => c.start)).toEqual([2, 5, 8]);
    expect(translation.codonsForRange(contig, range, -1, 1, table).map(c => c.aminoAcid)).toEqual(['H', 'F', 'L', 'G']);
  });



  test('does not translate across contig boundaries', () => {
    const cgv = new Viewer('#map', {
      sequence: {
        contigs: [{name: 'one', seq: 'ATGAA'}, {name: 'two', seq: 'TAACC'}],
        translation: {visible: true},
      },
    });
    const translation = cgv.sequence.translation;
    const range = new CGRange(cgv.sequence.mapContig, 1, cgv.sequence.length);
    const table = cgv.codonTables.byID(11);
    const codons = cgv.contigs().flatMap(contig => translation.codonsForRange(contig, range, 1, 1, table));

    expect(codons.map(c => c.start)).toEqual([1, 6]);
    expect(codons.map(c => c.codon)).toEqual(['ATG', 'TAA']);
  });

  test('draws complete codons at both sides of a wrapped visible range', () => {
    const cgv = new Viewer('#map', {
      sequence: {seq: 'ATGAAATAACCC', translation: {visible: true}},
    });
    const range = new CGRange(cgv.sequence.mapContig, 11, 6);
    const table = cgv.codonTables.byID(11);
    const codons = cgv.sequence.translation.codonsForRange(cgv.contigs(1), range, 1, 1, table);

    expect(codons.map(c => c.start)).toEqual([10, 1, 4]);
  });

  test('uses and reports the viewer genetic code and survives JSON export', () => {
    const cgv = new Viewer('#map', {
      sequence: {seq: 'ATGTGA', translation: {visible: true}},
      settings: {geneticCode: 2},
    });
    const translation = cgv.sequence.translation;
    const range = new CGRange(cgv.sequence.mapContig, 1, cgv.sequence.length);
    const table = cgv.codonTables.byID(cgv.geneticCode);

    expect(translation.geneticCode).toBe(2);
    expect(translation.geneticCodeName).toBe('Vertebrate Mitochondrial');
    expect(translation.codonsForRange(cgv.contigs(1), range, 1, 1, table).map(c => c.aminoAcid)).toEqual(['M', 'W']);
    expect(cgv.io.toJSON().cgview.sequence.translation.visible).toBe(true);
    expect(cgv.io.toJSON().cgview.settings.geneticCode).toBe(2);
  });

  test('shares text and borders across codons while highlighting start and stop fills', () => {
    const cgv = new Viewer('#map', {
      sequence: {
        seq: 'ATGTAACCC',
        translation: {
          visible: true,
          color: '#123456',
          borderColor: '#777777',
          startColor: '#d1fae5',
          stopColor: '#fee2e2',
        },
      },
    });
    const translation = cgv.sequence.translation;
    const range = new CGRange(cgv.sequence.mapContig, 1, cgv.sequence.length);
    const codons = translation.codonsForRange(cgv.contigs(1), range, 1, 1, cgv.codonTables.byID(11));
    const pointForBp = jest.spyOn(cgv.canvas, 'pointForBp').mockReturnValue({x: 12, y: 34});
    const ctx = cgv.canvas.context('map');
    const fills = [];
    const borders = [];
    const textColors = [];
    jest.spyOn(ctx, 'fill').mockImplementation(() => fills.push(ctx.fillStyle));
    jest.spyOn(ctx, 'stroke').mockImplementation(() => borders.push({color: ctx.strokeStyle, width: ctx.lineWidth}));
    const fillText = jest.spyOn(ctx, 'fillText').mockImplementation(() => textColors.push(ctx.fillStyle));
    const rotate = jest.spyOn(ctx, 'rotate');
    const layout = translation._layoutForScale(0.6);
    const draw = codon => translation._drawCodon(codon.start, codon.aminoAcid, codon.isStart, codon.isStop, 100, layout);
    draw(codons[0]);
    expect(fills.at(-1)).toBe('#d1fae5');
    expect(borders.at(-1)).toEqual({color: '#777777', width: 0.6});
    expect(pointForBp).toHaveBeenCalledWith(codons[0].start + 1, 100);
    expect(ctx.translate).toHaveBeenLastCalledWith(12, 34);
    expect(rotate).toHaveBeenCalled();
    expect(fillText).toHaveBeenLastCalledWith(codons[0].aminoAcid, 0, -0.6);
    draw(codons[1]);
    expect(fills.at(-1)).toBe('#fee2e2');
    draw(codons[2]);
    expect(fills.at(-1)).toBe('#e5e7eb');
    expect(borders).toEqual(Array(3).fill({color: '#777777', width: 0.6}));
    expect(textColors).toEqual(Array(3).fill('#123456'));

    const glyphCache = {draw: jest.fn()};
    for (const codon of codons) {
      translation._drawCodon(codon.start, codon.aminoAcid, codon.isStart, codon.isStop,
        100, layout, 1, undefined, glyphCache);
      expect(glyphCache.draw).toHaveBeenLastCalledWith(ctx, codon.aminoAcid, 'rgba(18,52,86,1)', 0, -0.6, 0.6);
    }

    translation.update({highlightStartCodons: false, highlightStopCodons: false});
    for (const codon of codons) { draw(codon); }
    expect(fills.slice(-3)).toEqual(['#e5e7eb', '#e5e7eb', '#e5e7eb']);
    expect(borders.slice(-3).every(border => border.color === '#777777')).toBe(true);
    expect(textColors.slice(-3)).toEqual(Array(3).fill('#123456'));

    const circularRotateCount = rotate.mock.calls.length;
    cgv.format = 'linear';
    draw(codons[0]);
    expect(rotate).toHaveBeenCalledTimes(circularRotateCount);
    expect(fillText).toHaveBeenLastCalledWith(codons[0].aminoAcid, 12, 33.4);
  });

  test('streams only visible codons during drawing instead of building frame arrays', () => {
    const cgv = new Viewer('#map', {
      sequence: {seq: 'ATG'.repeat(100000), translation: {visible: true}},
    });
    const translation = cgv.sequence.translation;
    const visibleRange = new CGRange(cgv.sequence.mapContig, 150001, 150090);
    const materializeCodons = jest.spyOn(translation, 'codonsForRange');
    const visitCodons = jest.spyOn(translation, '_forEachCodon');
    const drawCodon = jest.spyOn(translation, '_drawCodon');
    const geometry = jest.spyOn(translation, '_cellGeometry');
    const ctx = cgv.canvas.context('map');
    ctx.fill.mockClear();
    ctx.stroke.mockClear();

    translation.draw(visibleRange, 100, 20);

    expect(materializeCodons).not.toHaveBeenCalled();
    expect(visitCodons).toHaveBeenCalledTimes(6);
    expect(geometry).toHaveBeenCalledTimes(6);
    expect(drawCodon.mock.calls.length).toBeGreaterThan(0);
    expect(drawCodon.mock.calls.length).toBeLessThanOrEqual(2 * (visibleRange.length + 4));
    expect(ctx.fill).toHaveBeenCalledTimes(drawCodon.mock.calls.length);
    expect(ctx.stroke).toHaveBeenCalledTimes(drawCodon.mock.calls.length);
  });

  test('points each cell along its strand in every circular quadrant without reversing glyphs', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'ATG'.repeat(1000)}});
    const translation = cgv.sequence.translation;
    const ctx = cgv.canvas.context('map');
    const layout = translation._layoutForScale(1);
    const radius = 5000;
    expect(translation._cellGeometry(layout, radius).curved).toBe(false);
    for (const start of [100, 850, 1600, 2350]) {
      for (const strand of [1, -1]) {
        ctx.lineTo.mockClear();
        ctx.rotate.mockClear();
        translation._drawCodon(start, 'K', false, false, radius, layout, strand);
        const [tipX, tipY] = ctx.lineTo.mock.calls[1];
        const angle = ctx.rotate.mock.calls[0][0];
        const origin = cgv.canvas.pointForBp(start + 1, radius);
        const ahead = cgv.canvas.pointForBp(start + 1 + strand * 0.1, radius);
        const dx = tipX * Math.cos(angle) - tipY * Math.sin(angle);
        const dy = tipX * Math.sin(angle) + tipY * Math.cos(angle);
        expect(dx * (ahead.x - origin.x) + dy * (ahead.y - origin.y)).toBeGreaterThan(0);
        expect(Math.abs(angle)).toBeLessThanOrEqual(Math.PI / 2);
      }
    }
  });

  test('draws opposite chevrons on linear strands inside each three-base cell', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'ATG'.repeat(100)}});
    cgv.format = 'linear';
    const translation = cgv.sequence.translation;
    const ctx = cgv.canvas.context('map');
    const layout = translation._layoutForScale(1);
    const origin = cgv.canvas.pointForBp(11, 100);
    const lower = cgv.canvas.pointForBp(9.5, 100).x;
    const upper = cgv.canvas.pointForBp(12.5, 100).x;
    for (const strand of [1, -1]) {
      ctx.lineTo.mockClear();
      ctx.rotate.mockClear();
      translation._drawCodon(10, 'K', false, false, 100, layout, strand);
      const [tipX, tipY] = ctx.lineTo.mock.calls[1];
      const [notchX] = ctx.lineTo.mock.calls[4];
      expect((tipX - origin.x) * strand).toBeGreaterThan(0);
      expect((notchX - origin.x) * strand).toBeLessThan(0);
      expect(tipY).toBe(origin.y);
      for (const [x] of ctx.lineTo.mock.calls) {
        expect(x).toBeGreaterThan(lower);
        expect(x).toBeLessThan(upper);
      }
      expect(ctx.rotate).not.toHaveBeenCalled();
    }
  });

  test('retains curved cell edges for short circular maps on both strands', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'ATG'.repeat(20)}});
    const translation = cgv.sequence.translation;
    const ctx = cgv.canvas.context('map');
    const layout = translation._layoutForScale(1);
    const cell = translation._cellGeometry(layout, 100);
    const curve = jest.spyOn(translation, '_traceCurvedCell');
    const straight = jest.spyOn(translation, '_traceCell');
    const path = jest.spyOn(cgv.canvas, 'path');
    expect(cell.curved).toBe(true);
    for (const strand of [1, -1]) {
      ctx.arc.mockClear();
      path.mockClear();
      translation._drawCodon(10, 'K', false, false, 100, layout, strand, cell);
      expect(ctx.arc).toHaveBeenCalledTimes(2);
      expect(path.mock.calls[0][4]).toBe(strand === -1);
      expect(path.mock.calls[1][4]).toBe(strand === 1);
    }
    expect(curve).toHaveBeenCalledTimes(2);
    expect(straight).not.toHaveBeenCalled();
  });

  test('grows continuously from zero and reverses without retained animation state', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'ATG'.repeat(100), translation: {visible: true}}});
    const translation = cgv.sequence.translation;
    const baseWidth = cgv.sequence.bpSpacing - cgv.sequence.bpMargin;
    const scaleAt = fraction => translation.scaleFactor(baseWidth * fraction);

    expect(scaleAt(0.25)).toBe(0);
    expect(scaleAt(0.25001)).toBeGreaterThan(0);
    expect(scaleAt(0.25001)).toBeLessThan(0.000001);
    expect(scaleAt(0.50001) - scaleAt(0.49999)).toBeLessThan(0.0001);
    const forward = [0.25, 0.4, 0.5, 0.7, 0.9, 1].map(scaleAt);
    expect(forward).toEqual([...forward].sort((a, b) => a - b));
    expect(forward[2]).toBeGreaterThan(0);
    expect(forward[2]).toBeLessThan(0.5);
    expect(forward[5]).toBe(1);
    expect([1, 0.9, 0.7, 0.5, 0.4, 0.25].map(scaleAt)).toEqual(forward.reverse());
    expect(scaleAt(2)).toBe(1);
    expect(translation.scaleFactor(NaN)).toBe(0);
  });

  test('fades all drawing operations to full opacity at half size and restores canvas state', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'ATGTAACCC', translation: {visible: true}}});
    const translation = cgv.sequence.translation;
    const range = new CGRange(cgv.sequence.mapContig, 1, 9);
    const ctx = cgv.canvas.context('map');
    const opacities = [];
    const fonts = [];
    ctx.globalAlpha = 0.8;
    jest.spyOn(ctx, 'fill').mockImplementation(() => opacities.push(ctx.globalAlpha));
    jest.spyOn(ctx, 'stroke').mockImplementation(() => opacities.push(ctx.globalAlpha));
    jest.spyOn(ctx, 'fillText').mockImplementation(() => {
      opacities.push(ctx.globalAlpha);
      fonts.push(ctx.font);
    });
    jest.spyOn(ctx, 'drawImage').mockImplementation(() => {
      opacities.push(ctx.globalAlpha);
      fonts.push(ctx.font);
    });

    // These zoom levels produce small, half-size, and full-size translations.
    for (const pixelsPerBp of [4.5, 7.5, 12]) {
      opacities.length = 0;
      fonts.length = 0;
      translation.draw(range, 100, pixelsPerBp);

      expect(opacities.length).toBeGreaterThan(6);
      expect(opacities.every(opacity => opacity === opacities[0])).toBe(true);
      if (pixelsPerBp === 4.5) {
        expect(opacities[0]).toBeGreaterThan(0.8 * translation.scaleFactor(pixelsPerBp));
        expect(opacities[0]).toBeLessThan(0.8);
      } else {
        expect(opacities[0]).toBe(0.8);
      }
      if (pixelsPerBp === 7.5) {
        expect(translation.scaleFactor(pixelsPerBp)).toBe(0.5);
        expect(fonts.length).toBeGreaterThan(0);
        for (const font of fonts) {
          expect(Number(font.match(/([\d.]+)px/)[1])).toBe(translation.font.size / 2);
        }
      }
      expect(ctx.globalAlpha).toBe(0.8);
    }
  });

  test('does no codon or range work for hidden, distant, or length-only sequence', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'ATG'.repeat(100), translation: {visible: false}}});
    const translation = cgv.sequence.translation;
    const contigs = jest.spyOn(cgv.sequence, 'contigsForMapRange');
    const visit = jest.spyOn(translation, '_forEachCodon');
    const range = new CGRange(cgv.sequence.mapContig, 1, 90);
    translation.draw(range, 100, 20);
    translation.visible = true;
    translation.draw(range, 100, 1);
    cgv.sequence.visible = false;
    translation.draw(range, 100, 20);
    expect(contigs).not.toHaveBeenCalled();
    expect(visit).not.toHaveBeenCalled();

    const empty = new Viewer('#map', {sequence: {length: 1000, translation: {visible: true}}});
    expect(empty.sequence.translation.thickness).toBe(0);
    expect(empty.sequence.translation.scaleFactor(20)).toBe(0);
  });

  test('reserves space outside DNA rows and restores backbone size while zooming out', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'ATG'.repeat(100), translation: {visible: true}}});
    const translation = cgv.sequence.translation;
    cgv._zoomFactor = 4;
    const pixelsPerBp = jest.spyOn(cgv.backbone, 'pixelsPerBp');
    const thicknesses = [];
    for (const pixels of [3, 4, 6, 9, 12, 20, 12, 9, 6, 4, 3]) {
      pixelsPerBp.mockReturnValue(pixels);
      cgv.backbone.refreshThickness();
      const baseScale = cgv.sequence.detailScaleFactor(pixels);
      const geometry = translation._layoutForScale(translation.scaleFactor(pixels), baseScale);
      const firstInnerEdge = geometry.firstLaneCenterOffset - geometry.laneHeight / 2;
      expect(firstInnerEdge).toBeGreaterThanOrEqual(cgv.sequence.baseThickness * baseScale / 2);
      expect(cgv.backbone.adjustedThickness).toBeGreaterThanOrEqual(2 * geometry.backboneEdgeOffset);
      thicknesses.push(cgv.backbone.adjustedThickness);
    }
    expect(thicknesses.slice(0, 5)).toEqual(thicknesses.slice(6).reverse());
    pixelsPerBp.mockReturnValue(20);
    translation.visible = false;
    expect(cgv.backbone.adjustedThickness).toBe(cgv.sequence.baseThickness);
  });

  test('reserves backbone space when a smaller base font grows to match translation', () => {
    const cgv = new Viewer('#map', {sequence: {
      seq: 'ATG'.repeat(100), font: 'sans-serif,plain,10', translation: {visible: true},
    }});
    const sequence = cgv.sequence;
    const translation = sequence.translation;
    cgv._zoomFactor = 4;
    const pixelsPerBp = jest.spyOn(cgv.backbone, 'pixelsPerBp');
    for (const fontSize of [11, 13]) {
      translation.font = `monospace,plain,${fontSize}`;
      for (const pixels of [2, 4, 5, 6, 8, 10, 14]) {
        pixelsPerBp.mockReturnValue(pixels);
        cgv.backbone.refreshThickness();
        const layout = translation._layoutForScale(translation.scaleFactor(pixels), sequence.detailScaleFactor(pixels));
        expect(cgv.backbone.adjustedThickness).toBeGreaterThanOrEqual(2 * layout.backboneEdgeOffset);
      }
    }
  });

  test('round trips all testing controls and resets them when loading an unconfigured map', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'ATGTAACCC'}});
    expect(cgv.sequence.toJSON().translation.visible).toBe(true);
    cgv.sequence.translation.update({
      visible: false,
      highlightStartCodons: false,
      highlightStopCodons: false,
      color: '#112233',
      startColor: '#123456',
      stopColor: '#abcdef',
      backgroundColor: '#d0d0d0',
      borderColor: '#777777',
    });
    cgv.settings.update({geneticCode: 2});
    const json = cgv.io.toJSON();
    expect(json.cgview.sequence.translation.color).toBe('rgba(17,34,51,1)');
    for (const key of ['startTextColor', 'startBorderColor', 'stopTextColor', 'stopBorderColor']) {
      expect(json.cgview.sequence.translation).not.toHaveProperty(key);
    }
    cgv.io.loadJSON(json);
    expect(cgv.sequence.translation.toJSON()).toEqual(json.cgview.sequence.translation);
    expect(cgv.geneticCode).toBe(2);
    cgv.io.loadJSON({cgview: {version: '1.9.0', sequence: {seq: 'ATGTAACCC'}}});
    expect(cgv.sequence.translation.visible).toBe(true);
    expect(cgv.sequence.translation.highlightStartCodons).toBe(true);
    expect(cgv.sequence.toJSON().translation.visible).toBe(true);
  });

  test('uses the selected genetic code for starts and stops without forcing internal starts to methionine', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'TTGTGA', translation: {visible: true}}});
    const range = new CGRange(cgv.sequence.mapContig, 1, 6);
    const codons = id => cgv.sequence.translation.codonsForRange(cgv.contigs(1), range, 1, 1, cgv.codonTables.byID(id));
    expect(codons(11)).toEqual([
      expect.objectContaining({codon: 'TTG', aminoAcid: 'L', isStart: true, isStop: false}),
      expect.objectContaining({codon: 'TGA', aminoAcid: '*', isStart: false, isStop: true}),
    ]);
    expect(codons(2)[1]).toEqual(expect.objectContaining({codon: 'TGA', aminoAcid: 'W', isStop: false}));
  });

  test.each(['circular', 'linear'])('matches hovered codons to all six drawn lanes throughout the fade in %s maps', (format) => {
    const cgv = new Viewer('#map', {sequence: {seq: 'ATGAAATAACCC', translation: {visible: true}}});
    cgv.format = format;
    const translation = cgv.sequence.translation;
    const pixelsPerBp = jest.spyOn(cgv.backbone, 'pixelsPerBp');
    const drawCodon = jest.spyOn(translation, '_drawCodon').mockImplementation(() => {});
    const range = new CGRange(cgv.sequence.mapContig, 1, 12);
    const baseWidth = cgv.sequence.bpSpacing - cgv.sequence.bpMargin;

    for (const fraction of [0.5, 0.625, 1]) {
      pixelsPerBp.mockReturnValue(baseWidth * fraction);
      drawCodon.mockClear();
      translation.draw(range, cgv.backbone.adjustedCenterOffset, baseWidth * fraction);
      const laneOffsets = [...new Set(drawCodon.mock.calls.map(call => call[4]))];
      expect(laneOffsets).toHaveLength(6);
      for (const [start, aminoAcid, isStart, isStop, offset, , strand] of drawCodon.mock.calls) {
        const laneIndex = laneOffsets.indexOf(offset);
        const frame = laneIndex % 3 + 1;
        expect(translation.hitTest(start + 1, offset)).toEqual(expect.objectContaining({
          start, stop: start + 2, aminoAcid, isStart, isStop, strand, frame, signedFrame: strand * frame,
        }));
      }
    }
  });

  test('resolves only the hovered codon without materializing frames', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'ATG'.repeat(100000), translation: {visible: true}}});
    const translation = cgv.sequence.translation;
    jest.spyOn(cgv.backbone, 'pixelsPerBp').mockReturnValue(20);
    const visit = jest.spyOn(translation, '_forEachCodon');
    const materialize = jest.spyOn(translation, 'codonsForRange');
    const offset = cgv.backbone.adjustedCenterOffset + translation._layoutForScale(1).firstLaneCenterOffset;
    expect(translation.hitTest(150002.2, offset)).toEqual(expect.objectContaining({
      start: 150001, stop: 150003, codon: 'ATG', aminoAcid: 'M', aminoAcidName: 'Methionine',
      signedFrame: 1, isStart: true, isStop: false,
      geneticCode: 11, geneticCodeName: 'Bacterial and Plant Plastid',
    }));
    expect(visit).toHaveBeenCalledTimes(1);
    expect(visit.mock.calls[0][1]).toEqual([[150002, 150002]]);
    expect(materialize).not.toHaveBeenCalled();
  });

  test('ignores DNA rows, lane gaps, out-of-range positions, and hidden translation detail', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'ATGAAATAACCC', translation: {visible: true}}});
    const translation = cgv.sequence.translation;
    const pixels = jest.spyOn(cgv.backbone, 'pixelsPerBp').mockReturnValue(20);
    const visit = jest.spyOn(translation, '_forEachCodon');
    const layout = translation._layoutForScale(1);
    const center = cgv.backbone.adjustedCenterOffset;
    const offset = center + layout.firstLaneCenterOffset;
    const expectMiss = (bp, laneOffset = offset) => {
      visit.mockClear();
      expect(translation.hitTest(bp, laneOffset)).toBeUndefined();
      expect(visit).not.toHaveBeenCalled();
    };
    expectMiss(2, center);
    expectMiss(2, offset + layout.laneStep / 2);
    for (const bp of [NaN, Infinity, 0, 13]) { expectMiss(bp); }
    expectMiss(2, NaN);
    pixels.mockReturnValue(1);
    expectMiss(2);
    pixels.mockReturnValue(20);
    translation.visible = false;
    expectMiss(2);
    translation.visible = true;
    cgv.sequence.visible = false;
    expectMiss(2);
  });

  test('anchors hover frames within visible contigs and excludes incomplete boundary codons', () => {
    const cgv = new Viewer('#map', {sequence: {
      contigs: [{name: 'one', seq: 'ATGAA'}, {name: 'two', seq: 'TAACCATG'}], translation: {visible: true},
    }});
    const translation = cgv.sequence.translation;
    jest.spyOn(cgv.backbone, 'pixelsPerBp').mockReturnValue(20);
    const center = cgv.backbone.adjustedCenterOffset;
    const lane = translation._layoutForScale(1).firstLaneCenterOffset;
    expect(translation.hitTest(5, center + lane)).toBeUndefined();
    expect(translation.hitTest(7, center + lane)).toEqual(expect.objectContaining({
      start: 6, stop: 8, codon: 'TAA', signedFrame: 1, isStop: true, contig: cgv.contigs(2),
    }));
    expect(translation.hitTest(12, center - lane)).toEqual(expect.objectContaining({
      start: 11, stop: 13, codon: 'CAT', signedFrame: -1, aminoAcidName: 'Histidine', contig: cgv.contigs(2),
    }));
    cgv.contigs(2).visible = false;
    expect(translation.hitTest(7, center + lane)).toBeUndefined();
  });

  test('hover status follows the genetic code independently of highlight colors', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'TTGTGA', translation: {
      visible: true, highlightStartCodons: false, highlightStopCodons: false,
    }}});
    const translation = cgv.sequence.translation;
    jest.spyOn(cgv.backbone, 'pixelsPerBp').mockReturnValue(20);
    const offset = cgv.backbone.adjustedCenterOffset + translation._layoutForScale(1).firstLaneCenterOffset;
    expect(translation.hitTest(2, offset)).toEqual(expect.objectContaining({isStart: true, aminoAcidName: 'Leucine'}));
    expect(translation.hitTest(5, offset)).toEqual(expect.objectContaining({isStop: true, aminoAcidName: 'Stop', geneticCode: 11}));
    cgv.settings.update({geneticCode: 2});
    expect(translation.hitTest(5, offset)).toEqual(expect.objectContaining({
      codon: 'TGA', aminoAcid: 'W', aminoAcidName: 'Tryptophan', isStop: false,
      geneticCode: 2, geneticCodeName: 'Vertebrate Mitochondrial',
    }));
  });

  test('normalizes RNA and keeps ambiguous codons unknown on both strands', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'AUGNNN'}});
    const range = new CGRange(cgv.sequence.mapContig, 1, 6);
    const table = cgv.codonTables.byID(11);
    const codons = strand => cgv.sequence.translation.codonsForRange(cgv.contigs(1), range, strand, 1, table);
    expect(codons(1).map(c => c.aminoAcid)).toEqual(['M', 'X']);
    expect(codons(-1).map(c => c.aminoAcid)).toEqual(['H', 'X']);
  });
});
