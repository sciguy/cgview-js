import Viewer from '../src/Viewer';
import CGRange from '../src/CGRange';

describe('SequenceTranslation', () => {

  beforeEach(() => {
    document.body.innerHTML = '<div id="map"></div>';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('is opt-in and contributes backbone thickness only when visible', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'ATGAAATAACCC'}});
    const baseThickness = cgv.sequence.baseThickness;

    expect(cgv.sequence.translation.visible).toBe(false);
    expect(cgv.sequence.thickness).toBe(baseThickness);

    cgv.sequence.translation.visible = true;
    expect(cgv.sequence.thickness).toBeGreaterThan(baseThickness);
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
    const cgv = new Viewer('#map', {sequence: {seq: 'ATGAAATAACCC'}});
    const adjustProportions = jest.spyOn(cgv.layout, '_adjustProportions');

    cgv.sequence.translation.visible = true;

    expect(adjustProportions).toHaveBeenCalledTimes(1);
    expect(adjustProportions).toHaveBeenCalledWith({duration: 0});
  });

  test('does not recalculate layout when translation has zero thickness at the current zoom', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'A'.repeat(1000)}});
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

  test('styles start and stop codons independently and allows either highlight to be disabled', () => {
    const cgv = new Viewer('#map', {
      sequence: {
        seq: 'ATGTAACCC',
        translation: {
          visible: true,
          startColor: '#d1fae5',
          startBorderColor: '#059669',
          startTextColor: '#065f46',
          stopColor: '#fee2e2',
          stopBorderColor: '#dc2626',
          stopTextColor: '#991b1b',
        },
      },
    });
    const translation = cgv.sequence.translation;
    const range = new CGRange(cgv.sequence.mapContig, 1, cgv.sequence.length);
    const codons = translation.codonsForRange(cgv.contigs(1), range, 1, 1, cgv.codonTables.byID(11));
    expect(translation.startTextColor.rgbaString).toBe('rgba(6,95,70,1)');
    expect(translation.stopTextColor.rgbaString).toBe('rgba(153,27,27,1)');

    const drawElement = jest.spyOn(cgv.canvas, 'drawElement').mockImplementation(() => {});
    const pointForBp = jest.spyOn(cgv.canvas, 'pointForBp').mockReturnValue({x: 12, y: 34});
    const ctx = cgv.canvas.context('map');
    const fillText = jest.spyOn(ctx, 'fillText');
    const translate = jest.spyOn(ctx, 'translate');
    const rotate = jest.spyOn(ctx, 'rotate');
    const layout = translation._layoutForScale(0.6);
    translation._drawCodon(codons[0].start, codons[0].aminoAcid, codons[0].isStart, codons[0].isStop, 100, layout);
    expect(drawElement).toHaveBeenNthCalledWith(1, expect.objectContaining({
      color: 'rgba(209,250,229,1)',
      width: layout.highlightHeight,
      showBorder: true,
      borderColor: 'rgba(5,150,105,1)',
      borderThickness: layout.highlightBorderWidth,
    }));
    expect(pointForBp).toHaveBeenLastCalledWith(codons[0].start + 1, 100);
    expect(translate).toHaveBeenLastCalledWith(12, 34);
    expect(rotate).toHaveBeenCalled();
    expect(fillText).toHaveBeenLastCalledWith(codons[0].aminoAcid, 0, 0);
    translation._drawCodon(codons[1].start, codons[1].aminoAcid, codons[1].isStart, codons[1].isStop, 100, layout);
    expect(drawElement).toHaveBeenLastCalledWith(expect.objectContaining({
      color: 'rgba(254,226,226,1)',
      showBorder: true,
      borderColor: 'rgba(220,38,38,1)',
    }));

    translation.update({highlightStartCodons: false, highlightStopCodons: false});
    const drawCountBeforeDisabledHighlight = drawElement.mock.calls.length;
    translation._drawCodon(codons[0].start, codons[0].aminoAcid, codons[0].isStart, codons[0].isStop, 100, layout);
    expect(drawElement).toHaveBeenCalledTimes(drawCountBeforeDisabledHighlight);

    const circularRotateCount = rotate.mock.calls.length;
    cgv.format = 'linear';
    translation._drawCodon(codons[0].start, codons[0].aminoAcid, false, false, 100, layout);
    expect(rotate).toHaveBeenCalledTimes(circularRotateCount);
    expect(fillText).toHaveBeenLastCalledWith(codons[0].aminoAcid, 12, 34);
  });

  test('streams only visible codons during drawing instead of building frame arrays', () => {
    const cgv = new Viewer('#map', {
      sequence: {seq: 'ATG'.repeat(100000), translation: {visible: true}},
    });
    const translation = cgv.sequence.translation;
    const visibleRange = new CGRange(cgv.sequence.mapContig, 150001, 150090);
    const materializeCodons = jest.spyOn(translation, 'codonsForRange');
    const visitCodons = jest.spyOn(translation, '_forEachCodon');
    const drawElement = jest.spyOn(cgv.canvas, 'drawElement').mockImplementation(() => {});
    jest.spyOn(cgv.canvas, 'pointForBp').mockReturnValue({x: 0, y: 0});

    translation.draw(visibleRange, 100, 20);

    expect(materializeCodons).not.toHaveBeenCalled();
    expect(visitCodons).toHaveBeenCalledTimes(6);
    expect(drawElement.mock.calls.length).toBeGreaterThan(0);
    expect(drawElement.mock.calls.length).toBeLessThanOrEqual(192);
    expect(drawElement.mock.calls.filter(call =>
      call[0].color === translation.backgroundColor.rgbaString
    )).toHaveLength(6);
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
    jest.spyOn(cgv.canvas, 'drawElement').mockImplementation(() => opacities.push(ctx.globalAlpha));
    jest.spyOn(ctx, 'fillText').mockImplementation(() => {
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
        for (const font of fonts) {
          expect(Number(font.match(/([\d.]+)px/)[1])).toBe(translation.font.size / 2);
        }
      }
      expect(ctx.globalAlpha).toBe(0.8);
    }
  });

  test('does no codon or range work for hidden, distant, or length-only sequence', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'ATG'.repeat(100)}});
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

  test('round trips all testing controls and resets them when loading an unconfigured map', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'ATGTAACCC'}});
    expect(cgv.sequence.toJSON()).not.toHaveProperty('translation');
    cgv.sequence.translation.update({
      visible: true,
      highlightStartCodons: false,
      highlightStopCodons: false,
      startColor: '#123456',
      stopColor: '#abcdef',
    });
    cgv.settings.update({geneticCode: 2});
    const json = cgv.io.toJSON();
    cgv.io.loadJSON(json);
    expect(cgv.sequence.translation.toJSON()).toEqual(json.cgview.sequence.translation);
    expect(cgv.geneticCode).toBe(2);
    cgv.io.loadJSON({cgview: {version: '1.9.0', sequence: {seq: 'ATGTAACCC'}}});
    expect(cgv.sequence.translation.visible).toBe(false);
    expect(cgv.sequence.translation.highlightStartCodons).toBe(true);
    expect(cgv.sequence.toJSON()).not.toHaveProperty('translation');
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

  test('normalizes RNA and keeps ambiguous codons unknown on both strands', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'AUGNNN'}});
    const range = new CGRange(cgv.sequence.mapContig, 1, 6);
    const table = cgv.codonTables.byID(11);
    const codons = strand => cgv.sequence.translation.codonsForRange(cgv.contigs(1), range, strand, 1, table);
    expect(codons(1).map(c => c.aminoAcid)).toEqual(['M', 'X']);
    expect(codons(-1).map(c => c.aminoAcid)).toEqual(['H', 'X']);
  });
});
