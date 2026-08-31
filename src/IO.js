//////////////////////////////////////////////////////////////////////////////
// IO
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

// FIXME: Check at the end: A low performance polyfill based on toDataURL.

import { version as currentVersion } from '../package.json';
import CGArray from './CGArray';
import Sequence from './Sequence';
import Settings from './Settings';
import Ruler from './Ruler';
import Backbone from './Backbone';
import Annotation from './Annotation';
import Dividers from './Dividers';
import { Highlighter } from './Highlighter';
import Legend from './Legend';
import utils from './Utils';
import * as d3 from 'd3';

class IO {

  /**
   * Interface for reading and writing data to and from CGView
   * @param {Viewer} viewer - Viewer
   */
  constructor(viewer) {
    this._viewer = viewer;
  }

  /**
   * @member {Viewer} - Get the viewer.
   */
  get viewer() {
    return this._viewer;
  }

  /**
   * @member {Number} - Get or set the ability to drag-n-drop JSON files on to viewer
   * @private
   */
  get allowDragAndDrop() {
    return this._allowDragAndDrop;
  }

  set allowDragAndDrop(value) {
    this._allowDragAndDrop = value;
    if (value) {
      this.io.initializeDragAndDrop();
    } else {
      // console.log('COMONE')
      // d3.select(this.canvas.node('ui')).on('.dragndrop', null);
    }
  }

  /**
   * Format the date from created and updated JSON attributes.
   * @param {Date} d - Date to format
   * @private
   */
  formatDate(d) {
    // return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`
    const timeformat = d3.timeFormat('%Y-%m-%d %H:%M:%S');
    return timeformat(d);
  }

  /**
   * Return the CGView map as a JSON object. The JSON can later be loaded using [loadJSON](#loadJSON).
   * See the [JSON page](../json.html) for details on the JSON structure.
   */
  toJSON(options = {}) {
    const v = this.viewer;
    const jsonInfo = v._jsonInfo || {};

    const json = {
      cgview: {
        version: currentVersion,
        created: jsonInfo.created || this.formatDate(new Date()),
        updated: this.formatDate(new Date()),
        id: v.id,
        name: v.name,
        // format: v.format,
        // geneticCode: v.geneticCode,
        settings: v.settings.toJSON(options),
        backbone: v.backbone.toJSON(options),
        ruler: v.ruler.toJSON(options),
        annotation: v.annotation.toJSON(options),
        dividers: v.dividers.toJSON(options),
        highlighter: v.highlighter.toJSON(options),
        captions: [],
        legend: v.legend.toJSON(options),
        sequence: v.sequence.toJSON(options),
        features: [],
        plots: [],
        bookmarks: [],
        tracks: []
      }
    };
    v.captions().each( (i, caption) => {
      json.cgview.captions.push(caption.toJSON(options));
    });
    v.features().each( (i, feature) => {
      // Only export features that were not extracted from the sequence.
      if (!feature.extractedFromSequence ||
          feature.tracks().filter( t => t.dataMethod !== 'sequence' ).length > 0) {
        json.cgview.features.push(feature.toJSON(options));
      }
    });
    v.plots().each( (i, plot) => {
      // Only export plots that were not extracted from the sequence.
      if (!plot.extractedFromSequence ||
          plot.tracks().filter( t => t.dataMethod !== 'sequence' ).length > 0) {
        json.cgview.plots.push(plot.toJSON(options));
      }
    });
    v.bookmarks().each( (i, bookmark) => {
      json.cgview.bookmarks.push(bookmark.toJSON(options));
    });
    v.tracks().each( (i, track) => {
      json.cgview.tracks.push(track.toJSON(options));
    });
    // Meta Data (TODO: add an option to exclude this)
    if (v.meta && Object.keys(v.meta).length > 0) {
      json.cgview.meta = v.meta;
    }
    return json;
  }

  /**
   * Load data from object literal or JSON string ([Format details](../json.html)).
   * The map data must be contained within a top level "cgview" property.
   * Removes any previous viewer data and overrides options that are already set.
   * @param {Object} data - JSON string or Object Literal
   */
  loadJSON(json) {
    try {
      this._loadJSON(json);
    } catch (error) {
      const msg = `Loading Error: ${error}`
      console.log(msg);
      const canvas = this.viewer.canvas;
      canvas.clear('debug');
      const ctx = canvas.context('debug');
      ctx.fillText(msg, 5, 15);
      // Re-throw the error so it can be caught by the caller
      throw error;
    }
  }

