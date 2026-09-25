import Viewer from '../src/Viewer';

describe('Legend', () => {
  let cgv;

  beforeAll(() => {
    // Set up document body to have a div for the map
    document.body.innerHTML = '<div id="map"></div>';
  });

  beforeEach(() => {
    cgv = new Viewer('#map');
    // Turn off console.log
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  describe('backgrounds', () => {
    test('defaults to a rectangle and inherits the map background when loading older JSON', () => {
      cgv.io.loadJSON({cgview: {
        version: '1.9.0', sequence: {length: 1000},
        settings: {backgroundColor: 'navy'},
        legend: {items: [{name: 'Existing'}]},
      }});
      const legend = cgv.legend;
      expect(legend.backgroundStyle).toBe('rect');
      expect(legend.backgroundColor).toBe(cgv.settings.backgroundColor);
      expect(legend.toJSON()).not.toHaveProperty('backgroundColor');
      const ctx = legend.ctx;
      ctx.strokeText.mockClear();
      ctx.strokeRect.mockClear();
      ctx.fillRect.mockClear();
      legend.draw();
      expect(ctx.fillRect).toHaveBeenCalledWith(legend.box.x, legend.box.y, legend.box.width, legend.box.height);
      expect(ctx.strokeText).not.toHaveBeenCalled();
      expect(ctx.strokeRect).not.toHaveBeenCalled();
    });

    test.each([
      ['rect', 'canvas'], ['halo', 'canvas'], ['rect', 'map'], ['halo', 'map'],
    ])('repaints an inherited %s background on the %s when map settings change', (style, on) => {
      const legend = cgv.legend;
      const item = legend.addItems({name: 'Inherited'})[0];
      legend.update({backgroundStyle: style, on});
      const ctx = legend.ctx;
      const colors = [];
      const method = style === 'rect' ? 'fillRect' : 'strokeText';
      ctx[method].mockImplementation((...args) => {
        if (style === 'rect' ? args[0] === legend.box.x && args[1] === legend.box.y : args[0] === item.name) {
          colors.push(ctx[style === 'rect' ? 'fillStyle' : 'strokeStyle']);
        }
      });
      cgv.settings.update({backgroundColor: 'rgba(20,40,60,0.25)'});
      expect(colors).toEqual(['rgba(20, 40, 60, 0.25)']);
      expect(legend.backgroundColor).toBe(cgv.settings.backgroundColor);

      colors.length = 0;
      cgv.settings.backgroundColor = 'rgba(50,60,70,0.75)';
      expect(colors).toEqual(['rgba(50, 60, 70, 0.75)']);
      expect(legend.backgroundColor).toBe(cgv.settings.backgroundColor);
    });

    test.each(['rgba(20,40,60,0.25)', 'rgba(20,40,60,0)'])('keeps explicit %s until reset to undefined', color => {
      cgv.settings.backgroundColor = color;
      const legend = cgv.legend;
      legend.update({backgroundStyle: 'halo', backgroundColor: color});
      cgv.settings.backgroundColor = 'black';
      expect(legend.backgroundColor.rgbaString).toBe(color);
      expect(legend.toJSON().backgroundColor).toBe(color);

      legend.update({backgroundColor: undefined});
      expect(legend.backgroundColor).toBe(cgv.settings.backgroundColor);
      expect(legend.toJSON()).not.toHaveProperty('backgroundColor');
      cgv.settings.backgroundColor = 'white';
      expect(legend.backgroundColor).toBe(cgv.settings.backgroundColor);
    });

    test.each([false, true])('preserves inherited and explicit colors across JSON reloads with includeDefaults=%s', includeDefaults => {
      for (const color of [undefined, 'rgba(20,40,60,0.25)', 'rgba(20,40,60,0)']) {
        cgv.legend.update({backgroundStyle: 'halo', backgroundColor: color});
        const json = JSON.parse(JSON.stringify(cgv.io.toJSON({includeDefaults})));
        expect(json.cgview.legend.backgroundStyle).toBe('halo');
        if (color === undefined) {
          expect(json.cgview.legend).not.toHaveProperty('backgroundColor');
        } else {
          expect(json.cgview.legend.backgroundColor).toBe(color);
        }
        cgv.io.loadJSON(json);
        cgv.settings.backgroundColor = 'navy';
        expect(cgv.legend.backgroundStyle).toBe('halo');
        if (color === undefined) {
          expect(cgv.legend.backgroundColor).toBe(cgv.settings.backgroundColor);
        } else {
          expect(cgv.legend.backgroundColor.rgbaString).toBe(color);
        }
      }
    });

    test.each(['invertAllColors', 'invertMapColors'])('preserves inheritance and explicit colors during %s', method => {
      const legend = cgv.legend;
      const item = legend.addItems({name: 'Colors', swatchColor: 'rgba(10,30,50,0.5)'})[0];
      cgv.settings.backgroundColor = 'rgba(20,40,60,0.25)';
      cgv[method]();
      expect(cgv.settings.backgroundColor.rgbaString).toBe('rgba(235,215,195,0.25)');
      expect(legend.backgroundColor).toBe(cgv.settings.backgroundColor);
      expect(legend.toJSON()).not.toHaveProperty('backgroundColor');
      expect(item.fontColor.rgbaString).toBe('rgba(255,255,255,1)');
      expect(item.swatchColor.rgbaString).toBe(method === 'invertAllColors' ? 'rgba(245,225,205,0.5)' : 'rgba(10,30,50,0.5)');
      cgv[method]();
      expect(legend.backgroundColor.rgbaString).toBe('rgba(20,40,60,0.25)');
      expect(item.swatchColor.rgbaString).toBe('rgba(10,30,50,0.5)');

      legend.backgroundColor = 'rgba(10,30,50,0.5)';
      cgv[method]();
      expect(legend.backgroundColor.rgbaString).toBe('rgba(245,225,205,0.5)');
      cgv[method]();
      expect(legend.backgroundColor.rgbaString).toBe('rgba(10,30,50,0.5)');
    });

    test('inverting an inherited legend alone leaves the map background unchanged', () => {
      cgv.settings.backgroundColor = 'rgba(20,40,60,0.25)';
      cgv.legend.invertColors();
      expect(cgv.settings.backgroundColor.rgbaString).toBe('rgba(20,40,60,0.25)');
      expect(cgv.legend.backgroundColor).toBe(cgv.settings.backgroundColor);
      expect(cgv.legend.defaultFontColor.rgbaString).toBe('rgba(255,255,255,1)');
      expect(cgv.legend.toJSON()).not.toHaveProperty('backgroundColor');
    });

    test('updates the style through the public API without changing layout or hit bounds', () => {
      const legend = cgv.legend;
      const item = legend.addItems({name: 'Layout'})[0];
      const bounds = ({x, y, width, height, padding}) => ({x, y, width, height, padding});
      const before = bounds(legend.box);
      const point = {x: item.swatchX() + item.swatchWidth / 2, y: item.swatchY() + item.height / 2};
      const listener = jest.fn();
      cgv.on('legend-update.test', listener);
      legend.update({backgroundStyle: 'halo'});
      expect(legend.backgroundStyle).toBe('halo');
      expect(bounds(legend.box)).toEqual(before);
      expect(item._swatchContainsPoint(point)).toBe(true);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({attributes: {backgroundStyle: 'halo'}}));
      legend.update({backgroundStyle: 'rect'});
      expect(legend.backgroundStyle).toBe('rect');
    });

    test('rejects unsupported styles and keeps a valid default', () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      cgv = new Viewer('#map', {legend: {backgroundStyle: 'outline'}});
      expect(cgv.legend.backgroundStyle).toBe('rect');
      cgv.legend.backgroundStyle = 'halo';
      for (const invalid of ['rectangle', 'outline', '', null, undefined, ['rect', 'halo']]) {
        cgv.legend.backgroundStyle = invalid;
        expect(cgv.legend.backgroundStyle).toBe('halo');
      }
    });

    test.each(['left', 'right'])('draws %s names and outside swatch outlines using each item font and the background RGBA', alignment => {
      const legend = cgv.legend;
      legend.update({backgroundStyle: 'halo', backgroundColor: 'rgba(20,40,60,0.25)', textAlignment: alignment});
      legend.addItems([
        {name: 'Small', font: 'sans-serif,plain,20', swatchColor: 'rgba(100,120,140,0.5)'},
        {name: 'Large', font: 'sans-serif,plain,40'},
        {name: 'Text only', drawSwatch: false},
        {name: 'Hidden', visible: false},
      ]);
      const ctx = legend.ctx;
      const strokes = [];
      const outlines = [];
      ctx.strokeText.mockImplementation((text, x, y) => strokes.push({
        text, x, y, width: ctx.lineWidth, color: ctx.strokeStyle, alignment: ctx.textAlign,
      }));
      ctx.strokeRect.mockImplementation((x, y, width, height) => outlines.push({
        x, y, width, height, lineWidth: ctx.lineWidth, color: ctx.strokeStyle, dash: ctx.getLineDash(),
      }));
      ctx.strokeStyle = 'orange';
      ctx.lineWidth = 9;
      ctx.setLineDash([3, 5]);
      ctx.fillRect.mockClear();
      ctx.clearRect.mockClear();
      legend.draw();

      expect(strokes.map(stroke => stroke.text)).toEqual(['Small', 'Large', 'Text only']);
      expect(strokes.map(stroke => stroke.width)).toEqual([5, 10, 3.5]);
      expect(strokes.every(stroke => stroke.color === 'rgba(20, 40, 60, 0.25)' && stroke.alignment === alignment)).toBe(true);
      expect(outlines).toHaveLength(2);
      expect(ctx.fillRect).toHaveBeenCalledTimes(2);
      expect(ctx.clearRect.mock.calls).toEqual([[0, 0, cgv.width, cgv.height]]);
      outlines.forEach((outline, index) => {
        const item = legend.items(index + 1);
        // The inner edge of each outline meets the swatch without covering it.
        expect(outline.x + outline.lineWidth / 2).toBe(item.swatchX());
        expect(outline.y + outline.lineWidth / 2).toBe(item.swatchY());
        expect(outline.width - outline.lineWidth).toBe(item.swatchWidth);
        expect(outline.height - outline.lineWidth).toBe(item.swatchWidth);
        expect(outline.lineWidth).toBe(strokes[index].width / 2);
        expect(outline.color).toBe(strokes[index].color);
        expect(outline.dash).toEqual([]);
      });
      expect(ctx.strokeStyle).toBe('#ffa500');
      expect(ctx.lineWidth).toBe(9);
      expect(ctx.getLineDash()).toEqual([3, 5]);

      strokes.length = 0;
      outlines.length = 0;
      legend.backgroundColor = 'rgba(20,40,60,0)';
      expect(strokes.every(stroke => stroke.color === 'rgba(20, 40, 60, 0)')).toBe(true);
      expect(outlines.every(outline => outline.color === 'rgba(20, 40, 60, 0)')).toBe(true);
    });

    test.each(['swatchHighlighted', 'swatchSelected'])('keeps the %s indicator visible above the outline', state => {
      const legend = cgv.legend;
      legend.backgroundStyle = 'halo';
      const item = legend.addItems({name: 'Interaction', font: 'sans-serif,plain,40'})[0];
      item[state] = true;
      const ctx = legend.ctx;
      const strokes = [];
      ctx.strokeRect.mockImplementation(() => strokes.push({color: ctx.strokeStyle, width: ctx.lineWidth}));
      legend.draw();
      expect(strokes).toEqual([
        {color: '#ffffff', width: 5},
        {color: state === 'swatchSelected' ? '#000000' : '#808080', width: 1},
      ]);
    });

    test.each(['canvas', 'map'])('repaints underlying captions when a %s legend changes', on => {
      const caption = cgv.addCaptions({name: 'Under', font: 'sans-serif,plain,40', backgroundStyle: 'halo'})[0];
      caption.on = on;
      const legend = cgv.legend;
      const item = legend.addItems({name: 'Over'})[0];
      legend.update({on, backgroundStyle: 'halo', backgroundColor: 'rgba(255,255,255,0.5)'});
      const clearBox = jest.spyOn(legend.box, 'clear');
      const mutations = [
        () => legend.draw(),
        () => { item.name = 'Short'; },
        () => { item.swatchHighlighted = true; legend.draw(); },
        () => { legend.anchor = 'top-left'; },
        () => { legend.position = on === 'canvas' ? 'top-left' : {lengthPercent: 25, mapOffset: 20}; },
        () => { item.visible = false; },
        () => { legend.visible = false; },
        () => item.remove(),
      ];
      for (const mutate of mutations) {
        caption.ctx.fillText.mockClear();
        mutate();
        expect(caption.ctx.fillText.mock.calls.filter(call => call[0] === caption.name)).toHaveLength(1);
      }
      expect(clearBox).not.toHaveBeenCalled();
    });

    test('restores both layers when moving a halo legend between canvas and map', () => {
      const legend = cgv.legend;
      legend.backgroundStyle = 'halo';
      const item = legend.addItems({name: 'Moving halo'})[0];
      const canvas = cgv.canvas.context('canvas');
      const foreground = cgv.canvas.context('foreground');
      for (const on of ['map', 'canvas']) {
        canvas.fillText.mockClear();
        foreground.fillText.mockClear();
        legend.on = on;
        expect(canvas.fillText.mock.calls.filter(call => call[0] === item.name)).toHaveLength(on === 'canvas' ? 1 : 0);
        expect(foreground.fillText.mock.calls.filter(call => call[0] === item.name)).toHaveLength(on === 'map' ? 1 : 0);
      }
    });
  });

  describe('findLegendItemByName', () => {

    test('will find blank name', () => {
      const item_1 = cgv.legend.addItems({name: ''})[0];
      expect(item_1.name).toBe('');
      const item_2 = cgv.legend.findLegendItemByName('');
      expect(item_1.name).toBe(item_2.name);
    });

  });

  describe('defaultDecoration', () => {

    test('defaults to auto and is serialized', () => {
      expect(cgv.legend.defaultDecoration).toBe('auto');
      expect(cgv.legend.toJSON().defaultDecoration).toBe('auto');
    });

    test('can be configured when the viewer is created', () => {
      cgv = new Viewer('#map', {
        legend: {
          defaultDecoration: 'arc',
          items: [{name: 'Inherited'}]
        }
      });

      expect(cgv.legend.defaultDecoration).toBe('arc');
      expect(cgv.legend.items(1).decoration).toBe('arc');
      expect(cgv.legend.items(1).usingDefaultDecoration).toBe(true);
    });

    test('updates items using the default without changing explicit decorations', () => {
      const inheritedItem = cgv.legend.addItems({name: 'Inherited'})[0];
      const explicitItem = cgv.legend.addItems({name: 'Explicit', decoration: 'arc'})[0];

      cgv.legend.update({defaultDecoration: 'arrow'});

      expect(inheritedItem.decoration).toBe('arrow');
      expect(explicitItem.decoration).toBe('arc');
    });

  });

  describe('findLegendItemOrCreate', () => {

    test('uses the legend default when decoration is omitted', () => {
      const item = cgv.legend.findLegendItemOrCreate('Generated');

      expect(item.decoration).toBe('auto');
      expect(item.usingDefaultDecoration).toBe(true);
    });

  });

});
