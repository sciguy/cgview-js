import Viewer from '../src/Viewer';
import utils from '../src/Utils';

describe('LayoutCircular paths', () => {

  beforeEach(() => {
    document.body.innerHTML = '<div id="map"></div>';
  });

  test('uses sagitta-limited polylines for Safari canvas arcs', () => {
    const safari = jest.spyOn(utils, 'isSafari').mockReturnValue(true);

    try {
      const cgv = new Viewer('#map', {sequence: {length: 10000}});
      const context = cgv.canvas.context('map');
      context.arc.mockClear();
      context.moveTo.mockClear();
      context.lineTo.mockClear();

      cgv.layout.delegate.path('map', 10000, 1000, 2000);

      expect(safari).toHaveBeenCalledTimes(1);
      expect(context.arc).not.toHaveBeenCalled();
      expect(context.moveTo).toHaveBeenCalledTimes(1);
      expect(context.lineTo.mock.calls.length).toBeGreaterThan(1);

      const centerX = cgv.scale.x(0);
      const centerY = cgv.scale.y(0);
      const first = context.moveTo.mock.calls[0];
      const second = context.lineTo.mock.calls[0];
      const chordMidX = (first[0] + second[0]) / 2;
      const chordMidY = (first[1] + second[1]) / 2;
      const midpointRadius = Math.hypot(chordMidX - centerX, chordMidY - centerY);
      const sagitta = 10000 - midpointRadius;
      expect(sagitta).toBeLessThanOrEqual((0.25 / cgv.canvas.pixelRatio) + 0.000001);
    } finally {
      safari.mockRestore();
    }
  });

  test('does not relax the sagitta limit for long, large-radius paths', () => {
    const safari = jest.spyOn(utils, 'isSafari').mockReturnValue(true);

    try {
      const cgv = new Viewer('#map', {sequence: {length: 10000}});
      const context = cgv.canvas.context('map');
      context.moveTo.mockClear();
      context.lineTo.mockClear();

      cgv.layout.delegate.path('map', 100000, 1, 5000);

      expect(safari).toHaveBeenCalledTimes(1);
      const centerX = cgv.scale.x(0);
      const centerY = cgv.scale.y(0);
      const first = context.moveTo.mock.calls[0];
      const second = context.lineTo.mock.calls[0];
      const chordMidX = (first[0] + second[0]) / 2;
      const chordMidY = (first[1] + second[1]) / 2;
      const midpointRadius = Math.hypot(chordMidX - centerX, chordMidY - centerY);
      const sagitta = 100000 - midpointRadius;

      expect(context.lineTo.mock.calls.length).toBeGreaterThan(512);
      expect(sagitta).toBeLessThanOrEqual((0.25 / cgv.canvas.pixelRatio) + 0.000001);
    } finally {
      safari.mockRestore();
    }
  });

  test('keeps native arcs in browsers without the Safari precision bug', () => {
    const safari = jest.spyOn(utils, 'isSafari').mockReturnValue(false);

    try {
      const cgv = new Viewer('#map', {sequence: {length: 10000}});
      const context = cgv.canvas.context('map');
      context.arc.mockClear();

      cgv.layout.delegate.path('map', 10000, 1000, 2000);
      expect(safari).toHaveBeenCalledTimes(1);
      expect(context.arc).toHaveBeenCalledTimes(1);
    } finally {
      safari.mockRestore();
    }
  });

  test('forces the Safari arc workaround when requested', () => {
    const safari = jest.spyOn(utils, 'isSafari').mockReturnValue(false);

    try {
      const cgv = new Viewer('#map', {
        sequence: {length: 10000},
        useSafariArcWorkaround: true
      });
      const context = cgv.canvas.context('map');
      context.arc.mockClear();
      context.moveTo.mockClear();
      context.lineTo.mockClear();

      cgv.layout.delegate.path('map', 10000, 1000, 2000);

      expect(context.arc).not.toHaveBeenCalled();
      expect(context.moveTo).toHaveBeenCalledTimes(1);
      expect(context.lineTo.mock.calls.length).toBeGreaterThan(1);
    } finally {
      safari.mockRestore();
    }
  });

  test('disables the Safari arc workaround when requested', () => {
    const safari = jest.spyOn(utils, 'isSafari').mockReturnValue(true);

    try {
      const cgv = new Viewer('#map', {
        sequence: {length: 10000},
        useSafariArcWorkaround: false
      });
      const context = cgv.canvas.context('map');
      context.arc.mockClear();

      cgv.layout.delegate.path('map', 10000, 1000, 2000);

      expect(context.arc).toHaveBeenCalledTimes(1);
    } finally {
      safari.mockRestore();
    }
  });

});