  _loadJSON(json) {

    let data = json;
    if (typeof json === 'string') {
      data = JSON.parse(json);
    }

    if (!data?.cgview) {
      throw new Error("No 'cgview' property found in JSON.");
    }

    console.log(`Loading map JSON version: '${data?.cgview?.version}'`);
    data = this.updateJSON(data);

    data = data && data.cgview;

    const viewer = this._viewer;
    viewer.clear('all');

    // Reset objects
    viewer._objects = {};

    viewer.trigger('cgv-json-load', data); // would 'io-load' be a better name?
    // In events this should mention how everything is reset (e.g. tracks, features, etc)

    // Viewer attributes
    viewer.update({
      id: data.id,
      name: data.name,
      // geneticCode: data.geneticCode,
    });

    viewer._jsonInfo = {
      version: data.version,
      created: data.created
    };

    // Reset arrays
    viewer._features = new CGArray();
    viewer._tracks = new CGArray();
    viewer._plots = new CGArray();
    viewer._captions = new CGArray();
    viewer._bookmarks = new CGArray();

    viewer._loading = true;

    // Load Sequence
    viewer._sequence = new Sequence(viewer, data.sequence);
    // Format (This format will be overridden by the format in setting if it exists.)
    // This lets us set the format from 2 places (settings and JSON)
    viewer.format = utils.defaultFor(data.format, 'circular');
    // Load Settings
    // const settings = data.settings || {};
    // General Settings
    viewer._settings = new Settings(viewer, data.settings);
    // Ruler
    viewer._ruler = new Ruler(viewer, data.ruler);
    // Backbone
    viewer._backbone = new Backbone(viewer, data.backbone);
    // Annotation (save label placement methods to restore after loading
    // const labelPlacementFast = viewer.annotation.labelPlacementFast.name;
    // const labelPlacementFull = viewer.annotation.labelPlacementFull.name;
    viewer._annotation = new Annotation(viewer, data.annotation);
    // if (labelPlacementFull === labelPlacementFast) {
    //   viewer.annotation.labelPlacement = labelPlacementFast;
    // } else {
    //   viewer.annotation.labelPlacementFast = labelPlacementFast;
    //   viewer.annotation.labelPlacementFull = labelPlacementFull;
    // }
    // Slot Dividers
    // viewer.slotDivider = new Divider(viewer, settings.dividers.slot);
    viewer._dividers = new Dividers(viewer, data.dividers);
    // Highlighter
    // NOTE: The only option we kinda support (in toJSON) is 'visible' but 
    // it's more of a manual override thing. Let's skip this for now.
    // Also if we do this we override Highlighter settings from creating the Viewer.
    // viewer._highlighter = new Highlighter(viewer, data.highlighter);

    // Load Bookmarks
    if (data.bookmarks) {
      viewer.addBookmarks(data.bookmarks);
    }

    // Load Captions
    if (data.captions) {
      viewer.addCaptions(data.captions);
    }

    // Load Legend
    viewer._legend = new Legend(viewer, data.legend);
    // FIXME: This is a quick way to clear the previous legend box
    // - but we should probably do this directly in the Legend constructor
    viewer.clear('canvas');
    viewer.legend.refresh();

    // Create features
    if (data.features) {
      viewer.addFeatures(data.features);
    }

    // Create plots
    if (data.plots) {
      viewer.addPlots(data.plots);
      // data.plots.forEach((plotData) => {
      //   new Plot(viewer, plotData);
      // });
    }

    // Create tracks
    if (data.tracks) {
      viewer.addTracks(data.tracks);
    }

    // Add Meta data
    if (data.meta) {
      viewer.meta = data.meta;
    }

    // Refresh Annotations
    viewer.annotation.refresh();

    viewer._loading = false;
    viewer.update({dataHasChanged: false});

    // Load Layout
    // viewer._layout = new Layout(viewer, data.layout);
    viewer.layout._adjustProportions();
    viewer.zoomTo(0, 1, {duration: 0});
  }

