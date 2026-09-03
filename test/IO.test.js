import Viewer from '../src/Viewer';

describe('IO', () => {

  let cgv;

  beforeEach(() => {
    document.body.innerHTML = '<div id="map"></div>';
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

    test('loads legacy annotation JSON with external labels by default', () => {
      const json = {
        cgview: {
          version: '1.8.0',
          sequence: {length: 1234},
          annotation: {font: 'sans-serif,plain,12'},
        },
      };

      cgv.io.loadJSON(json);

      expect(cgv.annotation.labelPosition).toBe('external');
      expect(cgv.annotation.inlineLabelMinFontSize).toBe(8);
      expect(cgv.annotation.inlineLabelPadding).toBe(2);
    });

    test('round trips inline annotation settings through CGView JSON', () => {
      document.body.innerHTML = '<div id="map"></div><div id="second-map"></div>';
      const firstViewer = new Viewer('#map', {
        annotation: {
          labelPosition: 'both',
          inlineLabelMinFontSize: 7,
          inlineLabelPadding: 4,
          inlineLabelColor: 'navy',
        },
      });
      const secondViewer = new Viewer('#second-map');

      secondViewer.io.loadJSON(firstViewer.io.toJSON());

      expect(secondViewer.annotation.toJSON()).toEqual(firstViewer.annotation.toJSON());
      expect(secondViewer.annotation.labelPosition).toBe('both');
      expect(secondViewer.annotation.inlineLabelColor.rgbaString).toBe('rgba(0,0,128,1)');
    });

  });

  describe('exports', () => {

    const SVGContext = function() {
      const context = document.createElement('canvas').getContext('2d');
      context.getSerializedSvg = () => '<svg></svg>';
      return context;
    };

    const setPendingDraw = (viewer) => {
      if (viewer.layout._slotTimeoutID !== undefined) {
        clearTimeout(viewer.layout._slotTimeoutID);
      }
      const timeoutID = setTimeout(() => {}, 1000);
      viewer.layout._slotTimeoutID = timeoutID;
      return () => {
        clearTimeout(timeoutID);
        viewer.layout._slotTimeoutID = undefined;
      };
    };

    test('resumes an in-progress Canvas draw after SVG export', () => {
      cgv.externals.SVGContext = SVGContext;
      const originalLayers = cgv.canvas._layers;
      const clearPendingDraw = setPendingDraw(cgv);
      const drawFull = jest.spyOn(cgv, 'drawFull').mockImplementation(() => {});

      try {
        expect(cgv.io.getSVG()).toBe('<svg></svg>');
        expect(cgv.canvas._layers).toBe(originalLayers);
        expect(drawFull).toHaveBeenCalledTimes(1);
      } finally {
        clearPendingDraw();
      }
    });

    test('resumes an in-progress Canvas draw after PNG export', () => {
      const originalLayers = cgv.canvas._layers;
      const clearPendingDraw = setPendingDraw(cgv);
      const drawFull = jest.spyOn(cgv, 'drawFull').mockImplementation(() => {});
      cgv.io.download = jest.fn();

      try {
        cgv.io.downloadImage();
        expect(cgv.canvas._layers).toBe(originalLayers);
        expect(drawFull).toHaveBeenCalledTimes(1);
      } finally {
        clearPendingDraw();
      }
    });

    test('does not restart a Canvas draw when the viewer was settled', () => {
      cgv.externals.SVGContext = SVGContext;
      const drawFull = jest.spyOn(cgv, 'drawFull').mockImplementation(() => {});

      expect(cgv.layout.fullDrawInProgress).toBe(false);
      expect(cgv.io.getSVG()).toBe('<svg></svg>');
      expect(drawFull).not.toHaveBeenCalled();
    });

    test('restores live layers when export rendering throws', () => {
      cgv.externals.SVGContext = SVGContext;
      const originalLayers = cgv.canvas._layers;
      jest.spyOn(cgv, 'drawExport').mockImplementation(() => {
        throw new Error('Export rendering failed');
      });

      expect(() => cgv.io.getSVG()).toThrow('Export rendering failed');
      expect(cgv.canvas._layers).toBe(originalLayers);
    });

    test('renders inline feature labels through the SVG canvas context', () => {
      let svgContext;
      cgv.externals.SVGContext = function() {
        svgContext = document.createElement('canvas').getContext('2d');
        svgContext.getSerializedSvg = () => '<svg></svg>';
        return svgContext;
      };
      cgv.annotation.update({labelPosition: 'inline'});
      cgv.addFeatures([{name: 'svg label', source: 'test', start: 100, stop: 900, legend: 'Feature'}]);
      cgv.addTracks({
        dataType: 'feature',
        dataMethod: 'source',
        dataKeys: 'test',
        position: 'outside',
      });

      expect(cgv.io.getSVG()).toBe('<svg></svg>');
      expect(svgContext.fillText.mock.calls.map(call => call[0]))
        .toEqual(expect.arrayContaining(Array.from('svg label')));
    });

  });

});
