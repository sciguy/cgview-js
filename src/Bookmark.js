//////////////////////////////////////////////////////////////////////////////
// Bookmark
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

import CGObject from './CGObject';
import utils from './Utils';

/**
 * Bookmarks are saved map locations. Bookmarks store the base pair (bp),
 * the zoomFactor (zoom) and map format (e.g. linear or circular). By default
 * the map backbone at the provided bp will be centered in the middle of the canvas.
 * The bbOffset attribute can be used to move the map backbone away from the center.
 * Bookmarks can have shortcut key associated with them. If the key is typed, while not
 * in a input field, the map will move to the bookmark position.
 *
 * ### Action and Events
 *
 * Action                                    | Viewer Method                                    | Bookmark Method     | Event
 * ------------------------------------------|--------------------------------------------------|---------------------|-----
 * [Add](../docs.html#s.adding-records)      | [addBookmarks()](Viewer.html#addBookmarks)       | -                   | bookmarks-add
 * [Update](../docs.html#s.updating-records) | [updateBookmarks()](Viewer.html#updateBookmarks) | [update()](#update) | bookmarks-update
 * [Remove](../docs.html#s.removing-records) | [removeBookmarks()](Viewer.html#removeBookmarks) | [remove()](#remove) | bookmarks-remove
 * [Read](../docs.html#s.reading-records)    | [bookmarks()](Viewer.html#bookmarks)             | -                   | -
 *
 * <a name="attributes"></a>
 * ### Attributes
 *
 * Attribute                        | Type      | Description
 * ---------------------------------|-----------|------------
 * [name](#name)                    | String    | Name of bookmark [Default: "Bookmark-N" where N is the number of the bookmark]
 * [bp](#bp)                        | Number    | Base pair to center the map position [Default: Current bp]
 * [zoom](#zoom)                    | Number    | Zoom factor [Default: Current zoomFactor]
 * [format](#format)                | String    | Map format [Default: Current map format]
 * [bbOffset](#bbOffset)            | Number    | Distance from the backbone to the center of the canvas [Default: 0]
 * [shortcut](#shortcut)            | Character | Single character shortcut that when pressed moves the map to this position [Default: N (see name) up to 9]
 * [favorite](#favorite)            | Boolean   | Bookmark is a favorite [Default: false]
 * [meta](CGObject.html#meta)       | Object    | [Meta data](../tutorials/details-meta-data.html) for Bookmark
 *
 * ### Examples
 * ```js
 * // Create a new bookmark for the current map postion
 * let bookmark = cgv.addBookmarks();
 * // => Bookmark {name: 'Bookmark-1', bp: 1, zoom: 1, format: 'linear', bbOffset: 0, shortcut: 1}
 * cgv.bookmarks().length;
 * // => 1
 *
 * // Edit the bookmark
 * bookmark.update({name: 'my gene'});
 * // => Bookmark {name: 'my gene', bp: 1, zoom: 1, format: 'linear', bbOffset: 0, shortcut: 1}
 *
 * // Move to the bookmark position
 * bookmark.moveTo()
 *
 * // Remove the bookmark
 * bookmark.remove();
 * cgv.bookmarks().length;
 * // => 0
 * ```
 *
 * @extends CGObject
 */
class Bookmark extends CGObject {

  // TODO:
  //  - Offsets of 0 do not need to be saved to json as they will be the default

  /**
   * Create a new bookmark.
   * @param {Viewer} viewer - The viewer
   * @param {Object} options - [Attributes](#attributes) used to create the bookmark
   * @param {Object} [meta] - User-defined [Meta data](../tutorials/details-meta-data.html) to add to the bookmark.
   */
  constructor(viewer, options = {}, meta = {}) {
    super(viewer, options, meta);
    this.viewer = viewer;

    this.bp = utils.defaultFor(options.bp, viewer.canvas.bpForCanvasCenter());
    this.zoom = utils.defaultFor(options.zoom, viewer.zoomFactor);
    this.format = utils.defaultFor(options.format, viewer.format);
    this.name = utils.defaultFor(options.name, this.incrementalName());
    this.favorite = utils.defaultFor(options.favorite, false);
    this.shortcut = utils.defaultFor(options.shortcut, this.incrementalShortcut());
    this.bbOffset = utils.defaultFor(options.bbOffset, viewer.bbOffset);
  }

