import Viewer from '../src/Viewer';

describe('Caption backgrounds', () => {
  let cgv;

  beforeEach(() => {
    document.body.innerHTML = '<div id="map"></div>';
    cgv = new Viewer('#map', {legend: {visible: false}});
  });

  afterEach(() => jest.restoreAllMocks());

  describe('inherited background colors', () => {
    test.each([
      ['rect', 'canvas'], ['halo', 'canvas'], ['rect', 'map'], ['halo', 'map'],
    ])('repaints an inherited %s background on the %s when map settings change', (style, on) => {
      const caption = cgv.addCaptions({name: 'Inherited background', backgroundStyle: style})[0];
      caption.on = on;
      expect(caption.backgroundColor).toBe(cgv.settings.backgroundColor);

      const ctx = caption.ctx;
      const method = style === 'rect' ? 'fillRect' : 'strokeText';
      const colors = [];
      ctx[method].mockImplementation((...args) => {
        if (style === 'rect' || args[0] === caption.name) {
          colors.push(ctx[style === 'rect' ? 'fillStyle' : 'strokeStyle']);
        }
      });
      cgv.settings.update({backgroundColor: 'rgba(20,40,60,0.25)'});
      expect(colors).toEqual(['rgba(20, 40, 60, 0.25)']);
      expect(caption.backgroundColor).toBe(cgv.settings.backgroundColor);

      colors.length = 0;
      cgv.settings.backgroundColor = 'rgba(50,60,70,0.75)';
      expect(colors).toEqual(['rgba(50, 60, 70, 0.75)']);
      expect(caption.backgroundColor).toBe(cgv.settings.backgroundColor);
    });

    test('keeps explicit colors fixed, including transparent colors, until reset to undefined', () => {
      cgv.settings.backgroundColor = 'rgba(20,40,60,0.25)';
      const [explicit, transparent] = cgv.addCaptions([
        {name: 'Same as map', backgroundColor: 'rgba(20,40,60,0.25)'},
        {name: 'Transparent', backgroundColor: 'rgba(20,40,60,0)'},
      ]);
      cgv.settings.backgroundColor = 'rgba(50,60,70,0.75)';
      expect(explicit.backgroundColor.rgbaString).toBe('rgba(20,40,60,0.25)');
      expect(transparent.backgroundColor.rgbaString).toBe('rgba(20,40,60,0)');

      explicit.update({backgroundColor: undefined});
      expect(explicit.backgroundColor).toBe(cgv.settings.backgroundColor);
      expect(explicit.toJSON()).not.toHaveProperty('backgroundColor');
      cgv.settings.backgroundColor = 'black';
      expect(explicit.backgroundColor).toBe(cgv.settings.backgroundColor);
      expect(transparent.backgroundColor.opacity).toBe(0);
    });

    test.each([false, true])('preserves inheritance across JSON reloads with includeDefaults=%s', includeDefaults => {
      cgv.settings.backgroundColor = 'rgba(20,40,60,0.25)';
      cgv.addCaptions([
        {name: 'Inherited', backgroundStyle: 'halo'},
        {name: 'Explicit', backgroundColor: 'rgba(20,40,60,0.25)'},
        {name: 'Transparent', backgroundColor: 'rgba(20,40,60,0)'},
      ]);
      const json = JSON.parse(JSON.stringify(cgv.io.toJSON({includeDefaults})));
      expect(json.cgview.captions[0]).not.toHaveProperty('backgroundColor');
      expect(json.cgview.captions[1].backgroundColor).toBe('rgba(20,40,60,0.25)');
      expect(json.cgview.captions[2].backgroundColor).toBe('rgba(20,40,60,0)');

      cgv.io.loadJSON(json);
      cgv.settings.backgroundColor = 'rgba(50,60,70,0.75)';
      expect(cgv.captions(1).backgroundColor).toBe(cgv.settings.backgroundColor);
      expect(cgv.captions(2).backgroundColor.rgbaString).toBe('rgba(20,40,60,0.25)');
      expect(cgv.captions(3).backgroundColor.opacity).toBe(0);
    });

    test.each(['invertAllColors', 'invertMapColors'])('keeps inherited colors attached during %s', method => {
      cgv.settings.backgroundColor = 'rgba(20,40,60,0.25)';
      const [inherited, explicit] = cgv.addCaptions([
        {name: 'Inherited', backgroundStyle: 'halo'},
        {name: 'Explicit', backgroundColor: 'rgba(10,30,50,0.5)'},
      ]);
      cgv[method]();
      expect(cgv.settings.backgroundColor.rgbaString).toBe('rgba(235,215,195,0.25)');
      expect(inherited.backgroundColor).toBe(cgv.settings.backgroundColor);
      expect(inherited.toJSON()).not.toHaveProperty('backgroundColor');
      expect(inherited.fontColor.rgbaString).toBe('rgba(255,255,255,1)');
      expect(explicit.backgroundColor.rgbaString).toBe('rgba(245,225,205,0.5)');

      cgv[method]();
      expect(inherited.backgroundColor.rgbaString).toBe('rgba(20,40,60,0.25)');
      expect(explicit.backgroundColor.rgbaString).toBe('rgba(10,30,50,0.5)');
    });

    test('inverting an inherited caption alone leaves the map background unchanged', () => {
      cgv.settings.backgroundColor = 'rgba(20,40,60,0.25)';
      const caption = cgv.addCaptions({name: 'Inherited'})[0];
      caption.invertColors();
      expect(cgv.settings.backgroundColor.rgbaString).toBe('rgba(20,40,60,0.25)');
      expect(caption.backgroundColor).toBe(cgv.settings.backgroundColor);
      expect(caption.fontColor.rgbaString).toBe('rgba(255,255,255,1)');
      expect(caption.toJSON()).not.toHaveProperty('backgroundColor');
    });
  });

  test('loads existing captions with rectangular backgrounds and round trips halo RGBA', () => {
    cgv.io.loadJSON({cgview: {
      version: '1.9.0', sequence: {length: 1000},
      captions: [{name: 'Existing'}, {
        name: 'Halo', backgroundStyle: 'halo', backgroundColor: 'rgba(20,40,60,0.25)',
      }],
    }});
    expect(cgv.captions(1).backgroundStyle).toBe('rect');
    const json = cgv.io.toJSON();
    expect(json.cgview.captions[0].backgroundStyle).toBe('rect');
    expect(json.cgview.captions[1]).toMatchObject({
      backgroundStyle: 'halo', backgroundColor: 'rgba(20,40,60,0.25)',
    });
    cgv.io.loadJSON(json);
    expect(cgv.captions(2).backgroundStyle).toBe('halo');
    expect(cgv.captions(2).backgroundColor.opacity).toBe(0.25);
  });

  test('updates the style through the public API without changing layout or hit bounds', () => {
    const caption = cgv.addCaptions({name: 'Title\nSubtitle', font: 'sans-serif,plain,20'})[0];
    const bounds = ({x, y, width, height, padding}) => ({x, y, width, height, padding});
    const before = bounds(caption.box);
    const listener = jest.fn();
    cgv.on('captions-update.test', listener);
    caption.update({backgroundStyle: 'halo'});
    expect(caption.backgroundStyle).toBe('halo');
    expect(bounds(caption.box)).toEqual(before);
    expect(caption.box.containsPt(before.x + before.width / 2, before.y + before.height / 2)).toBe(true);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({attributes: {backgroundStyle: 'halo'}}));

    cgv.updateCaptions({[caption.cgvID]: {backgroundStyle: 'rect'}});
    expect(caption.backgroundStyle).toBe('rect');
  });

  test('rejects unsupported styles and keeps a valid default', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const caption = cgv.addCaptions({name: 'Title', backgroundStyle: 'outline'})[0];
    expect(caption.backgroundStyle).toBe('rect');
    caption.backgroundStyle = 'halo';
    for (const invalid of ['rectangle', 'outline', '', null, undefined, ['rect', 'halo']]) {
      caption.backgroundStyle = invalid;
      expect(caption.backgroundStyle).toBe('halo');
    }
  });

  test.each(['left', 'center', 'right'])('preserves %s alignment and exact halo opacity across font sizes', alignment => {
    const caption = cgv.addCaptions({
      name: 'Title\nSubtitle', font: 'sans-serif,plain,20', textAlignment: alignment,
      backgroundStyle: 'halo', backgroundColor: 'rgba(20,40,60,0.25)',
    })[0];
    const ctx = caption.ctx;
    const strokes = [];
    ctx.strokeText.mockImplementation((text, x, y) => strokes.push({
      text, x, y, width: ctx.lineWidth, color: ctx.strokeStyle, alignment: ctx.textAlign,
    }));
    ctx.fillText.mockClear();
    ctx.strokeText.mockClear();
    ctx.fillRect.mockClear();
    ctx.clearRect.mockClear();
    caption.draw();

    expect(strokes.map(stroke => stroke.text)).toEqual(['Title', 'Subtitle']);
    expect(strokes.every(stroke => stroke.width === 5 && stroke.color === 'rgba(20, 40, 60, 0.25)' &&
      stroke.alignment === alignment && stroke.x === caption.textX())).toBe(true);
    expect(strokes[1].y - strokes[0].y).toBe(30);
    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(ctx.clearRect.mock.calls).toEqual([[0, 0, cgv.width, cgv.height]]);
    expect(Math.max(...ctx.strokeText.mock.invocationCallOrder))
      .toBeLessThan(Math.min(...ctx.fillText.mock.invocationCallOrder));

    strokes.length = 0;
    caption.font = 'sans-serif,plain,40';
    expect(strokes.every(stroke => stroke.width === 10)).toBe(true);

    strokes.length = 0;
    caption.backgroundColor = 'rgba(20,40,60,0)';
    expect(strokes.every(stroke => stroke.color === 'rgba(20, 40, 60, 0)')).toBe(true);
  });

  test('repaints overlapping captions when drawing, moving, hiding, and removing a halo', () => {
    const [under, over] = cgv.addCaptions([
      {name: 'Under', font: 'sans-serif,plain,40'},
      {name: 'Over', backgroundStyle: 'halo', backgroundColor: 'rgba(255,255,255,0.5)'},
    ]);
    const ctx = over.ctx;
    const clearBox = jest.spyOn(over.box, 'clear');
    const mutations = [
      () => over.draw(),
      () => { over.name = 'Short'; },
      () => { over.position = 'top-left'; },
      () => { over.visible = false; },
      () => over.remove(),
    ];
    for (const mutate of mutations) {
      ctx.fillText.mockClear();
      mutate();
      expect(ctx.fillText.mock.calls.filter(call => call[0] === under.name)).toHaveLength(1);
    }
    expect(clearBox).not.toHaveBeenCalled();
  });

  test('restores both layers when moving a caption between canvas and map', () => {
    const caption = cgv.addCaptions({name: 'Moving halo', backgroundStyle: 'halo'})[0];
    const canvas = cgv.canvas.context('canvas');
    const foreground = cgv.canvas.context('foreground');
    for (const on of ['map', 'canvas']) {
      canvas.fillText.mockClear();
      foreground.fillText.mockClear();
      caption.on = on;
      const canvasText = canvas.fillText.mock.calls.filter(call => call[0] === caption.name);
      const mapText = foreground.fillText.mock.calls.filter(call => call[0] === caption.name);
      expect(canvasText).toHaveLength(on === 'canvas' ? 1 : 0);
      expect(mapText).toHaveLength(on === 'map' ? 1 : 0);
    }
  });
});
