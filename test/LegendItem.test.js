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

  describe('decoration', () => {

    test('inherits and omits the legend default from JSON', () => {
      const item = cgv.legend.addItems({name: 'CDS'})[0];

      expect(item.decoration).toBe('auto');
      expect(item.usingDefaultDecoration).toBe(true);
      expect(item.toJSON()).not.toHaveProperty('decoration');
      expect(item.toJSON({includeDefaults: true}).decoration).toBe('auto');
    });

    test('accepts and serializes auto', () => {
      const item = cgv.legend.addItems({name: 'CDS', decoration: 'arc'})[0];

      item.update({decoration: 'auto'});

      expect(item.decoration).toBe('auto');
      expect(item.toJSON().decoration).toBe('auto');
    });

    test('can clear an explicit decoration to restore inheritance', () => {
      const item = cgv.legend.addItems({name: 'CDS', decoration: 'arc'})[0];

      item.update({decoration: undefined});

      expect(item.decoration).toBe('auto');
      expect(item.usingDefaultDecoration).toBe(true);
      expect(item.toJSON()).not.toHaveProperty('decoration');
    });

  });

});