  /**
   * Update old CGView JSON formats to the current version.
   * The map data must be contained within a top level "cgview" property.
   * This method will continue to call itself until the JSON is updated to the latest version.
   * @param {Object} data - Object Literal
   */
  updateJSON(data) {
    data = data && data.cgview;

    function parseVersion(version) {
      const result = version.match(/^(\d+)\.(\d+)/)
      if (result) {
        return { string: version, major: Number(result[1]), minor: Number(result[2]), };
      } else {
        throw new Error(`Can not read cgview version '${version}'`);
      }
    }

    const version = parseVersion(data.version);
    const lastestVersion = parseVersion(currentVersion);

    switch (true) {
      case (version.string === '0.1'):
        data = this._updateVersion_0_1(data)
        console.log(`Update JSON version: ${version.string} -> ${data.version}`)
        return this.updateJSON({cgview: data});
      case (version.string === '0.2'):
        data = this._updateVersion_0_2(data)
        console.log(`Update JSON version: ${version.string} -> ${data.version}`)
        return this.updateJSON({cgview: data});
      case (version.string === '1.0.0'):
        data = this._updateVersion_1_0(data);
        console.log(`Update JSON version: ${version.string} -> ${data.version}`)
        return this.updateJSON({cgview: data});
      case (version.major <= 1 && version.minor <= 4):
        data = this._updateVersion_1_4(data);
        console.log(`Update JSON version: ${version.string} -> ${data.version}`)
        return this.updateJSON({cgview: data});
      case (version.string === lastestVersion.string):
        console.log(`JSON at latest version: ${version.string}`)
        break;
      case (version.major <= lastestVersion.major && version.minor <= lastestVersion.minor):
        console.log(`Update JSON to latest version: ${version.string} -> ${currentVersion}`)
        data.version = currentVersion;
        break;
      // case (version.major === 1):
      //   console.log('No need to convert.')
      //   break;
      default:
        throw new Error(`Unknown cgview version '${version.string}'`);
    }
    return {cgview: data};
  }

  // TODO: When version 1.9 is released, add update function here
  // Version 1.9 started on 2026-??-??
  // _updateVersion_1_8(data) {
  //   - Remove the auto conversion (and deprecation) in track position
  //   - Update track position from 'both' to 'around'
  // }

  // Version 1.7 started on 2024-10-02
  // - no update required

  // Version 1.6 started on 2023-11-29
  // - no update required

  // Version 1.5 started on 2023-09-28
  // Moves the minArcLength from Settings to Legend and LegendItems
  _updateVersion_1_4(data) {
    data.legend.defaultMinArcLength = data.settings.minArcLength;
    // Version
    data.version = '1.5.0';
    return data;
  }

  // Version 1.1 released on 2021-09-29
  _updateVersion_1_0(data) {
    // Contigs are the only change for this version
    const contigs = data.sequence && data.sequence.contigs;
    if (contigs) {
      for (const contig of contigs) {
        contig.name = contig.id;
      }
    }
    // Version
    data.version = '1.1.0';
    return data;
  }

  // This version is all over the place so concentrate on tracks
  // Version 0.2 started on 2018-08-22
  _updateVersion_0_2(data) {
    // Tracks
    const tracks = data.layout && data.layout.tracks || data.tracks;
    for (const track of tracks) {
      if (track.readingFrame === 'separated') {
        track.separateFeaturesBy = 'readingFrame';
      } else if (track.strand === 'separated') {
        track.separateFeaturesBy = 'strand';
      } else {
        track.separateFeaturesBy = 'none';
      }
      track.dataType = track.contents && track.contents.type || track.dataType;
      track.dataMethod = track.contents && track.contents.from || track.dataMethod;
      track.dataKeys = track.contents && track.contents.extract || track.dataKeys;
    }
    data.tracks = tracks;
    // Version
    data.version = '1.1.0';
    return data;
  }

