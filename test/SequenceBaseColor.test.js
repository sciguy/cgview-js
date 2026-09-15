import Color from '../src/Color';
import CGRange from '../src/CGRange';
import {DEFAULT_BASE_COLORS} from '../src/BaseColorPalette';
import Viewer from '../src/Viewer';

const rgba = (color) => new Color(color).rgbaString;

describe('Sequence base coloring', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="map"></div><div id="second-map"></div>';
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test.each(['uniformBoxes', 'lettersOnly'])('uses sequence.color and saves %s display', (mode) => {
    const cgv = new Viewer('#map', {
      sequence: {seq: 'ATGCN', color: 'navy', baseDisplayMode: mode},
    });

    expect(cgv.sequence.baseDisplayMode).toBe(mode);
    expect(cgv.sequence._colorForBase('A', 1)).toBe(rgba('navy'));
    expect(cgv.sequence._colorForBase('N', 5)).toBe(rgba('navy'));
    expect(cgv.sequence.toJSON().baseDisplayMode).toBe(mode);
    expect(cgv.sequence.toJSON({includeDefaults: true}).baseDisplayMode).toBe(mode);
    cgv.io.loadJSON(cgv.io.toJSON());
    expect(cgv.sequence.baseDisplayMode).toBe(mode);
    expect(cgv.sequence._colorForBase('A', 1)).toBe(rgba('navy'));
  });

  test('uses built-in base colors by default for canonical, RNA, and ambiguous bases', () => {
    const cgv = new Viewer('#map', {
      sequence: {seq: 'ACGTUN-'},
    });

    expect(cgv.sequence.baseDisplayMode).toBe('coloredBoxes');
    expect(cgv.sequence).not.toHaveProperty('baseColorMode');
    expect(cgv.sequence.toJSON()).not.toHaveProperty('baseDisplayMode');
    expect(cgv.sequence.toJSON({includeDefaults: true}).baseDisplayMode).toBe('coloredBoxes');
    // The default gray backbone uses the brighter dark-background palette.
    expect(cgv.sequence._colorForBase('A', 1)).toBe(DEFAULT_BASE_COLORS.onDark.A);
    expect(cgv.sequence._colorForBase('C', 2)).toBe(DEFAULT_BASE_COLORS.onDark.C);
    expect(cgv.sequence._colorForBase('G', 3)).toBe(DEFAULT_BASE_COLORS.onDark.G);
    expect(cgv.sequence._colorForBase('T', 4)).toBe(DEFAULT_BASE_COLORS.onDark.T);
    expect(cgv.sequence._colorForBase('U', 5)).toBe(DEFAULT_BASE_COLORS.onDark.T);
    expect(cgv.sequence._colorForBase('N', 6)).toBe(DEFAULT_BASE_COLORS.onDark.ambiguous);
    expect(cgv.sequence._colorForBase('-', 7)).toBe(DEFAULT_BASE_COLORS.onDark.ambiguous);
  });

  test('selects light and dark palettes independently for contigs in one map', () => {
    const cgv = new Viewer('#map', {
      sequence: {
        baseDisplayMode: 'coloredBoxes',
        contigs: [
          {name: 'Light', seq: 'A', color: 'white'},
          {name: 'Dark', seq: 'C', color: 'black'},
        ],
      },
    });

    expect(cgv.sequence._baseColorVariantForBp(1)).toBe('onLight');
    expect(cgv.sequence._baseColorVariantForBp(2)).toBe('onDark');
    expect(cgv.sequence._colorForBase('A', 1)).toBe(DEFAULT_BASE_COLORS.onLight.A);
    expect(cgv.sequence._colorForBase('C', 2)).toBe(DEFAULT_BASE_COLORS.onDark.C);
  });

  test('classifies translucent backbones after compositing over the map background', () => {
    const cgv = new Viewer('#map', {
      settings: {backgroundColor: 'white'},
      backbone: {color: 'rgba(0,0,0,0.2)'},
      sequence: {seq: 'A', baseDisplayMode: 'coloredBoxes'},
    });

    // 20% black over white renders as a light gray, rather than raw black.
    expect(cgv.sequence._baseColorVariantForBp(1)).toBe('onLight');
    expect(cgv.sequence._colorForBase('A', 1)).toBe(DEFAULT_BASE_COLORS.onLight.A);

    cgv.settings.update({backgroundColor: 'black'});
    cgv.backbone.update({color: 'rgba(255,255,255,0.2)'});

    // 20% white over black renders as a dark gray, rather than raw white.
    expect(cgv.sequence._baseColorVariantForBp(1)).toBe('onDark');
    expect(cgv.sequence._colorForBase('A', 1)).toBe(DEFAULT_BASE_COLORS.onDark.A);
  });

  test('updates sequence colors and palettes without changing the mode', () => {
    const cgv = new Viewer('#map', {
      sequence: {seq: 'A', baseDisplayMode: 'coloredBoxes'},
    });
    const customBaseColors = {
      onLight: {...DEFAULT_BASE_COLORS.onLight, A: '#006400'},
      onDark: {...DEFAULT_BASE_COLORS.onDark, A: '#98fb98'},
    };

    cgv.sequence.update({color: '#123456', baseColors: customBaseColors});

    expect(cgv.sequence.color.rgbaString).toBe(rgba('#123456'));
    expect(cgv.sequence.baseColors).toEqual(customBaseColors);
    expect(cgv.sequence.baseDisplayMode).toBe('coloredBoxes');

    cgv.sequence.update({baseDisplayMode: 'uniformBoxes'});
    expect(cgv.sequence.baseDisplayMode).toBe('uniformBoxes');
    expect(cgv.sequence._colorForBase('A', 1)).toBe(rgba('#123456'));
    expect(cgv.sequence.baseColors).toEqual(customBaseColors);
  });

  test('saves custom palettes and keeps returned palette copies detached', () => {
    const cgv = new Viewer('#map', {
      sequence: {seq: 'A', baseDisplayMode: 'coloredBoxes'},
    });

    expect(cgv.sequence.toJSON()).not.toHaveProperty('baseColors');
    expect(cgv.sequence.toJSON({includeDefaults: true}).baseColors).toEqual(DEFAULT_BASE_COLORS);
    const overrides = {onLight: {A: '#ff8800'}};
    cgv.sequence.update({baseColors: overrides});
    overrides.onLight.A = '#000000';
    const copiedPalette = cgv.sequence.baseColors;
    copiedPalette.onLight.A = '#000000';
    expect(cgv.sequence.baseColors.onLight.A).toBe('#ff8800');
    expect(cgv.sequence.baseColors.onDark.A).toBe(DEFAULT_BASE_COLORS.onDark.A);

    const savedPalette = cgv.sequence.toJSON().baseColors;
    expect(savedPalette).toEqual(cgv.sequence.baseColors);
    savedPalette.onLight.A = '#000000';
    expect(cgv.sequence.baseColors.onLight.A).toBe('#ff8800');

    cgv.sequence.update({baseColors: DEFAULT_BASE_COLORS});
    expect(cgv.sequence.toJSON()).not.toHaveProperty('baseColors');
  });

  test('uses default base coloring for JSON without a mode and ignores colorBases', () => {
    const cgv = new Viewer('#map');

    cgv.io.loadJSON({
      cgview: {
        version: '1.9.0',
        sequence: {seq: 'ATGC', color: 'navy', colorBases: true},
      },
    });

    expect(cgv.sequence.baseDisplayMode).toBe('coloredBoxes');
    expect(cgv.sequence.color.rgbaString).toBe(rgba('navy'));
    expect(cgv.sequence._colorForBase('A', 1)).toBe(DEFAULT_BASE_COLORS.onDark.A);
    expect(cgv.io.toJSON().cgview.sequence).not.toHaveProperty('baseDisplayMode');
    expect(cgv.io.toJSON().cgview.sequence).not.toHaveProperty('colorBases');
  });

  test('round trips by-base mode and constructor and update palette overrides', () => {
    const firstViewer = new Viewer('#map', {
      sequence: {
        seq: 'AC',
        baseDisplayMode: 'coloredBoxes',
        color: '#112233',
        baseColors: {
          onLight: {C: '#654321'},
          onDark: {C: '#fedcba'},
        },
      },
    });
    firstViewer.sequence.update({baseColors: {onDark: {A: '#abcdef'}}});

    const exported = firstViewer.io.toJSON();
    expect(exported.cgview.sequence).not.toHaveProperty('baseDisplayMode');
    expect(exported.cgview.sequence.baseColors.onLight.C).toBe('#654321');
    expect(exported.cgview.sequence.baseColors.onDark.A).toBe('#abcdef');

    const secondViewer = new Viewer('#second-map');
    secondViewer.io.loadJSON(exported);

    expect(secondViewer.sequence.baseDisplayMode).toBe('coloredBoxes');
    expect(secondViewer.sequence.color.rgbaString).toBe(rgba('#112233'));
    expect(secondViewer.sequence.baseColors).toEqual(firstViewer.sequence.baseColors);
    expect(secondViewer.io.toJSON().cgview.sequence).toEqual(exported.cgview.sequence);
  });

  test.each(['horizontal', 'curved'])('fills boxes on both strands across the origin with %s bases', (orientation) => {
    const cgv = new Viewer('#map', {
      sequence: {
        baseDisplayMode: 'coloredBoxes',
        baseTextOrientation: orientation,
        contigs: [
          {name: 'Light', seq: 'AC', color: 'white'},
          {name: 'Dark', seq: 'GU', color: 'black'},
        ],
      },
    });
    jest.spyOn(cgv.backbone, 'pixelsPerBp').mockReturnValue(20);
    jest.spyOn(cgv.backbone, 'visibleRange', 'get')
      .mockReturnValue(new CGRange(cgv.sequence.mapContig, 4, 2));
    const ctx = cgv.canvas.context('map');
    const rendered = [];
    let fill;
    let currentBase;
    const drawBase = cgv.sequence._drawBase;
    jest.spyOn(cgv.sequence, '_drawBase').mockImplementation(function(...args) {
      currentBase = args[1];
      return drawBase.apply(this, args);
    });
    jest.spyOn(ctx, 'fill').mockImplementation(() => { fill = rgba(ctx.fillStyle); });
    jest.spyOn(ctx, 'fillText').mockImplementation((base) => {
      rendered.push({base, fill, text: rgba(ctx.fillStyle)});
    });
    jest.spyOn(ctx, 'drawImage').mockImplementation((image) => {
      const glyphContext = image.getContext('2d');
      rendered.push({base: currentBase, fill, text: rgba(glyphContext.fillStyle)});
    });

    cgv.sequence.draw();

    expect(rendered).toEqual([
      {base: 'U', fill: rgba(DEFAULT_BASE_COLORS.onDark.T), text: rgba('black')},
      {base: 'A', fill: rgba(DEFAULT_BASE_COLORS.onDark.A), text: rgba('black')},
      {base: 'A', fill: rgba(DEFAULT_BASE_COLORS.onLight.A), text: rgba('white')},
      {base: 'T', fill: rgba(DEFAULT_BASE_COLORS.onLight.T), text: rgba('white')},
      {base: 'C', fill: rgba(DEFAULT_BASE_COLORS.onLight.C), text: rgba('white')},
      {base: 'G', fill: rgba(DEFAULT_BASE_COLORS.onLight.G), text: rgba('white')},
    ]);

    cgv.sequence.update({baseDisplayMode: 'uniformBoxes', color: 'navy'});
    rendered.length = 0;
    cgv.sequence.draw();
    expect(rendered).toHaveLength(6);
    expect(rendered.every(({text, fill}) => text === rgba('navy') && fill === rgba('#e5e7eb'))).toBe(true);
  });

  test.each([
    ['circular', 'curved'], ['circular', 'horizontal'],
    ['linear', 'curved'], ['linear', 'horizontal'],
  ])('draws letters only across the origin without box work in %s/%s mode', (format, orientation) => {
    const cgv = new Viewer('#map', {sequence: {
      seq: 'ATGC', color: 'navy', baseDisplayMode: 'lettersOnly', baseTextOrientation: orientation,
      translation: {visible: false},
    }});
    const sequence = cgv.sequence;
    cgv.format = format;
    const pixels = jest.spyOn(cgv.backbone, 'pixelsPerBp');
    jest.spyOn(cgv.backbone, 'visibleRange', 'get').mockReturnValue(new CGRange(sequence.mapContig, 4, 2));
    const geometry = jest.spyOn(sequence, '_baseCellGeometry');
    const palette = jest.spyOn(sequence, '_baseCellStyleForBase');
    const uniformStyle = jest.spyOn(sequence, '_uniformBaseCellStyle');
    const variant = jest.spyOn(sequence, '_baseColorVariantForBp');
    const drawBase = sequence._drawBase;
    const ctx = cgv.canvas.context('map');
    const letters = [];
    const textColors = [];
    const opacities = [];
    jest.spyOn(sequence, '_drawBase').mockImplementation(function(...args) {
      letters.push(args[1]);
      opacities.push(ctx.globalAlpha);
      return drawBase.apply(this, args);
    });
    jest.spyOn(ctx, 'fillText').mockImplementation(() => textColors.push(rgba(ctx.fillStyle)));
    jest.spyOn(ctx, 'drawImage').mockImplementation(image => textColors.push(rgba(image.getContext('2d').fillStyle)));

    for (const fraction of [0.1875, 1.25]) {
      pixels.mockReturnValue((sequence.bpSpacing - sequence.bpMargin) * fraction);
      letters.length = textColors.length = opacities.length = 0;
      for (const method of ['fill', 'stroke', 'beginPath', 'rotate']) { ctx[method].mockClear(); }
      ctx.globalAlpha = 0.8;
      sequence.draw();

      expect(letters).toEqual(['C', 'G', 'A', 'T', 'T', 'A']);
      expect(textColors).toEqual(Array(6).fill(rgba('navy')));
      expect(opacities).toEqual(Array(6).fill(fraction < 1 ? 0.4 : 0.8));
      expect(ctx.globalAlpha).toBe(0.8);
      expect(ctx.fill).not.toHaveBeenCalled();
      expect(ctx.stroke).not.toHaveBeenCalled();
      expect(ctx.beginPath).not.toHaveBeenCalled();
      expect(ctx.rotate).toHaveBeenCalledTimes(format === 'circular' && orientation === 'curved' ? 6 : 0);
    }
    expect(geometry).not.toHaveBeenCalled();
    expect(palette).not.toHaveBeenCalled();
    expect(uniformStyle).not.toHaveBeenCalled();
    expect(variant).not.toHaveBeenCalled();
  });

  test('chooses text contrast from custom fills and refreshes cached palette styles', () => {
    const cgv = new Viewer('#map', {sequence: {seq: 'ATGN', baseDisplayMode: 'coloredBoxes',
      baseColors: {onDark: {A: 'black', T: 'white', ambiguous: '#000080'}},
    }});
    const sequence = cgv.sequence;
    expect(sequence._baseCellStyleForBase('A', 1).text).toBe(rgba('white'));
    expect(sequence._baseCellStyleForBase('U', 2).text).toBe(rgba('black'));
    expect(sequence._baseCellStyleForBase('N', 4).text).toBe(rgba('white'));
    const cached = sequence._baseCellStyleForBase('A', 1);
    expect(sequence._baseCellStyleForBase('A', 1)).toBe(cached);
    sequence.update({baseColors: {onDark: {A: 'white'}}});
    expect(sequence._baseCellStyleForBase('A', 1).text).toBe(rgba('black'));
    expect(sequence._baseCellStyleForBase('A', 1)).not.toBe(cached);
  });

  test('chooses contrasting letters after compositing translucent fills over each contig', () => {
    const fill = 'rgba(0,0,0,0.1)';
    const cgv = new Viewer('#map', {sequence: {baseDisplayMode: 'coloredBoxes',
      contigs: [{seq: 'A', color: 'white'}, {seq: 'A', color: 'black'}],
      baseColors: {onLight: {A: fill}, onDark: {A: fill}},
    }});
    const sequence = cgv.sequence;
    expect(sequence._baseCellStyleForBase('A', 1)).toEqual({fill: rgba(fill), text: rgba('black')});
    expect(sequence._baseCellStyleForBase('A', 2)).toEqual({fill: rgba(fill), text: rgba('white')});
  });
});
