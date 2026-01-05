//////////////////////////////////////////////////////////////////////////////
// Debug
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

/**
 * The debug class draws helpful info to the canvas.
 * Sections:
 *  - time: time for drawing
 *  - zoom: zoom and drag info
 *  - position: position of mouse, etc
 *  - n: number of features in slots, etc
 * @private
 */
class Debug {

  constructor(viewer, options = {}) {
    this.viewer = viewer;
    this._data = {};
    this._sections = utils.defaultFor(options.sections, []);
    // Create object for each section
    for (const section of this.sections) {
      this.data[section] = {};
    }
  }

  get sections() {
    return this._sections;
  }

  get data() {
    return this._data;
  }


  // // DEBUG INFO EXAMPLE
  // if (this.debug) {
  //   axis = axis.toUpperCase();
  //   this.debug_data.zoom['d' + axis]  = JSV.round(axis_diff);
  //   this.debug_data.zoom['v' + axis]  = JSV.round(value);
  //   this.debug_data.zoom['r' + axis]  = JSV.round(axis_ratio);
  // }
  // Other Example
  // let start_time = new Date().getTime();
  // ....code and stuff....
  // if (this.debug) {
  //   this.debug_data.time['draw'] = JSV.elapsedTime(start_time);
  //   this.draw_debug(this.legend.bottom());
  // }
  //
  // Draws any information in 'data' onto the left side of the viewer
  draw(x = 10, y = 20) {
    const canvas = this.viewer.canvas;
    canvas.clear('debug');
    const ctx = canvas.context('debug');
    const data = this._data;
    const sections = this._sections;

    ctx.font = '10pt Sans-Serif';
    const color = this.viewer.settings.backgroundColor.copy();

    ctx.fillStyle = color.invert().rgbaString;
    const lineHeight = 18;
    ctx.textAlign = 'left';
    // const section_keys = this.debug === true ? Object.keys(data) : this.debug;
    let i = 0;
    sections.forEach(function(sectionKey) {
      const dataKeys = Object.keys(data[sectionKey]);
      dataKeys.forEach(function(dataKey) {
        ctx.fillText((`${sectionKey}|${dataKey}: ${data[sectionKey][dataKey]}`), x, y + (lineHeight * i));
        i += 1;
      });
    });
  }

}

export default Debug;