  _updateVersion_0_1(data) {
    const positionMap = {
      'lower-left': 'bottom-left',
      'lower-center': 'bottom-center',
      'lower-right': 'bottom-right',
      'upper-left': 'top-left',
      'upper-center': 'top-center',
      'upper-right': 'top-right',
    }
    // Captions
    const captions = data.captions;
    if (captions) {
      for (const caption of captions) {
        caption.position = positionMap[caption.position] || caption.position;
        caption.font = caption.items[0].font || caption.font;
        caption.fontColor = caption.items[0].fontColor || caption.fontColor;
        caption.name = caption.items.map(i => i.name).join('\n');
      }
    }
    // Legend
    const legend = data.legend;
    legend.position = positionMap[legend.position] || legend.position;
    legend.defaultFont = legend.font;
    // Tracks
    const tracks = data.layout.tracks || [];
    for (const track of tracks) {
      if (track.readingFrame === 'separated') {
        track.separateFeaturesBy = 'readingFrame';
      } else if (track.strand === 'separated') {
        track.separateFeaturesBy = 'strand';
      } else {
        track.separateFeaturesBy = 'none';
      }
      track.dataType = track.contents.type;
      track.dataMethod = track.contents.from;
      track.dataKeys = track.contents.extract;
    }
    data.tracks = tracks;
    // From Settings
    data.annotaion = data.settings.annotaion;
    data.backbone = data.settings.backbone;
    data.dividers = data.settings.dividers;
    data.ruler = data.settings.ruler;
    data.settings = data.settings.general;
    // Plots aren't saved properly on CGView Server so we can ignore
    // Version
    data.version = '1.1.0';
    return data;
  }

  /**
   * Render with temporary export layers, then restore the live viewer state.
   * If export rendering interrupts a progressive Canvas draw, restart it only
   * after the live layers have been restored.
   * @param {Array} layerNames - Canvas layer names to create.
   * @param {Number} width - Export width.
   * @param {Number} height - Export height.
   * @param {Function} render - Callback that renders with the temporary layers.
   * @return {*} The callback result.
   * @private
   */
  _withTemporaryExportLayers(layerNames, width, height, render) {
    const viewer = this._viewer;
    const canvas = viewer.canvas;
    const origLayers = canvas._layers;
    const debug = viewer.debug;
    const resumeCanvasDraw = viewer.layout.fullDrawInProgress;
    const tempLayers = canvas.createLayers(d3.select('body'), layerNames, width, height, false);

    try {
      viewer.debug = false;
      canvas._layers = tempLayers;
      return render(tempLayers);
    } finally {
      canvas._layers = origLayers;
      viewer.debug = debug;

      for (const name of layerNames) {
        d3.select(tempLayers[name].node).remove();
      }

      if (resumeCanvasDraw) {
        viewer.drawFull();
      }
    }
  }

  /**
   * Download the currently visible map as a PNG image.
   * @param {Number} width - Width of image
   * @param {Number} height - Height of image
   * @param {String} filename - Name to save image file as
   */
  downloadImage(width, height, filename = 'image.png') {
    const viewer = this._viewer;
    const canvas = viewer.canvas;
    width = width || viewer.width;
    height = height || viewer.height;

    // Create new layers and add export layer
    const layerNames = canvas.layerNames.concat(['export']);
    this._withTemporaryExportLayers(layerNames, width, height, (tempLayers) => {
      // Calculate scaling factor
      const minNewDimension = d3.min([width, height]);
      const scaleFactor = minNewDimension / viewer.minDimension;

      // Scale context of layers, excluding the 'export' layer
      for (const name of canvas.layerNames) {
        tempLayers[name].ctx.scale(scaleFactor, scaleFactor);
      }

      // Draw map on to new layers
      viewer.drawExport();
      viewer.fillBackground();
      // Legend
      viewer.legend.draw();
      // Captions
      for (let i = 0, len = viewer._captions.length; i < len; i++) {
        viewer._captions[i].draw();
      }

      // Copy drawing layers to export layer
      const exportContext = tempLayers.export.ctx;
      exportContext.drawImage(tempLayers.background.node, 0, 0);
      exportContext.drawImage(tempLayers.map.node, 0, 0);
      exportContext.drawImage(tempLayers.foreground.node, 0, 0);
      exportContext.drawImage(tempLayers.canvas.node, 0, 0);

      // Generate image from export layer
      tempLayers.export.node.toBlob( (blob) => { this.download(blob, filename, 'image/png');} );
    });
  }

