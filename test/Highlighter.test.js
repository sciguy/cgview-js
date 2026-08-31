import Viewer from '../src/Viewer';

describe('Highlighter', () => {

  let cgv;

  beforeEach(() => {
    document.body.innerHTML = '<div id="map"></div>';
    cgv = new Viewer('#map');
    cgv.highlighter.feature.popovers = false;
  });

  test('keeps visible legends and captions above feature highlights', () => {
    cgv.legend.addItems({name: 'Feature'});
    cgv.legend.refresh();
    const caption = cgv.addCaptions({name: 'Map title'})[0];
    const feature = {highlight: jest.fn()};
    const ctx = cgv.canvas.context('ui');
    const clearRect = jest.spyOn(ctx, 'clearRect');

    cgv.highlighter.mouseOver({
      elementType: 'feature',
      element: feature,
      slot: undefined,
    });

    const legendBox = cgv.legend.box;
    const captionBox = caption.box;
    expect(feature.highlight).toHaveBeenCalledTimes(1);
    expect(clearRect).toHaveBeenCalledWith(
      legendBox.x - 1,
      legendBox.y - 1,
      legendBox.width + 2,
      legendBox.height + 2,
    );
    expect(clearRect).toHaveBeenCalledWith(
      captionBox.x - 1,
      captionBox.y - 1,
      captionBox.width + 2,
      captionBox.height + 2,
    );
  });

  test('does not clear space for hidden overlays', () => {
    cgv.legend.visible = false;
    const caption = cgv.addCaptions({name: 'Hidden', visible: false})[0];
    const ctx = cgv.canvas.context('ui');
    const clearRect = jest.spyOn(ctx, 'clearRect');

    cgv.highlighter.mouseOver({
      elementType: 'feature',
      element: {highlight: jest.fn()},
      slot: undefined,
    });

    expect(clearRect).not.toHaveBeenCalledWith(
      cgv.legend.box.x - 1,
      cgv.legend.box.y - 1,
      cgv.legend.box.width + 2,
      cgv.legend.box.height + 2,
    );
    expect(clearRect).not.toHaveBeenCalledWith(
      caption.box.x - 1,
      caption.box.y - 1,
      caption.box.width + 2,
      caption.box.height + 2,
    );
  });

});
