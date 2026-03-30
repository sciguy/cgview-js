//////////////////////////////////////////////////////////////////////////////
// SequenceExtractor
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

import WorkerFeatureExtraction from './WorkerFeatureExtraction';
import WorkerBaseContent from './WorkerPlotExtraction';
import utils from './Utils';

/**
 * The Extractor creates features or plots based on the sequence
 */
class SequenceExtractor {

  /**
   * Create a Sequence Extractor
   * @param {Viewer} sequence - The sequence to extract from.
   * @param {Object} options - Options and stuff
   * @private
   */
  constructor(sequence, options = {}) {
    this.sequence = sequence;
    if (!sequence.seq) {
      throw ('Sequence invalid. The sequence must be provided.');
    }
  }

  //////////////////////////////////////////////////////////////////////////
  // MEMBERS
  //////////////////////////////////////////////////////////////////////////

  /**
   * @member {Sequence} - Get or set the sequence.
   */

  get sequence() {
    return this._sequence;
  }

  set sequence(value) {
    if (value) {
      this._sequence = value;
    }
  }

  /**
   * @member {String} - Get the seqeunce as a string
   */
  // get seqString() {
  //   return this.sequence.seq;
  // }

  /**
   * @member {String} - Get the viewer
   */
  get viewer() {
    return this.sequence.viewer;
  }

  /**
   * @member {Number} - Get the seqeunce length.
   */
  get length() {
    return this.sequence.length;
  }

  //////////////////////////////////////////////////////////////////////////
  // METHODS
  //////////////////////////////////////////////////////////////////////////

  fn2workerURL(fn) {
    const blob = new Blob([`(${fn.toString()})()`], {type: 'application/javascript'});
    return URL.createObjectURL(blob);
  }

  sequenceInput(concatenate = false) {
    let type, data;
    if (this.sequence.hasMultipleContigs && !concatenate) {
      type = 'contigs';
      data = this.sequence.contigs().map( c => c.toJSON() );
    } else {
      type = 'sequence';
      data = [ { seq: this.sequence.seq } ];
    }
    return {type: type, data: data};
  }

  extractTrackData(track, extractType, options = {}) {
    if (!utils.validate(extractType, ['start-stop-codons', 'orfs', 'gc-skew', 'gc-content'])) { return; }
    switch (extractType) {
    case 'start-stop-codons':
    case 'orfs':
      track.dataType = 'feature';
      this.generateFeatures(track, extractType, options);
      break;
    case 'gc-skew':
    case 'gc-content':
      track.dataType = 'plot';
      this.generatePlot(track, extractType, options);
      break;
    }
  }

  generateFeatures(track, extractType, options = {}) {
    if (!utils.validate(extractType, ['start-stop-codons', 'orfs'])) { return; }
    let startTime = new Date().getTime();
    const viewer = this.viewer;
    // Start worker
    const url = this.fn2workerURL(WorkerFeatureExtraction);
    const worker = new Worker(url);
    // Sequence data
    const seqInput = this.sequenceInput();
    // Prepare message
    const message = {
      type: extractType,
      // seqString: this.seqString,
      seqType: seqInput.type,
      seqData: seqInput.data,
      seqTotalLength: this.sequence.length,
      options: {
        // startPattern: utils.defaultFor(options.start, 'ATG'),
        // stopPattern: utils.defaultFor(options.stop, 'TAA,TAG,TGA'),
        // These are start/stop codons for Genetic Code Table 11
        startPattern: utils.defaultFor(options.start, 'ATG, TTG, CTG, ATT, ATC, ATA, GTG'),
        stopPattern: utils.defaultFor(options.stop, 'TAA,TAG,TGA'),
        minORFLength: utils.defaultFor(options.minORFLength, 100)
      }
    };
    worker.postMessage(message);
    worker.onmessage = (e) => {
      const messageType = e.data.messageType;
      if (messageType === 'progress') {
        // track.loadProgress = e.data.progress;
        track.update({loadProgress: e.data.progress});

        viewer.layout.drawProgress();
      }
      if (messageType === 'complete') {
        // track.loadProgress = 100;
        track.update({loadProgress: 100});
        const featureDataArray = e.data.featureDataArray;
        console.log(`Features '${extractType}' Worker Time: ${utils.elapsedTime(startTime)}` );
        startTime = new Date().getTime();
        let featureData;
        const legends = this.createLegendItems(extractType);
        console.log(extractType);
        for (let i = 0, len = featureDataArray.length; i < len; i++) {
          featureDataArray[i].legend = legends[featureDataArray[i].type];
        }
        const features = viewer.addFeatures(featureDataArray);

        console.log(`Features '${extractType}' Creation Time: ${utils.elapsedTime(startTime)}` );
        startTime = new Date().getTime();
        track._features = features;
        track.updateSlots();
        track.triggerUpdate();
        console.log(`Features '${extractType}' Update Time: ${utils.elapsedTime(startTime)}` );
        viewer.drawFull();
      }
    };

    worker.onerror = (e) => {
      // do stuff
    };
  }


