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

  describe('findLegendItemByName', () => {

    test('will find blank name', () => {
      const item_1 = cgv.legend.addItems({name: ''})[0];
      expect(item_1.name).toBe('');
      const item_2 = cgv.legend.findLegendItemByName('');
      expect(item_1.name).toBe(item_2.name);
    });

  });

  describe('defaultDecoration', () => {

    test('defaults to auto and is serialized', () => {
      expect(cgv.legend.defaultDecoration).toBe('auto');
      expect(cgv.legend.toJSON().defaultDecoration).toBe('auto');
    });

    test('can be configured when the viewer is created', () => {
      cgv = new Viewer('#map', {
        legend: {
          defaultDecoration: 'arc',
          items: [{name: 'Inherited'}]
        }
      });

      expect(cgv.legend.defaultDecoration).toBe('arc');
      expect(cgv.legend.items(1).decoration).toBe('arc');
      expect(cgv.legend.items(1).usingDefaultDecoration).toBe(true);
    });

    test('updates items using the default without changing explicit decorations', () => {
      const inheritedItem = cgv.legend.addItems({name: 'Inherited'})[0];
      const explicitItem = cgv.legend.addItems({name: 'Explicit', decoration: 'arc'})[0];

      cgv.legend.update({defaultDecoration: 'arrow'});

      expect(inheritedItem.decoration).toBe('arrow');
      expect(explicitItem.decoration).toBe('arc');
    });

  });

  describe('findLegendItemOrCreate', () => {

    test('uses the legend default when decoration is omitted', () => {
      const item = cgv.legend.findLegendItemOrCreate('Generated');

      expect(item.decoration).toBe('auto');
      expect(item.usingDefaultDecoration).toBe(true);
    });

  });

});
