//////////////////////////////////////////////////////////////////////////////
// WorkerFeatureExtraction.js
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
 * Worker to extract features from the sequence (e.g. orfs, start-stop codons)
 * The progress is calculated for the entire sequence and we keep track of the
 * progressState as we find features for each contig.
 */
export default function WorkerFeatureExtraction() {
  onmessage = function(e) {
    const featureDataArray = processSequence(e.data);
    // let progressState;
    // const type = e.data.type;
    // console.log(`Starting ${type}`);
    // let featureDataArray = [];
    // if (type === 'start-stop-codons') {
    //   progressState = { start: 0, stop: 50 };
    //   featureDataArray = extractStartStopCodons(1, e.data, progressState);
    //   progressState = { start: 50, stop: 100 };
    //   featureDataArray = featureDataArray.concat( extractStartStopCodons(-1, e.data, progressState) );
    // } else if (type === 'orfs') {
    //   featureDataArray = extractORFs(e.data);
    // }
    // // Sort the features by start
    // featureDataArray.sort( (a, b) => {
    //   return a.start - b.start;
    // });

    // Return results
    postMessage({ messageType: 'complete', featureDataArray: featureDataArray });
    close();
    // console.log(`Done ${e.data.type}`);
  };
  onerror = function(e) {
    console.error(`Oops. Problem with ${e.data.type}`);
  };

  const processSequence = function(data) {
    let progressState;
    const type = data.type;
    const seqType = data.seqType;
    const seqData = data.seqData;
    const seqTotalLength = data.seqTotalLength;
    const options = data.options;
    console.log(`Starting ${type}`);
    let featureDataArray = [];
    let seqLengthCompleted = 0;
    let progressStart = 0;


    let seq, progressForStep, progressStop
    for (var i = 0, len = seqData.length; i < len; i++) {
      seq = seqData[i].seq;

      // Percentage of sequence processed in this iteration.
      progressForStep = seq.length / seqTotalLength * 100;
      progressStart = seqLengthCompleted / seqTotalLength * 100;
      progressStop = progressStart + progressForStep;
      // console.log(progressForStep)

      if (seqType === 'contigs') {
        options.contigID = seqData[i].name;
      }
      if (type === 'start-stop-codons') {
        progressState = { start: progressStart, stop: progressStart + (progressForStep / 2)};
        featureDataArray = featureDataArray.concat( extractStartStopCodons(seq, 1, options, progressState) );
        progressState = { start: progressState.stop, stop: progressStop };
        featureDataArray = featureDataArray.concat( extractStartStopCodons(seq, -1, options, progressState) );
      } else if (type === 'orfs') {
        progressState = { start: progressStart, stop: progressStop};
        featureDataArray = featureDataArray.concat( extractORFs(seq, options, progressState) );
      }
      // console.log( `${i}: ${(new Date().getTime()) - testStartTime} ms`);

      // Sort the features by start
      // FIXME: this needs to be done contig by contig. Do we need to sort??
      // featureDataArray.sort( (a, b) => {
      //   return a.start - b.start;
      // });
      seqLengthCompleted += seq.length;
    }
    return featureDataArray;
  }

  const extractStartStopCodons = function(seq, strand, options, progressState = {}) {
    let progress = 0;
    let savedProgress = 0;
    const source = 'start-stop-codons';
    seq = (strand === 1) ? seq : reverseComplement(seq);
    const startPattern = options.startPattern.toUpperCase().split(',').map( s => s.trim() ).join('|');
    const stopPattern = options.stopPattern.toUpperCase().split(',').map( s => s.trim() ).join('|');
    const totalPattern = `${startPattern}|${stopPattern}`;
    const startPatternArray = startPattern.split('|');
    const stopPatternArray = stopPattern.split('|');

    const re = new RegExp(totalPattern, 'g');
    let match, start, featureData, type;
    const seqLength = seq.length;
    const featureDataArray = [];

    while ( (match = re.exec(seq)) !== null) {
      start = (strand === 1) ? (match.index + 1) : (seqLength - match.index - match[0].length + 1);
      if (startPatternArray.indexOf(match[0]) >= 0) {
        type = 'start-codon';
      } else if (stopPatternArray.indexOf(match[0]) >= 0) {
        type = 'stop-codon';
      }

      featureData = {
        type: type,
        start: start,
        stop: start + match[0].length - 1,
        strand: strand,
        source: source,
        contig: options.contigID,
        extractedFromSequence: true
      };
      featureDataArray.push(featureData);

      // Progress
      progress = Math.round( (strand === 1) ? (start / seqLength * 100) : ( (seqLength - start) / seqLength * 100) );
      savedProgress = postProgress(progress, savedProgress, progressState);

      re.lastIndex = match.index + 1;
    }
    return featureDataArray;
  };

  const postProgress = function(currentProgress, savedProgress, progressState = {}) {
    const progressStart = Math.round(progressState.start || 0);
    const progressStop = Math.round(progressState.stop || 100)
    const progressIncrement = progressState.increment || 1;
    const progressRange = progressStop - progressStart;
    if ( (currentProgress > savedProgress) && (currentProgress % progressIncrement === 0) ) {
      const oldMessageProgress = progressStart + (progressRange * savedProgress / 100);
      savedProgress = currentProgress;
      const messageProgress = progressStart + (progressRange * currentProgress / 100);
      if (messageProgress > oldMessageProgress && messageProgress % progressIncrement === 0) {
        postMessage({ messageType: 'progress', progress: messageProgress });
      }
    }
    return savedProgress;
  };

  const extractORFs = function(seq, options, progressState = {}) {
    const minORFLength = options.minORFLength;
    const seqLength = seq.length;
    let featureDataArray = [];

    const progressStart = progressState.start || 0;
    const progressStop = progressState.stop || 100;
    const progressRange = progressStop - progressStart;
    const progressPortion = progressRange / 4;

    // progressState = {start: 0, stop: 25};
    progressState = {start: progressStart, stop: progressStart + progressPortion};
    let codonDataArray = extractStartStopCodons(seq, 1, options, progressState);
    // progressState = {start: 25, stop: 50};
    progressState = {start: progressState.stop, stop: progressStart + progressPortion * 2};
    codonDataArray = codonDataArray.concat( extractStartStopCodons(seq, -1, options, progressState) );
    const startFeatures = codonDataArray.filter( f => f.type === 'start-codon' );
    const stopFeatures = codonDataArray.filter( f => f.type === 'stop-codon' );

    const startsByRF = featuresByReadingFrame(startFeatures, seqLength);
    const stopsByRF = featuresByReadingFrame(stopFeatures, seqLength);

    // progressState = {start: 50, stop: 75};
    progressState = {start: progressState.stop, stop: progressStart + progressPortion * 3};
    featureDataArray =  orfsByStrand(1, startsByRF, stopsByRF, seqLength, options, progressState);
    // progressState = {start: 75, stop: 100};
    progressState = {start: progressState.stop, stop: progressStop};
    featureDataArray = featureDataArray.concat( orfsByStrand(-1, startsByRF, stopsByRF, seqLength, options, progressState) );
    return featureDataArray;
  };

  const orfsByStrand = function(strand, startsByRF, stopsByRF, seqLength, options= {}, progressState = {}) {
    let position, orfLength, starts, stops;
    let start, stop, stopIndex, featureData;
    let progress, savedProgress;
    const minORFLength = options.minORFLength || 100;
    const type = 'ORF';
    const source = 'orfs';
    const featureDataArray = [];
    const readingFrames = (strand === 1) ? ['rfPlus1', 'rfPlus2', 'rfPlus3'] : ['rfMinus1', 'rfMinus2', 'rfMinus3'];
    // for (let rf of readingFrames) {
    readingFrames.forEach( function(rf) {
      position = (strand === 1) ? 1 : seqLength;
      stopIndex = 0;
      starts = startsByRF[rf];
      stops = stopsByRF[rf];
      const progressInitial = 33 * readingFrames.indexOf(rf);
      progress = 0;
      savedProgress = 0;
      if (strand === -1) {
        // Sort descending by start
        starts.sort( (a, b) => b.start - a.start );
        stops.sort( (a, b) => b.start - a.start );
      }
      for (let i = 0, iLen = starts.length; i < iLen; i++) {
        start = starts[i];
        progress = progressInitial + Math.round( i / iLen * 33);
        savedProgress = postProgress(progress, savedProgress, progressState);
        if ( ((strand === 1) && (start.start < position)) || ((strand === -1) && (start.start > position)) ) {
          continue;
        }
        for (let j = stopIndex, jLen = stopsByRF[rf].length; j < jLen; j++) {
          stop = stops[j];
          // Length is without the stop codon (so we exclude it: -2 bp instead of + 1)
          orfLength = (strand === 1) ? stop.stop - start.start - 2 : start.stop - stop.start - 2;
          // ORF length is measure in codons (ie. if minORFLength is 100, then 300 bp (without stop codon))
          if (orfLength >= (minORFLength * 3)) {
            position = (strand === 1) ? stop.stop : stop.start;

            featureData = {
              type: type,
              start: (strand === 1) ? start.start : stop.start,
              stop: (strand === 1) ? stop.stop : start.stop,
              strand: strand,
              source: source,
              contig: options.contigID,
              extractedFromSequence: true
            };
            featureDataArray.push(featureData);

            // progress = Math.round(start / seqLength * 100);
            // if ( (progress > savedProgress) && (progress % progressIncrement === 0) ) {
            //   savedProgress = progress;
            //   postMessage({ messageType: 'progress', progress: progress });
            // }

            stopIndex = j;
            break;
          } else if (orfLength > 0) {
            position = (strand === 1) ? stop.stop : stop.start;
            stopIndex = j;
            break;
          }
        }
      }
    });
    return featureDataArray;
  };

  const reverseComplement = function(seq) {
    return complement( seq.split('').reverse().join('') );
  };

  const complement = function(seq) {
    let compSeq = '';
    let char, compChar;
    for (let i = 0, len = seq.length; i < len; i++) {
      char = seq.charAt(i);
      switch (char) {
      case 'A':
        compChar = 'T';
        break;
      case 'T':
        compChar = 'A';
        break;
      case 'G':
        compChar = 'C';
        break;
      case 'C':
        compChar = 'G';
      }
      compSeq = compSeq + compChar;
    }
    return compSeq;
  };

  const featuresByReadingFrame = function(features, seqLength) {
    const featuresByRF = {
      rfPlus1: [],
      rfPlus2: [],
      rfPlus3: [],
      rfMinus1: [],
      rfMinus2: [],
      rfMinus3: []
    };
    let rf, feature;
    for (let i = 0, len = features.length; i < len; i++) {
      feature = features[i];
      if (feature.strand === -1) {
        rf = (seqLength - feature.stop + 1) % 3;
        if (rf === 0) { rf = 3; }
        featuresByRF[`rfMinus${rf}`].push(feature);
      } else {
        rf = feature.start % 3;
        if (rf === 0) { rf = 3; }
        featuresByRF[`rfPlus${rf}`].push(feature);
      }
    }
    return featuresByRF;
  };
};