  generatePlot(track, extractType, options = {}) {
    if (!utils.validate(extractType, ['gc-content', 'gc-skew'])) { return; }
    const startTime = new Date().getTime();
    // let extractType = options.sequence;
    const viewer = this.viewer;
    // Start worker
    const url = this.fn2workerURL(WorkerBaseContent);
    const worker = new Worker(url);
    // Sequence data
    // FIXME: concatenate set to true; should come from the user
    const seqInput = this.sequenceInput(true);
    // Prepare message
    const message = {
      type: extractType,
      // seqString: this.seqString
      seqType: seqInput.type,
      seqData: seqInput.data,
      seqTotalLength: this.sequence.length,
      options: {
        window: utils.defaultFor(options.window, this.getWindowStep().window),
        step: utils.defaultFor(options.step, this.getWindowStep().step),
        // deviation: utils.defaultFor(options.deviation, 'scale') // 'scale' or 'average
        deviation: utils.defaultFor(options.deviation, 'average') // 'scale' or 'average
      }
    };
    console.log(message.options)
    worker.postMessage(message);
    worker.onmessage = (e) => {
      const messageType = e.data.messageType;
      if (messageType === 'progress') {
        // track.loadProgress = e.data.progress;
        track.update({loadProgress: e.data.progress});
        viewer.layout.drawProgress();
      }
      if (messageType === 'complete') {
        // track.loadProgress = 100;
        track.update({loadProgress: 100});
        const baseContent = e.data.baseContent;
        // const data = { positions: baseContent.positions, scores: baseContent.scores, baseline: baseContent.average };
        const data = { positions: baseContent.positions, scores: baseContent.scores, baseline: baseContent.average, axisMin: baseContent.min, axisMax: baseContent.max };
        data.source = extractType
        // if (extractType === 'gc-content') {
        //   data.axisMin = 0;
        //   data.axisMax = 1;
        // } else if (extractType === 'gc-skew') {
        //   data.axisMin = -1;
        //   data.axisMax = 1;
        // }
        data.legendPositive = this.getLegendItem(extractType, '+').name;
        data.legendNegative = this.getLegendItem(extractType, '-').name;
        data.name = extractType;
        data.extractedFromSequence = true;
        // Set baseline to 0 for GC Skew
        if (extractType === 'gc-skew') {
          data.baseline = 0;
        }

        // const plot = new CGV.Plot(viewer, data);
        const plots = viewer.addPlots(data);
        track._plot = plots[0];
        track.updateSlots();
        track.triggerUpdate();
        console.log(`Plot '${extractType}' Worker Time: ${utils.elapsedTime(startTime)}` );
        viewer.drawFull();
      }
    };

    worker.onerror = (e) => {
      // do stuff
    };
  }