  //////////////////////////////////////////////////////////////////////////
  // MEMBERS
  //////////////////////////////////////////////////////////////////////////

  /**
   * Return the class name as a string.
   * @return {String} 'Bookmark'
   */
  toString() {
    return 'Bookmark';
  }

  /**
   * @member {Viewer} - Get the *Viewer*
   */
  get viewer() {
    return this._viewer;
  }

  set viewer(viewer) {
    if (this.viewer) {
      // TODO: Remove if already attached to Viewer
    }
    this._viewer = viewer;
    viewer._bookmarks.push(this);
  }

  /**
   * @member {String} - Get or set the *name*
   */
  get name() {
    return this._name;
  }

  set name(value) {
    this._name = value;
  }

  /**
   * @member {Number} - Get or set the basepair position for the bookmark.
   */
  get bp() {
    return this._bp;
  }

  set bp(value) {
    this._bp = value;
  }

  /**
   * @member {Number} - Get or set the *zoom*
   */
  get zoom() {
    return this._zoom;
  }

  set zoom(value) {
    this._zoom = value;
  }

  /**
   * @member {String} - Get or set the *format*
   */
  get format() {
    return this._format;
  }

  set format(value) {
    this._format = value;
  }

  /**
   * @member {Boolean} - Get or set the *favorite*
   */
  get favorite() {
    return this._favorite;
  }

  set favorite(value) {
    this._favorite = value;
  }

  /**
   * @member {Character} - Get or set the *shortcut*
   */
  get shortcut() {
    return this._shortcut;
  }

  set shortcut(value) {
    this._shortcut = ([undefined, null, ''].includes(value)) ? undefined : String(value).charAt(0);
  }

  /**
   * Update bookmark [attributes](#attributes).
   * See [updating records](../docs.html#s.updating-records) for details.
   * @param {Object} attributes - Object describing the properties to change
   */
  update(attributes) {
    this.viewer.updateBookmarks(this, attributes);
  }

  /**
   * Remove bookmark.
   * See [removing records](../docs.html#s.removing-records) for details.
   */
  remove() {
    this.viewer.removeBookmarks(this);
  }

  /**
   * Move and zoom the map to this Bookmarks position.
   * @param {Number} duration - length of time for the animation
   */
  moveTo(duration = 1000) {
    if (this.viewer.format !== this.format) {
      this.viewer.settings.update({ format: this.format });
    }
    setTimeout( () => {
      this.viewer.zoomTo(this.bp, this.zoom, {duration, bbOffset: this.bbOffset});
    }, 0);
  }

  incrementalName() {
    const currentNames = this.viewer.bookmarks().map( b => b.name);
    return utils.uniqueId('Bookmark-', currentNames.length, currentNames);
  }

  // TODO: for now shortcuts will only be created automatically up to 9
  incrementalShortcut() {
    const currentShortcuts = this.viewer.bookmarks().map( b => b.shorcut);
    const shortcut = utils.uniqueId('', currentShortcuts.length, currentShortcuts);
    if (shortcut < 10 && shortcut > 0) { return shortcut; }
  }


  /**
   * Returns JSON representing the object
   */
  toJSON(options = {}) {
    const json = {
      name: this.name,
      bp: this.bp,
      zoom: this.zoom,
      bbOffset: this.bbOffset,
      format: this.format,
      shortcut: this.shortcut
      // favorite: this.favorite
    };
    if (this.favorite || options.includeDefaults) {
      json.favorite = this.favorite;
    }
    return json;
  }

}

export default Bookmark;


