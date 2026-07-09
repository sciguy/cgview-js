//////////////////////////////////////////////////////////////////////////////
// Initializing Zooming
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

import utils from './Utils';
import * as d3 from 'd3';

// NOTE: this method is now directly in Viewer
// CGV.Viewer.prototype._updateZoomMax = function() {
//   if (this._zoom) {
//     this._zoom.scaleExtent([this.minZoomFactor, this.maxZoomFactor]);
//   }
// };

/**
 * Add zoom/drag abilities to the Viewer map
 * @private
 */
export default function initializeZooming(viewer) {
  const zoomMax = viewer.backbone.maxZoomFactor();
  viewer._zoom = d3.zoom()
    .scaleExtent([1, zoomMax])
    .filter(zoomFilter)
    .on('start', zoomstart)
    .on('zoom',  zooming)
    .on('end',   zoomend);
  d3.select(viewer.canvas.node('ui')).call(viewer._zoom)
    .on('dblclick.zoom', null);

  // Keep track of pan/translate changes
  let panX = 0;
  let panY = 0;

  function zoomFilter(d3Event) {
    const isWheel = d3Event.type === 'wheel';
    const defaultZoomAllowed = (!d3Event.ctrlKey || isWheel) && !d3Event.button;
    if (!defaultZoomAllowed) { return false; }

    const canStartMarquee = (
      d3Event.type === 'mousedown' &&
      d3Event.shiftKey &&
      viewer.selection &&
      viewer.selection.enabled &&
      viewer.eventMonitor
    );
    if (!canStartMarquee) { return true; }

    const event = viewer.eventMonitor._createEvent(d3Event);
    return !viewer.selection.canStartMarquee(event);
  }

  function zoomstart() {
    viewer.trigger('zoom-start');
    viewer.highlighter.hidePopoverBox();
  }

  function zooming(d3Event) {
    const startTime = new Date().getTime();
    // console.log(d3Event)
    // console.log(viewer.mouse)
    // const bp = viewer.canvas.bpForMouse();
    let bp;
    if (d3Event?.sourceEvent?.offsetX) {
      const sourceEvent = d3Event.sourceEvent;
      bp = viewer.canvas.bpForPoint({x: sourceEvent.offsetX, y: sourceEvent.offsetY});
    } else if (d3Event?.sourceEvent?.touches?.length) {
      // Looks like pageX/Y are the center of the touches
      // But we have to remove the offset of the canvas
      const offset = utils.getOffset(viewer.canvas.node('map'));
      const x = d3Event.sourceEvent.pageX - offset.left;
      const y = d3Event.sourceEvent.pageY - offset.top;
      bp = viewer.canvas.bpForPoint({x, y});
    } else {
      bp = viewer.canvas.bpForMouse();
    }
    // console.log('BP:', bp);

    const dx = d3Event.transform.x - panX;
    const dy = d3Event.transform.y - panY;
    panX = d3Event.transform.x;
    panY = d3Event.transform.y;
    // Only translate of not Zooming
    if (viewer.zoomFactor === d3Event.transform.k) {
      viewer.layout.translate(dx, dy);
    }

    viewer.layout.zoom(d3Event.transform.k, bp);

    viewer.drawFast();
    viewer.trigger('zoom');

    // DEBUG INFO
    if (viewer.debug) {
      if (viewer.debug.data.time) {
        viewer.debug.data.time.zoom = utils.elapsedTime(startTime);
      }
      if (viewer.debug.data.zoom) {
        viewer.debug.data.zoom.scale = utils.round(viewer._zoomFactor, 1);
      }
    }
  }

  function zoomend() {
    viewer.trigger('zoom-end');
    viewer.drawFull();
  }
};