  /**
   * Return the currently visible map as a SVG string.
   * Requires SVGCanvas external dependency:
   * https://github.com/zenozeng/svgcanvas
   */
  getSVG() {
    const SVGContext = this.viewer.externals.SVGContext;
    if (!SVGContext) {
      console.error('SVGContext is not set. This should be set to svgcanvas.Context from https://github.com/zenozeng/svgcanvas')
      return;
    }
    const viewer = this._viewer;
    const canvas = viewer.canvas;
    const width = viewer.width;
    const height = viewer.height;

    const layerNames = canvas.layerNames;
    return this._withTemporaryExportLayers(layerNames, width, height, (tempLayers) => {
      const svgContext = new SVGContext(width, height);
      tempLayers.map.ctx = svgContext;
      tempLayers.foreground.ctx = svgContext;
      tempLayers.canvas.ctx = svgContext;

      // Override the clearRect method as it's not required for SVG drawing.
      // Otherwise, an additional SVG rect will be drawn obscuring the background.
      svgContext.clearRect = () => {};

      // Manually Draw background here
      svgContext.fillStyle = viewer.settings.backgroundColor.rgbaString;
      svgContext.fillRect(0, 0, width, height);

      // Draw map on to new layers
      viewer.drawExport();
      // Legend
      viewer.legend.draw();
      // Captions
      for (let i = 0, len = viewer._captions.length; i < len; i++) {
        viewer._captions[i].draw();
      }

      return svgContext.getSerializedSvg();
    });
  }
  /**
   * Download the currently visible map as a SVG image.
   * Requires SVGContext external dependency:
   * https://github.com/zenozeng/svgcanvas
   * @param {String} filename - Name to save image file as
   */
  downloadSVG(filename = 'image.svg') {
    const svg = this.getSVG();
    if (svg) {
    this.download(svg, filename, 'image/svg+xml');
    }
  }

  /**
   * Download the map sequence in FASTA format.
   * @param {String} fastaId - ID line for FASTA (i.e. text after '>')
   * @param {String} filename - Name for saved file
   * @param {Object} options - Options for FASTA (see [Sequence.asFasta](Sequence.html#asFasta))
   */
  downloadFasta(fastaId, filename = 'sequence.fa', options = {}) {
    const fasta = this.viewer.sequence.asFasta(fastaId, options);
    this.download(fasta, filename, 'text/plain');
  }

  /**
   * Download the map as a JSON object
   * @param {String} filename - Name for saved file
   * @param {Object} options - Options passed to toJSON
   */
  downloadJSON(filename = 'cgview.json', options = {}) {
    const json = this.viewer.io.toJSON(options);
    this.download(JSON.stringify(json), filename, 'text/json');
  }

  // https://stackoverflow.com/questions/13405129/javascript-create-and-save-file
  /**
   * Download data to a file
   * @param {Object} data - Data to download
   * @param {String} filename - Name for saved file
   * @param {String} type - Mime type for the file
   * @private
   */
  download(data, filename, type = 'text/plain') {
    const file = new Blob([data], {type: type});
    if (window.navigator.msSaveOrOpenBlob) {
      // IE10+
      window.navigator.msSaveOrOpenBlob(file, filename);
    } else {
      // Others
      const a = document.createElement('a');
      const	url = URL.createObjectURL(file);
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function() {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 0);
    }
  }

  /**
   * Initialize Viewer Drag-n-Drop.
   * TODO: Check if this works still
   * @private
   */
  initializeDragAndDrop() {
    const viewer = this.viewer;
    const canvas = viewer.canvas;
    d3.select(canvas.node('ui')).on('dragleave.dragndrop', (d3Event) => {
      d3Event.preventDefault();
      d3Event.stopPropagation();
      viewer.drawFull();
    });

    d3.select(canvas.node('ui')).on('dragover.dragndrop', (d3Event) => {
      d3Event.preventDefault();
      d3Event.stopPropagation();
    });

    d3.select(canvas.node('ui')).on('drop.dragndrop', (d3Event) => {
      d3Event.preventDefault();
      d3Event.stopPropagation();
      viewer.drawFull();
      const file = d3Event.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = function() {
        const jsonObj = reader.result;
        try {
          const jsonParsed = JSON.parse(jsonObj);
          // sv.trigger('drop');
          viewer.io.loadJSON(jsonParsed.cgview);
          viewer.drawFull();
        } catch (e) {
          // sv.draw();
          // sv.flash('Could not read file: ' + e.message);
        }
      };
      reader.readAsText(file);
    });
  }

}

// // A low performance polyfill based on toDataURL.
// if (!HTMLCanvasElement.prototype.toBlob) {
//   Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
//     value: function (callback, type, quality) {
//       const binStr = atob( this.toDataURL(type, quality).split(',')[1] ),
//         len = binStr.length,
//         arr = new Uint8Array(len);
//
//       for (let i = 0; i < len; i++ ) {
//         arr[i] = binStr.charCodeAt(i);
//       }
//
//       callback( new Blob( [arr], {type: type || 'image/png'} ) );
//     }
//   });
// }

export default IO;
