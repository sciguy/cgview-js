//////////////////////////////////////////////////////////////////////////////
// Events
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

/**
 * Events is a system to plug in callbacks to specific events in CGView.
 * Use [on](#on) to add a callback and [off](#off) to remove it.
 *
 * See individual [record types](../docs.html#s.details-by-record-type) for a list of event names.
 *
 * Here are a list of additional events supported in CGView:
 *
 * Event             | Description
 * ------------------|-----------------------------------------------------
 * cgv-load-json     | Called when [IO.loadJSON()](IO.html#loadJSON) is executed
 * mousemove         | Called when mouse moves on the Viewer. Returns [event-like object](EventMonitor.html)
 * mousedown         | Called when mouse button is pressed on the Viewer. Returns [event-like object](EventMonitor.html)
 * mouseup           | Called when mouse button is released on the Viewer. Returns [event-like object](EventMonitor.html)
 * click             | Called when mouse clicks on the Viewer. Returns [event-like object](EventMonitor.html)
 * zoom-start        | Called once before the viewer is zoomed or moved
 * zoom              | Called every frame of the zoom or move
 * zoom-end          | Called once after the viewer is zoomed or moved
 * click             | Called when a click occurs in the viewer
 * mousemove         | Calleed when the mouse moves in the viewer
 * bookmarks-shortcut | Called when a bookmark shortcut key is clicked
 */
class Events {

  /**
   * Creats holder for events.
   * Accessible via [Viewer.events](Viewer.html#events).
   */
  constructor() {
    this._handlers = {};
  }

  /**
   * Attach a callback function to a specific CGView event.
   * Accessible via [Viewer.on()](Viewer.html#on).
   *
   * ```js
   * cgv = new CGView.Viewer('#my-viewer');
   * cgv.on('zoom-start', function() { console.log('Zooming has begun!') };
   *
   * // The event can be namespaced for easier removal later
   * cgv.on('zoom-start.my_plugin', function() { console.log('Zooming has begun!') };
   * ```
   *
   * @param {String} event Name of event. Events can be namespaced.
   * @param {Function} callback Function to call when event is triggered
   */
  on(event, callback) {
    const handlers = this._handlers;
    checkType(event);
    const type = parseEvent(event);
    if ( !handlers[type] ) handlers[type] = [];
    handlers[type].push( new Handler(event, callback) );
  }

  /**
   * Remove a callback function from a specific CGView event. If no callback is provided,
   * then all callbacks for the event will be removed. Namespaced events can and should be used
   * to avoid unintentionally removing callbacks attached by other plugins.
   * Accessible via [Viewer.off()](Viewer.html#off).
   *
   * ```js
   * // Remove all callbacks attached to the 'drag-start' event.
   * // This includes any namespaced events.
   * cgv.off('zoom-start');
   *
   * // Remove all callbacks attached to the 'drag-start' event namespaced to 'my_plugin'
   * cgv.off('zoom-start.my_plugin');
   *
   * // Remove all callbacks attached to any events namespaced to 'my_plugin'
   * cgv.off('.my_plugin');
   * ```
   *
   * @param {String} event -  Name of event. Events can be namespaced.
   * @param {Function} callback - Specfic function to remove
   */
  off(event, callback) {
    const handlers = this._handlers;
    checkType(event);
    const type = parseEvent(event);
    const namespace = parseNamespace(event);
    // If no callback is supplied remove all of them
    if (callback === undefined) {
      if (namespace) {
        if (type) {
          handlers[type] = handlers[type].filter( h => h.namespace !== namespace );
        } else {
          Object.keys(handlers).forEach(function(key) {
            handlers[key] = handlers[key].filter( h => h.namespace !== namespace );
          });
        }
      } else {
        handlers[type] = undefined;
      }
    } else {
      // Remove specific callback
      handlers[type] = handlers[type].filter( h => h.callback !== callback );
    }
    this._handlers = handlers;
  }

  /**
   * Trigger a callback function for a specific event.
   * Accessible via [Viewer.trigger()](Viewer.html#trigger).
   *
   * ```js
   * // Triggers all callback functions associated with zoom-start
   * cgv.trigger('zoom-start');
   *
   * // Triggers can also be namespaced
   * cgv.trigger('zoom-start.my_plugin');
   * ```
   *
   * @param {String} event Name of event. Events can be namespaced.
   * @param {Object} object Object to be passed back to 'on'.
   */
  trigger(event, object) {
    const handlers = this._handlers;
    checkType(event);
    const type = parseEvent(event);
    const namespace = parseNamespace(event);
    if (Array.isArray(handlers[type])) {
      handlers[type].forEach(function(handler) {
        if (namespace) {
          if (handler.namespace === namespace) handler.callback.call(null, object);
        } else {
          handler.callback.call(null, object);
        }
      });
    }
  }

}

/** @ignore */

const checkType = function(type) {
  if (typeof type !== 'string') {
    throw new Error('Type must be a string');
  }
};

const Handler = function(event, callback) {
  this.callback = callback;
  this.eventType = parseEvent(event);
  this.namespace = parseNamespace(event);
};

const parseEvent = function(event) {
  return event.replace(/\..*/, '');
};

const parseNamespace = function(event) {
  const result = event.match(/\.(.*)/);
  return result ? result[1] : undefined;
};

export default Events;

