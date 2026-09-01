import Viewer from '../src/Viewer';
import CGRange from '../src/CGRange';

describe('Feature', () => {

  beforeAll(() => {
    // Set up document body to have a div for the map
    document.body.innerHTML = '<div id="map"></div>';
  });

  beforeEach(() => {
    cgv = new Viewer('#map', {
      sequence: {
        contigs: [
          { name: 'contig_1', length: 100 },
          { name: 'contig_2', length: 100 },
        ],
      },
    });
  });

  describe('contrained positions', () => {

    test('for stop', () => {
      const feature = cgv.addFeatures([
        {name: 'f1', contig: 'contig_1', start: 10, stop: 120},
      ])[0];
      expect(feature.start).toEqual(10);
      expect(feature.stop).toEqual(100);
    });

    test('for start and stop', () => {
      const feature = cgv.addFeatures([
        {name: 'f2', contig: 'contig_1', start: 130, stop: 150},
      ])[0];
      expect(feature.start).toEqual(100);
      expect(feature.stop).toEqual(100);
    });

  });

  describe('feature on contigs', () => {

    beforeEach(() => {
      cgv.addFeatures([
        {name: 'f1', contig: 'contig_1', start: 10, stop: 20},
        {name: 'f2', contig: 'contig_2', start: 30, stop: 50},
      ]);
    });

    test('can be added', () => {
      expect(cgv.features().length).toEqual(2);
      expect(cgv.features(2).start).toEqual(30);
      expect(cgv.features(2).stop).toEqual(50);
    });

    test('have different mapContig positions', () => {
      expect(cgv.features(2).mapStart).toEqual(130);
      expect(cgv.features(2).mapStop).toEqual(150);
    });

    test('will belong to the contig it was added with', () => {
      expect(cgv.features(1).contig).toEqual(cgv.contigs(1));
      expect(cgv.features(2).contig).toEqual(cgv.contigs(2));
    });

    test('will move with the contigs', () => {
      cgv.contigs(2).move(0);
      expect(cgv.features(2).start).toEqual(30);
      expect(cgv.features(2).stop).toEqual(50);
      expect(cgv.features(2).mapStart).toEqual(30);
      expect(cgv.features(2).mapStop).toEqual(50);
    });

    test('can be moved to mapContig', () => {
      const feature = cgv.features(2);
      feature.moveToMapContig();
      expect(feature.contig.cgvID).toEqual(cgv.sequence.mapContig.cgvID);
      expect(feature.start).toEqual(130);
      expect(feature.stop).toEqual(150);
      expect(feature.mapStart).toEqual(130);
      expect(feature.mapStop).toEqual(150);
    });

  });

  describe('feature without contig', () => {

    beforeEach(() => {
      cgv.addFeatures([
        {name: 'f1', start: 10, stop: 20},
        {name: 'f2', start: 130, stop: 150},
      ]);
    });

    test('can be added', () => {
      expect(cgv.features().length).toEqual(2);
      expect(cgv.features(2).start).toEqual(130);
      expect(cgv.features(2).stop).toEqual(150);
    });

    test('have the same mapContig positions', () => {
      expect(cgv.features(2).mapStart).toEqual(130);
      expect(cgv.features(2).mapStop).toEqual(150);
    });

    test('will belong to the mapContig', () => {
      expect(cgv.features(1).contig).toEqual(cgv.sequence.mapContig);
      expect(cgv.features(2).contig).toEqual(cgv.sequence.mapContig);
    });

    test('will NOT move with the contigs', () => {
      cgv.contigs(2).move(0);
      expect(cgv.features(2).start).toEqual(130);
      expect(cgv.features(2).stop).toEqual(150);
      expect(cgv.features(2).mapStart).toEqual(130);
      expect(cgv.features(2).mapStop).toEqual(150);
      expect(cgv.features(2).contig).toEqual(cgv.sequence.mapContig);
    });

    test('can be moved to a contig', () => {
      const feature = cgv.features(2);
      feature.moveToContig();
      expect(feature.contig.cgvID).toEqual(cgv.contigs(2).cgvID);
      expect(feature.start).toEqual(30);
      expect(feature.stop).toEqual(50);
      expect(feature.mapStart).toEqual(130);
      expect(feature.mapStop).toEqual(150);
    });

  });

  describe('visible-range clipping', () => {

    let viewer;

    beforeEach(() => {
      viewer = new Viewer('#map', {
        sequence: {length: 360},
        legend: {items: [
          {name: 'Replication', swatchColor: 'blue', decoration: 'arrow'},
          {name: 'Regulation', swatchColor: 'orange', decoration: 'arrow'},
        ]},
      });
    });

    test('never extends a feature beyond its real coordinates for a wrapped viewport', () => {
      const feature = viewer.addFeatures([
        {name: 'DNA polymerase', start: 12, stop: 104, strand: 1, legend: 'Replication'},
      ])[0];
      const visibleRange = new CGRange(viewer.sequence.mapContig, 350, 60);
      const drawElement = jest.spyOn(viewer.canvas, 'drawElement').mockImplementation(() => {});

      feature.drawRange(feature.mapRange, 'map', 100, 20, visibleRange);

      expect(drawElement).toHaveBeenCalledTimes(1);
      expect(drawElement).toHaveBeenCalledWith(expect.objectContaining({
        start: 12,
        stop: 104,
        color: feature.color.rgbaString,
        decoration: 'clockwise-arrow',
      }));
    });

    test('splits wrapped visibility into bounded linear feature segments', () => {
      const feature = viewer.addFeatures([
        {name: 'long regulator', start: 10, stop: 350, strand: 1, legend: 'Regulation'},
      ])[0];
      const visibleRange = new CGRange(viewer.sequence.mapContig, 350, 60);

      expect(feature._drawSegmentsForRange(feature.mapRange, visibleRange)).toEqual([
        [10, 160],
        [250, 350],
      ]);
    });

    test('uses arcs at clipping boundaries and keeps the arrow at the true endpoint', () => {
      const feature = viewer.addFeatures([
        {name: 'long regulator', start: 10, stop: 350, strand: 1, legend: 'Regulation'},
      ])[0];
      const visibleRange = new CGRange(viewer.sequence.mapContig, 350, 60);
      const drawElement = jest.spyOn(viewer.canvas, 'drawElement').mockImplementation(() => {});

      feature.drawRange(feature.mapRange, 'map', 100, 20, visibleRange);

      expect(drawElement.mock.calls.map(call => ({
        start: call[0].start,
        stop: call[0].stop,
        decoration: call[0].decoration,
      }))).toEqual([
        {start: 10, stop: 160, decoration: 'arc'},
        {start: 250, stop: 350, decoration: 'clockwise-arrow'},
      ]);
    });

    test('keeps a reverse arrow only on the segment containing the true start', () => {
      const feature = viewer.addFeatures([
        {name: 'reverse regulator', start: 10, stop: 350, strand: -1, legend: 'Regulation'},
      ])[0];
      const visibleRange = new CGRange(viewer.sequence.mapContig, 350, 60);
      const drawElement = jest.spyOn(viewer.canvas, 'drawElement').mockImplementation(() => {});

      feature.drawRange(feature.mapRange, 'map', 100, 20, visibleRange);

      expect(drawElement.mock.calls.map(call => call[0].decoration)).toEqual([
        'counterclockwise-arrow',
        'arc',
      ]);
    });

    test('does not draw a feature outside an ordinary visible range and margin', () => {
      const feature = viewer.addFeatures([
        {name: 'distant feature', start: 10, stop: 50, strand: 1, legend: 'Replication'},
      ])[0];
      const visibleRange = new CGRange(viewer.sequence.mapContig, 200, 240);
      const drawElement = jest.spyOn(viewer.canvas, 'drawElement').mockImplementation(() => {});

      feature.drawRange(feature.mapRange, 'map', 100, 20, visibleRange);

      expect(drawElement).not.toHaveBeenCalled();
    });

    test('preserves an unclipped arrow at its biological endpoint', () => {
      const feature = viewer.addFeatures([
        {name: 'visible feature', start: 120, stop: 150, strand: 1, legend: 'Replication'},
      ])[0];
      const visibleRange = new CGRange(viewer.sequence.mapContig, 100, 180);
      const drawElement = jest.spyOn(viewer.canvas, 'drawElement').mockImplementation(() => {});

      feature.drawRange(feature.mapRange, 'map', 100, 20, visibleRange);

      expect(drawElement).toHaveBeenCalledTimes(1);
      expect(drawElement).toHaveBeenCalledWith(expect.objectContaining({
        start: 120,
        stop: 150,
        decoration: 'clockwise-arrow',
      }));
    });

    test('splits a wrapped feature on a full-map linear view without an arrowhead at the split', () => {
      viewer.format = 'linear';
      const feature = viewer.addFeatures([
        {name: 'origin-spanning feature', start: 320, stop: 40, strand: 1, legend: 'Replication'},
      ])[0];
      const visibleRange = new CGRange(viewer.sequence.mapContig, 1, 360);
      const drawElement = jest.spyOn(viewer.canvas, 'drawElement').mockImplementation(() => {});

      feature.drawRange(feature.mapRange, 'map', 100, 20, visibleRange);

      expect(drawElement.mock.calls.map(call => ({
        start: call[0].start,
        stop: call[0].stop,
        decoration: call[0].decoration,
      }))).toEqual([
        {start: 320, stop: 360, decoration: 'arc'},
        {start: 1, stop: 40, decoration: 'clockwise-arrow'},
      ]);
    });

  });

});