  createLegendItems(extractType) {
    let legends = {};
    if (extractType === 'orfs') {
      legends = {
        'ORF': this.getLegendItem('ORF')
      };
    } else if (extractType === 'start-stop-codons') {
      legends = {
        'start-codon': this.getLegendItem('start-codon'),
        'stop-codon': this.getLegendItem('stop-codon')
      };
    }
    return legends;
  }

  getLegendItem(extractType, sign) {
    const legend = this.viewer.legend;
    let item;
    switch (extractType) {
    case 'start-codon':
      item = legend.findLegendItemOrCreate('Start', 'blue', 'arc');
      break;
    case 'stop-codon':
      item = legend.findLegendItemOrCreate('Stop', 'red', 'arc');
      break;
    case 'ORF':
      item = legend.findLegendItemOrCreate('ORF', 'green', 'arc');
      break;
    case 'gc-content':
      const color = this.viewer.settings.backgroundColor.copy().invert()
      item = legend.findLegendItemOrCreate('GC Content', color);
      break;
    case 'gc-skew': {
      const color = (sign === '+') ? 'rgb(0,153,0)' : 'rgb(153,0,153)';
      const name = (sign === '+') ? 'GC Skew+' : 'GC Skew-';
      item = legend.findLegendItemOrCreate(name, color);
      break;
    }
    default:
      item = legend.findLegendItemOrCreate('Unknown', 'grey');
    }
    return item;
  }

  getWindowStep() {
    let windowSize, step;
    const length = this.length;
    if (length < 1e3 ) {
      windowSize = 10;
      step = 1;
    } else if (length < 1e4) {
      windowSize = 50;
      step = 1;
    } else if (length < 1e5) {
      windowSize = 500;
      step = 1;
    } else if (length < 1e6) {
      windowSize = 1000;
      step = 10;
    } else if (length < 1e7) {
      windowSize = 10000;
      step = 100;
    } else if (length < 1e8) {
      windowSize = 50000;
      step = 1000;
    }
    return { step: step, window: windowSize };
  }

}

export default SequenceExtractor;


// extractFeatures(options = {}) {
//   let features = new CGV.CGArray();
//   if (options.sequence === 'start-stop-codons') {
//     features = this.extractStartStops(options);
//   } else if (options.sequence === 'orfs') {
//     features = this.extractORFs(options);
//   }
//   return features
// }

// generateFeatures(track, options) {
//   if (options.sequence === 'start-stop-codons') {
//     features = this.generateStartStops(options);
//   } else if (options.sequence === 'orfs') {
//     features = this.extractORFs(options);
//   }
// }
//
//
// extractPlot(options = {}) {
//   if (options.sequence === 'gc-content') {
//     return this.extractBaseContentPlot('gc-content', options);
//   } else if (options.sequence === 'gc-skew') {
//     return this.extractBaseContentPlot('gc-skew', options);
//   }
// }
//
// // PLOTS should be bp: [1,23,30,45], score: [0, 0.4, 1]
// // score must be between 0 and 1
// extractBaseContentPlot(type, options = {}) {
//   let startTime = new Date().getTime();
//   if (!CGV.validate(type, ['gc-content', 'gc-skew'])) { return }
//   this.viewer.flash("Creating '" + type + "' Plot...");
//
//
//   options.window = CGV.defaultFor(options.window, this.getWindowStep().window);
//   options.step = CGV.defaultFor(options.step, this.getWindowStep().step);
//   let step = options.step
//   let deviation = CGV.defaultFor(options.deviation, 'scale'); // 'scale' or 'average'
//   // let deviation = CGV.defaultFor(options.deviation, 'average'); // 'scale' or 'average'
//
//   let baseContent = this.calculateBaseContent(type, options);
//   let positions = [];
//   let position;
//
//   // The current position marks the middle of the calculated window.
//   // Adjust the bp position to mark where the plot changes,
//   // NOT the center point of the window.
//   // i.e. half way between the current position and the last
//   for (let i = 0, len = baseContent.positions.length; i < len; i++) {
//     position = baseContent.positions[i];
//     if (i === 0) {
//       positions.push(1);
//     } else {
//       positions.push(position - step/2);
//     }
//   }
//   let data = { positions: positions, scores: baseContent.scores, baseline: baseContent.average };
//   data.legendPositive = this.getLegendItem(type, '+').text;
//   data.legendNegative = this.getLegendItem(type, '-').text;
//
//   let plot = new CGV.Plot(this.viewer, data);
//   console.log("Plot '" + type + "' Extraction Time: " + CGV.elapsedTime(startTime) );
//   return plot
// }


