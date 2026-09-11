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

  test('uses sequence.color for backward-compatible single-color rendering', () => {
    const cgv = new Viewer('#map', {
      sequence: {seq: 'ATGCN', color: 'navy'},
    });

    expect(cgv.sequence.baseColorMode).toBe('single');
    expect(cgv.sequence._colorForBase('A', 1)).toBe(rgba('navy'));
    expect(cgv.sequence._colorForBase('N', 5)).toBe(rgba('navy'));
    expect(cgv.sequence.toJSON()).not.toHaveProperty('baseColorMode');
    expect(cgv.sequence.toJSON({includeDefaults: true})).not.toHaveProperty('baseColorMode');
  });

  test('uses built-in colors for canonical, RNA, and ambiguous bases', () => {
    const cgv = new Viewer('#map', {
      sequence: {seq: 'ACGTUN-', baseColorMode: 'byBase'},
    });

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
        baseColorMode: 'byBase',
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
      sequence: {seq: 'A', baseColorMode: 'byBase'},
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
      sequence: {seq: 'A', baseColorMode: 'byBase'},
    });
    const customBaseColors = {
      onLight: {...DEFAULT_BASE_COLORS.onLight, A: '#006400'},
      onDark: {...DEFAULT_BASE_COLORS.onDark, A: '#98fb98'},
    };

    cgv.sequence.update({color: '#123456', baseColors: customBaseColors});

    expect(cgv.sequence.color.rgbaString).toBe(rgba('#123456'));
    expect(cgv.sequence.baseColors).toEqual(customBaseColors);
    expect(cgv.sequence.baseColorMode).toBe('byBase');

    cgv.sequence.update({baseColorMode: 'single'});
    expect(cgv.sequence.baseColorMode).toBe('single');
    expect(cgv.sequence._colorForBase('A', 1)).toBe(rgba('#123456'));
    expect(cgv.sequence.baseColors).toEqual(customBaseColors);
  });

  test('saves custom palettes and keeps returned palette copies detached', () => {
    const cgv = new Viewer('#map', {
      sequence: {seq: 'A', baseColorMode: 'byBase'},
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

  test('loads legacy sequence JSON as single color and ignores colorBases', () => {
    const cgv = new Viewer('#map');

    cgv.io.loadJSON({
      cgview: {
        version: '1.9.0',
        sequence: {seq: 'ATGC', color: 'navy', colorBases: true},
      },
    });

    expect(cgv.sequence.baseColorMode).toBe('single');
    expect(cgv.sequence._colorForBase('A', 1)).toBe(rgba('navy'));
    expect(cgv.io.toJSON().cgview.sequence).not.toHaveProperty('baseColorMode');
    expect(cgv.io.toJSON().cgview.sequence).not.toHaveProperty('colorBases');
  });

  test('round trips by-base mode and constructor and update palette overrides', () => {
    const firstViewer = new Viewer('#map', {
      sequence: {
        seq: 'AC',
        baseColorMode: 'byBase',
        color: '#112233',
        baseColors: {
          onLight: {C: '#654321'},
          onDark: {C: '#fedcba'},
        },
      },
    });
    firstViewer.sequence.update({baseColors: {onDark: {A: '#abcdef'}}});

    const exported = firstViewer.io.toJSON();
    expect(exported.cgview.sequence.baseColorMode).toBe('byBase');
    expect(exported.cgview.sequence.baseColors.onLight.C).toBe('#654321');
    expect(exported.cgview.sequence.baseColors.onDark.A).toBe('#abcdef');

    const secondViewer = new Viewer('#second-map');
    secondViewer.io.loadJSON(exported);

    expect(secondViewer.sequence.baseColorMode).toBe('byBase');
    expect(secondViewer.sequence.color.rgbaString).toBe(rgba('#112233'));
    expect(secondViewer.sequence.baseColors).toEqual(firstViewer.sequence.baseColors);
    expect(secondViewer.io.toJSON().cgview.sequence).toEqual(exported.cgview.sequence);
  });

  test('colors both strands across the origin using each contig backbone', () => {
    const cgv = new Viewer('#map', {
      sequence: {
        baseColorMode: 'byBase',
        baseTextOrientation: 'curved',
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
    jest.spyOn(ctx, 'fillText').mockImplementation((base) => {
      rendered.push({base, color: rgba(ctx.fillStyle)});
    });

    cgv.sequence.draw();

    expect(rendered).toEqual([
      {base: 'U', color: rgba(DEFAULT_BASE_COLORS.onDark.T)},
      {base: 'A', color: rgba(DEFAULT_BASE_COLORS.onDark.A)},
      {base: 'A', color: rgba(DEFAULT_BASE_COLORS.onLight.A)},
      {base: 'T', color: rgba(DEFAULT_BASE_COLORS.onLight.T)},
      {base: 'C', color: rgba(DEFAULT_BASE_COLORS.onLight.C)},
      {base: 'G', color: rgba(DEFAULT_BASE_COLORS.onLight.G)},
    ]);

    cgv.sequence.update({baseColorMode: 'single', color: 'navy'});
    rendered.length = 0;
    cgv.sequence.draw();
    expect(rendered).toHaveLength(6);
    expect(rendered.every(({color}) => color === rgba('navy'))).toBe(true);
  });
});
