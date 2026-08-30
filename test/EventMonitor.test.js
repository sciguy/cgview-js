import Viewer from '../src/Viewer';

describe('EventMonitor', () => {

  let cgv;

  beforeEach(() => {
    document.body.innerHTML = '<div id="map"></div>';
    cgv = new Viewer('#map');
  });

  test('clears transient hover state when the pointer leaves the viewer', () => {
    const listener = jest.fn();
    const uiCanvas = cgv.canvas.node('ui');
    cgv.on('mouseleave.test', listener);
    cgv.eventMonitor._mouse = {elementType: 'feature'};
    cgv.highlighter.showPopoverBox({
      html: 'Feature popover',
      position: {x: 10, y: 10}
    });
    cgv.clear = jest.fn();

    uiCanvas.dispatchEvent(new MouseEvent('mouseleave'));

    expect(cgv.mouse).toBeUndefined();
    expect(cgv.clear).toHaveBeenCalledWith('ui');
    expect(cgv.highlighter.popoverBox.style('visibility')).toBe('hidden');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('clears a highlighted legend swatch when the pointer leaves the viewer', () => {
    const legendItem = cgv.legend.addItems({name: 'Feature'})[0];
    legendItem.swatchHighlighted = true;
    cgv.canvas.cursor = 'pointer';
    cgv.legend.draw = jest.fn();

    cgv.canvas.node('ui').dispatchEvent(new MouseEvent('mouseleave'));

    expect(cgv.legend.highlightedSwatchedItem).toBeUndefined();
    expect(cgv.canvas.cursor).toBe('auto');
    expect(cgv.legend.draw).toHaveBeenCalledTimes(1);
  });

});
