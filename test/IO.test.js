import Viewer from '../src/Viewer';
import IO from '../src/IO';

describe('IO', () => {

  beforeAll(() => {
    // Set up document body to have a div for the map
    document.body.innerHTML = '<div id="map"></div>';
  });

  beforeEach(() => {
    cgv = new Viewer('#map');
  });

  describe('loadJSON', () => {

    test('load JSON object literal', () => {
      const json = { cgview: { version: '1.7.0', sequence: { length: 1234 } } };
      expect(cgv.sequence.length).toBe(1000); // The default
      cgv.io.loadJSON(json);
      expect(cgv.sequence.length).toBe(1234);
    });

    test('load JSON string', () => {
      const json = "{\"cgview\":{\"version\":\"1.7.0\",\"sequence\":{\"length\":1234}}}";
      expect(cgv.sequence.length).toBe(1000); // The default
      cgv.io.loadJSON(json);
      expect(cgv.sequence.length).toBe(1234);
    });

    test('throws an error if no "cgview" property present', () => {
      const json = { sequence: { length: 1234 } };
      expect( () => cgv.io.loadJSON(json) ).toThrow("No 'cgview' property found in JSON.");;
    });

  });

  describe('getSVG', () => {

    test('resumes an in-progress canvas draw after the temporary SVG render', () => {
      const SVGContext = function() {
        const context = document.createElement('canvas').getContext('2d');
        context.getSerializedSvg = () => '<svg></svg>';
        return context;
      };
      const viewer = new Viewer('#map', {SVGContext});
      const originalLayers = viewer.canvas._layers;
      if (viewer.layout._slotTimeoutID !== undefined) {
        clearTimeout(viewer.layout._slotTimeoutID);
      }
      const pendingSlotDraw = setTimeout(() => {}, 1000);
      viewer.layout._slotTimeoutID = pendingSlotDraw;
      const drawFull = jest.spyOn(viewer, 'drawFull').mockImplementation(() => {});

      try {
        expect(viewer.io.getSVG()).toBe('<svg></svg>');
        expect(viewer.canvas._layers).toBe(originalLayers);
        expect(drawFull).toHaveBeenCalledTimes(1);
      } finally {
        clearTimeout(pendingSlotDraw);
        viewer.layout._slotTimeoutID = undefined;
      }
    });

    test('does not start a new canvas draw when no progressive draw was active', () => {
      const SVGContext = function() {
        const context = document.createElement('canvas').getContext('2d');
        context.getSerializedSvg = () => '<svg></svg>';
        return context;
      };
      const viewer = new Viewer('#map', {SVGContext});
      const drawFull = jest.spyOn(viewer, 'drawFull').mockImplementation(() => {});

      expect(viewer.layout.fullDrawInProgress).toBe(false);
      expect(viewer.io.getSVG()).toBe('<svg></svg>');
      expect(drawFull).not.toHaveBeenCalled();
    });

    test('restores live canvas layers when SVG serialization throws', () => {
      const SVGContext = function() {
        const context = document.createElement('canvas').getContext('2d');
        context.getSerializedSvg = () => { throw new Error('SVG serialization failed'); };
        return context;
      };
      const viewer = new Viewer('#map', {SVGContext});
      const originalLayers = viewer.canvas._layers;

      expect(() => viewer.io.getSVG()).toThrow('SVG serialization failed');
      expect(viewer.canvas._layers).toBe(originalLayers);
    });

  });

});
