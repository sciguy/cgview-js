import Plugins from '../src/Plugins';

const createTestPlugin = (overrides = {}) => ({
  name: 'TestPlugin',
  id: 'pluginTest',
  version: '0.1.0',
  type: 'General',
  ...overrides,
});

describe('Plugins', () => {

  test('includes plugins by ID, not name', () => {
    const plugin = createTestPlugin();
    const plugins = new Plugins({}, plugin);

    expect(plugins.includes(plugin.id)).toBe(true);
    expect(plugins.includes(plugin.name)).toBe(false);
  });

  test('rejects duplicate plugin IDs before installation', () => {
    const firstPlugin = createTestPlugin({name: 'FirstPlugin'});
    const install = jest.fn();
    const duplicatePlugin = createTestPlugin({name: 'DuplicatePlugin', install});

    expect(() => new Plugins({}, [firstPlugin, duplicatePlugin]))
      .toThrow(`Plugin '${firstPlugin.id}' is already installed.`);
    expect(install).not.toHaveBeenCalled();
  });

  test('allows matching plugin names when IDs are unique', () => {
    const firstPlugin = createTestPlugin({id: 'pluginFirst'});
    const secondPlugin = createTestPlugin({id: 'pluginSecond'});
    const plugins = new Plugins({}, [firstPlugin, secondPlugin]);

    expect(plugins.includes(firstPlugin.id)).toBe(true);
    expect(plugins.includes(secondPlugin.id)).toBe(true);
  });

  test.each([
    ['name', /name/i],
    ['id', /ID/],
    ['version', /version/i],
    ['type', /type/i],
  ])('rejects a plugin without a %s', (property, errorPattern) => {
    const plugin = createTestPlugin();
    delete plugin[property];

    expect(() => new Plugins({}, plugin)).toThrow(errorPattern);
  });

});
