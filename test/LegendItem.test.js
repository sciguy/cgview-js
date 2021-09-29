import Viewer from '../src/Viewer';

describe('LegendItem', () => {

  beforeAll(() => {
    // Set up document body to have a div for the map
    document.body.innerHTML = '<div id="map"></div>';
  });

  beforeEach(() => {
    cgv = new Viewer('#map');
    // Turn off console.log
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('name', () => {

    test('adding duplicate name will increment name', () => {
      cgv.legend.addItems([{name: 'CDS'}, {name: 'bob'}, {name: 'CDS'}]);
      const names = cgv.legend.items().map( i => i.name);
      expect(names).toEqual(['CDS', 'bob', 'CDS-2']);
    });

    test('updating with a duplicate name will increment name', () => {
      cgv.legend.addItems([{name: 'CDS'}, {name: 'bob'}]);
      // const names = cgv.legend.items().map( i => i.name);
      const item = cgv.legend.items().last;
      expect(item.name).toBe('bob');
      item.update({name: 'CDS'});
      expect(item.name).toBe('CDS-2');
    });

  });

});


