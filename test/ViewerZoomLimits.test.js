import * as d3 from 'd3';
import Viewer from '../src/Viewer';

describe.each(['circular', 'linear'])('Overview zoom limits in %s maps', format => {
  let viewer;

  beforeEach(() => {
    viewer = undefined;
    document.body.innerHTML = '<div id="map"></div>';
  });

  afterEach(() => {
    if (viewer) {
      d3.select(viewer.canvas.node('ui')).interrupt();
      viewer.selection.detach();
    }
  });

  function createViewer(length, width = 800, height = 600) {
    viewer = new Viewer('#map', {width, height, sequence: {length}});
    viewer.format = format;
    return viewer;
  }

  function resetToOverview() {
    return new Promise(resolve => {
      viewer.on('zoom-end.test', resolve);
      viewer.reset(0);
    });
  }

  test.each([6, 30])('reset restores overview for a %i bp sequence', async length => {
    createViewer(length);
    viewer.zoomFactor = viewer.minZoomFactor;
    await resetToOverview();

    expect(viewer.zoomFactor).toBe(1);
    expect(d3.zoomTransform(viewer.canvas.node('ui')).k).toBe(1);
    expect(viewer._zoom.scaleExtent()[1]).toBeGreaterThanOrEqual(1);
  });

  test('enlarging the canvas keeps overview reachable', async () => {
    createViewer(60, 200, 200);
    expect(viewer.maxZoomFactor).toBeGreaterThan(1);

    viewer.resize(2000, 1600);
    await resetToOverview();

    expect(viewer.zoomFactor).toBe(1);
    expect(viewer.maxZoomFactor).toBe(1);
  });

  test('larger sequences still allow detail zoom and reset', async () => {
    createViewer(10000);
    viewer.zoomFactor = 10;
    expect(viewer.zoomFactor).toBe(10);

    await resetToOverview();
    expect(viewer.zoomFactor).toBe(1);
    expect(viewer.maxZoomFactor).toBeGreaterThan(10);
  });
});
