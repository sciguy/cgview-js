//////////////////////////////////////////////////////////////////////////////
// CGView Standard Builtin Plugins Export
//////////////////////////////////////////////////////////////////////////////

/**
 * CGView.js – Interactive Circular Genome Viewer
 * Copyright © 2016–2026 Jason R. Grant
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import CaptionTrackList from './PluginCaptionTrackList';
/**
 * PluginsStandard is a collection of default plugins that are included with the CGview.
 * These plugins are installed when the CGview is created.
 *
 * Currently, the following plugins are included:
 * - CaptionTrackList
 */
export const PluginsStandard = [
  CaptionTrackList,
];

//////////////////////////////////////////////////////////////////////////////
// CGview Plugins
//////////////////////////////////////////////////////////////////////////////

/**
 * Plugins is the class that manages the plugins for the CGview. It allows
 * plugins to be added to the viewer and manages the installation and
 * uninstallation of the plugins.
 *
 * There are methods for adding plugins, checking if a plugin is included,
 * and getting or settings the options for a particular plugin.
 *
 * Plugins are objects with the following properties:
 * 
 * Required plugin properties:
 * - name: typically the class name (e.g. CaptionTrackList)
 * - id:
 *   - unique identifier for the plugin (case-sensitive)
 *   - typically starts with plugin (e.g. pluginCaptionTrackList)
 * - version: (NIY) version number of the plugin
 * - type: (NIY) type of plugin (e.g. General, CaptionDynamicText, LabelPlacement, SVGContext)
 *
 * Optional plugin methods:
 * - install: function(cgv) {}
 *   - This function will be called when the plugin is installed.
 *   - Typlically this is where event listeners are added.
 * - uninstall: function(cgv) {}
 *   - (NIY) This function will be called when the plugin is unstalled.
 *   - Typlically this is where event listeners are removed.
 * @private
 */

// export default class Plugins {
class Plugins {

  /**
   * Create a new Plugins object (one per viewer).
   * @param {Viewer} viewer - The viewer
   * @param {Array|Object} plugins - Plugin or array of plugins to add to the viewer
   */
  constructor(viewer, plugins) {
    this.viewer = viewer;
    this._plugins = [];
    if (plugins) {
      // plugins are an array
      if (Array.isArray(plugins)) {
        plugins.forEach(plugin => this.add(plugin));
      }
      // plugins is an object
      else if (typeof plugins === 'object') {
        this.add(plugins);
      }
      else {
        throw new Error('Plugins must be an array or an object.');
      }
    } else {
      console.log('No plugins provided.');
    }
  }

  // NOT USED YET
  static get types() {
    return ['General', 'CaptionDynamicText', 'LabelPlacement', 'SVGContext'];
  }

  /**
   * Add a plugin to the viewer.
   * @param {Object} plugin - The plugin object to add
   */
  // 
  add(plugin) {
    // console.log(`Plugin Add: ${plugin.name}`);
    // console.log(plugin);
    if (!plugin.name) {
      throw new Error('Plugin must have a name.');
    }
    if (!plugin.id) {
      throw new Error('Plugin must have a ID.');
    }
    if (!plugin.version) {
      throw new Error('Plugin must have a version.');
    }
    if (!plugin.type) {
      throw new Error('Plugin must have a type.');
    }
    if (!Plugins.types.includes(plugin.type)) {
      throw new Error(`Plugin type is not valid. Must be one of: ${Plugins.types.join(', ')}`);
    }
    if (plugin.install) {
      if (typeof plugin.install !== 'function') {
        throw new Error('Plugin install must be a function.');
      }
      plugin.install(this.viewer);
    }
    this._plugins.push(plugin);
  }

  /**
   * Is a particular plugin included in the viewer?
   * @param {String} pluginID - The ID of the plugin
   * @return {Boolean} - Whether the object has the plugin
   */
  includes(pluginID) {
    return this._plugins.some(plugin => plugin.name === pluginID);
  }

  /**
   * Return the plugin object for a particular plugin ID.
   * This is useful for calling methods on the plugin (if they exist).
   * @param {String} pluginID - The ID of the plugin to return
   * @returns {Plugin|Object}
   */
  get(pluginID) {
    return this._plugins.find(plugin => plugin.id === pluginID);
  }


  //////////////////////////////////////////////////////////////////////////////
  // CGObject - PLUGIN METHODS
  // These methods are used by CGObjects to add and update plugins
  //////////////////////////////////////////////////////////////////////////////

  /**
   * Add a plugin to the object.
   * @param {Object} obj - The object to which the plugin is being added
   * @param {String} id - The id of the plugin
   * @param {Object} options - The plugin options
   */
  _addPluginOptions(obj, id, options) {
    if (obj.hasPlugin(id)) {
      throw new Error(`Plugin '${id}' already exists.`);
    }
    if (!obj.pluginOptions) {
      obj.pluginOptions = {};
    }
    if (this.viewer.plugins.includes(id)) {
      obj.pluginOptions[id] = options;
    } else {
      throw new Error(`Plugin '${id}' not found in viewer.`);
    }
  }

  /**
   * Update plugin options. Merge the new options with the old options.
   * If the object does not have the plugin, throw an error
   * @param {Object} obj - Object that is being updated 
   * @param {String} id - The id of the plugin
   * @param {Object} options - The plugin options
   */
  _updatePluginOptions(obj, id, options) {
    // console.log(id, options)
    if (obj.hasPlugin(id)) {
      const updates = {...obj.pluginOptions[id], ...options};
      // console.log("UPDATES", updates)
      const pluginOptions = {...obj.pluginOptions, [id]: updates};
      // console.log("PLUGIN OPTIONS", pluginOptions)
      if (typeof obj.update === 'function') {
        obj.update({pluginOptions});
      } else {
        console.log('No update function found.', obj, pluginOptions);
      }
    } else {
      throw new Error(`Plugin '${id}' not found.`);
    }
  }

  /**
   * Does the object have a particular plugin?
   * @param {Object} obj - The object to check for the plugin
   * @param {String} pluginID - The ID of the plugin
   * @return {Boolean} - Whether the object has the plugin
   */
  _hasPlugin(obj, pluginID) {
    if (obj.pluginOptions) {
      // const pluginIDs = Object.keys(obj.pluginOptions).map(key => key.toLowerCase());
      // return pluginIDs.includes(pluginID.toLowerCase());
      const pluginIDs = Object.keys(obj.pluginOptions);
      return pluginIDs.includes(pluginID);
    }
  }

  /**
   * Get the options for a particular plugin.
   * @param {Object} obj - Object to retrieve the plugin options from
   * @param {String} pluginName - The name of the plugin
   * @return {Object} - The options for the plugin or undefined if the plugin is not found
   */
  _optionsForPlugin(obj, pluginID) {
    if (obj.hasPlugin(pluginID)) {
      return obj.pluginOptions[pluginID];
    }
  }

}


export default Plugins;