import Color from '../src/Color';
import Viewer from '../src/Viewer';

const savedMap = viewer => JSON.parse(JSON.stringify(viewer.io.toJSON()));

describe('Automatic border colors', () => {
  let cgv;

  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '<div id="map"></div><div id="loaded-map"></div>';
    cgv = new Viewer('#map');
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test.each([{}, {borderColor: undefined}, {borderColor: null}])(
    'initializes and reloads automatic border settings: %j', settings => {
      const loaded = new Viewer('#loaded-map', {settings});
      expect(loaded.settings.borderColor).toBeUndefined();
      expect(loaded.settings.showBorder).toBe(false);
      const json = savedMap(loaded);
      expect(json.cgview.settings.borderColor).toBeNull();
      cgv.io.loadJSON(json);
      expect(cgv.settings.borderColor).toBeUndefined();
    },
  );

  test.each([undefined, null])('resets an explicit border with %s and redraws', borderColor => {
    cgv.settings.update({borderColor: '#123456'});
    const drawFull = jest.spyOn(cgv, 'drawFull');
    const updated = jest.fn();
    cgv.on('settings-update.border-color', updated);
    cgv.settings.update({borderColor});
    expect(cgv.settings.borderColor).toBeUndefined();
    expect(drawFull).toHaveBeenCalled();
    expect(updated).toHaveBeenCalledWith(expect.objectContaining({attributes: {borderColor}}));
    expect(cgv.settings.toJSON().borderColor).toBeNull();
  });

  test('retains explicit colors and their opacity through JSON reload', () => {
    const border = new Color('rgba(12,34,56,0.4)');
    cgv.settings.borderColor = border;
    expect(cgv.settings.borderColor).toBe(border);
    const json = savedMap(cgv);
    expect(json.cgview.settings.borderColor).toBe(border.rgbaString);
    cgv.io.loadJSON(json);
    expect(cgv.settings.borderColor.rgbaString).toBe(border.rgbaString);
  });

  test.each(['circular', 'linear'])('uses each feature legend color on a %s map', format => {
    cgv.settings.update({
      format, showBorder: true, showShading: false, adaptiveBorderThickness: false,
    });
    cgv.legend.addItems([
      {name: 'red', swatchColor: 'red'},
      {name: 'blue', swatchColor: 'blue'},
    ]);
    const features = cgv.addFeatures([
      {name: 'first', start: 100, stop: 200, legend: 'red'},
      {name: 'second', start: 300, stop: 400, legend: 'blue'},
    ]);
    const context = cgv.canvas.context('map');
    const borderFor = feature => {
      feature.draw('map', 100, 20, feature.mapRange);
      return new Color(context.strokeStyle).rgbaString;
    };
    expect(features.map(borderFor)).toEqual(['rgba(128,0,0,1)', 'rgba(0,0,128,1)']);
    expect(features[0].color.rgbaString).toBe('rgba(255,0,0,1)');
    features[0].legendItem.update({swatchColor: 'rgba(200,100,40,0.4)'});
    expect(borderFor(features[0])).toBe('rgba(100,50,20,0.4)');
    cgv.settings.update({backgroundColor: 'black'});
    expect(borderFor(features[0])).toBe('rgba(228,178,148,0.4)');
  });

  test.each(['circular', 'linear'])('uses alternating backbone fills on a %s map', format => {
    const viewer = new Viewer('#loaded-map', {
      settings: {showBorder: true, showShading: false, adaptiveBorderThickness: false},
      sequence: {contigs: [{length: 1000}, {length: 1000}]},
      backbone: {color: 'rgba(200,100,40,0.4)', colorAlternate: 'blue'},
    });
    viewer.settings.update({format});
    const context = viewer.canvas.context('map');
    const borders = [];
    jest.spyOn(context, 'stroke').mockImplementation(() => {
      borders.push(new Color(context.strokeStyle).rgbaString);
    });
    viewer.backbone.draw();
    expect(borders.sort()).toEqual(['rgba(0,0,128,1)', 'rgba(100,50,20,0.4)']);
    viewer.settings.backgroundColor = 'black';
    borders.length = 0;
    viewer.backbone.draw();
    expect(borders.sort()).toEqual(['rgba(128,128,255,1)', 'rgba(228,178,148,0.4)']);
  });

  test.each(['invertMapColors', 'invertAllColors'])('%s preserves automatic mode', method => {
    expect(cgv.settings.borderColor).toBeUndefined();
    cgv[method]();
    expect(cgv.settings.borderColor).toBeUndefined();
    expect(cgv.settings.backgroundColor.rgbaString).toBe('rgba(0,0,0,1)');
    cgv.settings.update({borderColor: '#123456'});
    cgv[method]();
    expect(cgv.settings.borderColor.rgbaString).toBe(new Color('#123456').invert().rgbaString);
  });
});