// calculateBaseContent(type, options) {
//   let windowSize = CGV.defaultFor(options.window, this.getWindowStep().window);
//   let step = CGV.defaultFor(options.step, this.getWindowStep().step);
//   let deviation = CGV.defaultFor(options.deviation, 'scale'); // 'scale' or 'average'
//   // let deviation = CGV.defaultFor(options.deviation, 'average'); // 'scale' or 'average'
//
//   let positions = [];
//   let scores = [];
//   let average =  CGV.Sequence.baseCalculation(type, this.seqString);
//   // Starting points for min and max
//   let min = 1;
//   let max = 0;
//   let halfWindowSize = windowSize / 2;
//   let start, stop;
//
//   // FIXME: not set up for linear sequences
//   // position marks the middle of the calculated window
//   for (let position = 1, len = this.length; position < len; position += step) {
//     // Extract DNA for window and calculate score
//     start = this.sequence.subtractBp(position, halfWindowSize);
//     stop = this.sequence.addBp(position, halfWindowSize);
//     let range = new CGV.CGRange(this.sequence, start, stop);
//     let seq = this.sequence.forRange(range);
//     let score = CGV.Sequence.baseCalculation(type, seq);
//
//     if (score > max) {
//       max = score;
//     }
//     if (score < min) {
//       min = score;
//     }
//
//     positions.push(position);
//     scores.push(score);
//   }
//
//   // Adjust scores if scaled
//   // Min value becomes 0
//   // Max value becomes 1
//   // Average becomes 0.5
//   if (deviation === 'scale') {
//     scores = scores.map( (score) => {
//       if (score >= average) {
//         return CGV.scaleValue(score, {min: average, max: max}, {min: 0.5, max: 1});
//       } else {
//         return CGV.scaleValue(score, {min: min, max: average}, {min: 0, max: 0.5});
//       }
//     });
//     min = 0;
//     max = 1;
//     average = 0.5;
//   }
//   return { positions: positions, scores: scores, min: min, max: max, average: average }
// }
// extractORFs(options = {}) {
//   this.viewer.flash('Finding ORFs...');
//   let startTime = new Date().getTime();
//   let features = new CGV.CGArray();
//   let type = 'ORF'
//   let source = 'orfs'
//   let minORFLength = CGV.defaultFor(options.minORFLength, 100)
//   // Get start features by reading frame
//   let startPattern = CGV.defaultFor(options.start, 'ATG')
//   let startFeatures = this.createFeaturesFromPattern(startPattern, 'start-codon', 'start-stop-codons');
//   let startsByRF = this.sequence.featuresByReadingFrame(startFeatures);
//   // Get stop features by reading frame
//   let stopPattern = CGV.defaultFor(options.stop, 'TAA,TAG,TGA');
//   let stopFeatures = this.createFeaturesFromPattern(stopPattern, 'start-codon', 'start-stop-codons');
//   let stopsByRF = this.sequence.featuresByReadingFrame(stopFeatures);
//   // Get forward ORFs
//   let position,  orfLength, range, readingFrames;
//   readingFrames = ['rfPlus1', 'rfPlus2', 'rfPlus3'];
//   let start, stop, stopIndex;
//   for (let rf of readingFrames) {
//     position = 1;
//     stopIndex = 0;
//     for (let i = 0, len_i = startsByRF[rf].length; i < len_i; i++) {
//       start = startsByRF[rf][i];
//       if (start.start < position) {
//         continue;
//       }
//       for (let j = stopIndex, len_j = stopsByRF[rf].length; j < len_j; j++) {
//         stop = stopsByRF[rf][j];
//         orfLength = stop.stop - start.start;
//         if (orfLength >= minORFLength) {
//           position = stop.stop;
//           range = new CGV.CGRange(this.sequence, start.start, stop.stop);
//           features.push( this.createFeature(range, type, 1, source ) );
//           stopIndex = j;
//           break;
//         }
//       }
//     }
//   }
//   // Get reverse ORFs
//   readingFrames = ['rfMinus1', 'rfMinus2', 'rfMinus3'];
//   for (let rf of readingFrames) {
//     stopIndex = 0;
//     position = this.sequence.length;
//     let startsByRFSorted = startsByRF[rf].order_by('start', true);
//     let stopsByRFSorted = stopsByRF[rf].order_by('start', true);
//     for (let i = 0, len_i = startsByRF[rf].length; i < len_i; i++) {
//       start = startsByRF[rf][i];
//       if (start.start > position) {
//         continue;
//       }
//       for (let j = stopIndex, len_j = stopsByRF[rf].length; j < len_j; j++) {
//         stop = stopsByRF[rf][j];
//         orfLength = start.stop - stop.start;
//         if (orfLength >= minORFLength) {
//           position = stop.start;
//           range = new CGV.CGRange(this.sequence, stop.start, start.stop);
//           features.push( this.createFeature(range, type, -1, source ) );
//           stopIndex = j;
//           break;
//         }
//       }
//     }
//   }
//   console.log('ORF Extraction Time: ' + CGV.elapsedTime(startTime) );
//   return features
// }
// extractStartStops(options = {}) {
//   this.viewer.flash('Finding Start/Stop Codons...');
//   let startTime = new Date().getTime();
//   // Forward and Reverse Starts
//   let startPattern = CGV.defaultFor(options.start, 'ATG')
//   let features = this.createFeaturesFromPattern(startPattern, 'start-codon', 'start-stop-codons');
//   // Forward and Reverse Stops
//   let stopPattern = CGV.defaultFor(options.stop, 'TAA,TAG,TGA');
//   features.merge( this.createFeaturesFromPattern(stopPattern, 'stop-codon', 'start-stop-codons'))
//   console.log('Start/Stop Extraction Time: ' + CGV.elapsedTime(startTime) );
//   return features
// }
//
// createFeaturesFromPattern(pattern, type, source) {
//   let features = new CGV.CGArray();
//   pattern = pattern.toUpperCase().split(',').map( (s) => { return s.trim() }).join('|')
//   for (let strand of [1, -1]) {
//     // let startTime = new Date().getTime();
//     let ranges = this.sequence.findPattern(pattern, strand)
//     // console.log("Find Pattern '" + pattern + "' Strand " + strand + " Time: " + CGV.elapsedTime(startTime) );
//     // let startTime = new Date().getTime();
//     for (let i = 0, len = ranges.length; i < len; i++) {
//       features.push( this.createFeature(ranges[i], type, strand, source ) );
//     }
//     // console.log("Features for Pattern '" + pattern + "' Strand " + strand + " Time: " + CGV.elapsedTime(startTime) );
//   }
//   return features.order_by('start')
// }
// createFeature(range, type, strand, source) {
//   let featureData = {
//     type: type,
//     start: range.start,
//     stop: range.stop,
//     strand: strand,
//     source: source,
//     extractedFromSequence: true
//   }
//   featureData.legend = this.getLegendItem(type).text;
//   return new CGV.Feature(this.viewer, featureData)
// }

