//////////////////////////////////////////////////////////////////////////////
// Messenger
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

/**
 *
 */
class Messenger {

  /**
   * Class to shoe message on viewer
   * @private
   */
  constructor(viewer, options = {}) {
    this._viewer = viewer;
    this._wrapper = viewer._wrapper.node();

    this.fadeTime = utils.defaultFor(options.fadeTime, 100);
    this.height = utils.defaultFor(options.height, 40);
    this.width = utils.defaultFor(options.width, 200);

    this.box = d3.select(this._wrapper).append('div')
      .style('display', 'none')
      // .attr('class', 'cgv-dialog');
      .attr('class', 'cgv-messenger')
      .style('width', this.height)
      .style('height', this.width);
    // .style('line-height', this.height);
    // .style('border', '1px solid black')
    // .style('position', 'absolute')
    // .style('top', '0')
    // .style('bottom', '0')
    // .style('right', '0')
    // .style('left', '0')
    // .style('text-align', 'center')
    // .style('margin', 'auto auto');

    this.contents = this.box.append('div')
      .attr('class', 'cgv-messenger-contents');

    this._adjustSize();

    return this;
  }

  /**
   * Return the class name as a string.
   * @return {String} - 'Messenger'
   */
  toString() {
    return 'Messenger';
  }

  //////////////////////////////////////////////////////////////////////////
  // MEMBERS
  //////////////////////////////////////////////////////////////////////////

  /**
   * @member {Viewer} - Get the viewer.
   */
  get viewer() {
    return this._viewer;
  }

  /**
   * @member {Boolean} - Returns true if the dialog is visible.
   */
  get visible() {
    return (this.box.style('display') !== 'none');
  }

  /**
   * @member {Number} - Get or set the time it take for the dialog to appear and disappear in milliseconds [Default: 500].
   */
  get fadeTime() {
    return this._fadeTime;
  }

  set fadeTime(value) {
    this._fadeTime = value;
  }

  //////////////////////////////////////////////////////////////////////////
  // METHODS
  //////////////////////////////////////////////////////////////////////////

  /**
 * Opens the messenger
 * @param {Number} duration - The duration of the open animation in milliseconds. Defaults to fadeTime [Messenger.fadeTime](Messenger.html#fadeTime).
 */
  // open(duration) {
  //   duration = utils.defaultFor(duration, this.fadeTime);
  open() {
    this._adjustSize();
    this.box.style('display', 'block');
    // this.box.transition().duration(duration)
    //   .style('opacity', 1);
    this.box.style('opacity', 1);
    return this;
  }

  /**
 * Closes the messenger
 * @param {Number} duration - The duration of the close animation in milliseconds. Defaults to fadeTime [Messenger.fadeTime](Messenger.html#fadeTime).
 */
  close(duration) {
    duration = utils.defaultFor(duration, this.fadeTime);
    this.box.transition().duration(duration)
      .style('opacity', 0)
      .on('end', function() {
        d3.select(this).style('display', 'none');
      });
    return this;
  }


  _adjustSize() {
    // Minimum buffer between dialog and edges of container (times 2)
    const buffer = 50;
    const wrapperWidth = this._wrapper.offsetWidth;
    const wrapperHeight = this._wrapper.offsetHeight;
    let width = this.width;
    let height = this.height;

    if (this.height > wrapperHeight - buffer) height = wrapperHeight - buffer;
    if (this.width > wrapperWidth - buffer) width = wrapperWidth - buffer;

    // const headerHeight = 20;
    // const footerHeight = 20;
    // const contentHeight = height - headerHeight - footerHeight;

    this.box
      .style('width', `${width}px`)
      .style('height', `${height}px`);

    // this.contents
    //   .style('height', contentHeight + 'px');
  }


  flash(msg) {
    this.contents.html(msg);
    this.open();
  }

}

export default Messenger;


