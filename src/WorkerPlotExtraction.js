//////////////////////////////////////////////////////////////////////////////
// WorkerPlotExtraction.js
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
 * Worker to extract plot data from the sequence (e.g. gc-content, gc-skew)
 */
export default function WorkerBaseContent() {
  onmessage = function(e) {
    console.log(`Starting ${e.data.type}`);
    calculateBaseContent(e.data);
    console.log(`Done ${e.data.type}`);
  };
  onerror = function(e) {
    console.error(`Oops. Problem with ${e.data.type}`);
  };

  const calculateBaseContent = function(data) {
    let progress = 0;
    let savedProgress = 0;
    const progressIncrement = 5;
    const positions = [];
    let scores = [];
    const type = data.type;
    const seq = data.seqData[0].seq;
    const options = data.options;
    const windowSize = options.window;
    const step = options.step;
    const deviation = options.deviation;
    let average = baseCalculation(type, seq);
    // Starting points for min and max
    let min = 1;
    let max = 0;
    const halfWindowSize = windowSize / 2;
    let start, stop;

    // Position marks the middle of the calculated window
    for (let position = 1, len = seq.length; position < len; position += step) {
      // Extract DNA for window and calculate score
      start = subtractBp(seq, position, halfWindowSize);
      stop = addBp(seq, position, halfWindowSize);
      const subSeq = subSequence(seq, start, stop);
      const score = baseCalculation(type, subSeq);

      if (score > max) {
        max = score;
      }
      if (score < min) {
        min = score;
      }

      // The current position marks the middle of the calculated window.
      // Adjust the bp position to mark where the plot changes,
      // NOT the center point of the window.
      // i.e. half way between the current position and the last
      if (position === 1) {
        positions.push(1);
      } else {
        positions.push(position - (step / 2));
      }
      // positions.push(position);

      scores.push(score);
      progress = Math.round(position / len * 100);
      if ( (progress > savedProgress) && (progress % progressIncrement === 0) ) {
        savedProgress = progress;
        postMessage({ messageType: 'progress', progress: progress });
      }
    }
    // console.log(`Deviation: ${deviation}`)
    console.log(`Min: ${min}`)
    console.log(`Max: ${max}`)
    console.log(`Average: ${average}`)

    // Adjust scores if scaled
    // Min value becomes 0
    // Max value becomes 1
    // Average becomes 0.5
    if (deviation === 'scale') {
      scores = scores.map( (score) => {
        if (score >= average) {
          return scaleValue(score, {min: average, max: max}, {min: 0.5, max: 1});
        } else {
          return scaleValue(score, {min: min, max: average}, {min: 0, max: 0.5});
        }
      });
      min = 0;
      max = 1;
      average = 0.5;
    }
    const baseContent = { positions: positions, scores: scores, min: min, max: max, average: average };
    postMessage({ messageType: 'complete', baseContent: baseContent });
  };

  const baseCalculation = function(type, seq) {
    if (type === 'gc-content') {
      return calcGCContent(seq);
    } else if (type === 'gc-skew') {
      return calcGCSkew(seq);
    }
  };

  const calcGCContent = function(seq) {
    if (seq.length === 0) { return  0.5; }
    const g = count(seq, 'g');
    const c = count(seq, 'c');
    return ( (g + c) / seq.length );
  };

  const calcGCSkew = function(seq) {
    const g = count(seq, 'g');
    const c = count(seq, 'c');
    if ( (g + c) === 0 ) { return 0.5; }
    // Gives value between -1 and 1
    const value = (g - c) / (g + c);
    // Scale to a value between 0 and 1
    // return  0.5 + (value / 2);
    return  value;
  };

  const count = function(seq, pattern) {
    return (seq.match(new RegExp(pattern, 'gi')) || []).length;
  };

  /**
   * Subtract *bpToSubtract* from *position*, taking into account the sequence length
   * @param {Number} position - position (in bp) to subtract from
   * @param {Number} bpToSubtract - number of bp to subtract
   */
  const subtractBp = function(seq, position, bpToSubtract) {
    if (bpToSubtract < position) {
      return position - bpToSubtract;
    } else {
      return seq.length + position - bpToSubtract;
    }
  };

  /**
   * Add *bpToAdd* to *position*, taking into account the sequence length
   * @param {Number} position - position (in bp) to add to
   * @param {Number} bpToAdd - number of bp to add
   */
  const addBp = function(seq, position, bpToAdd) {
    if (seq.length >= (bpToAdd + position)) {
      return bpToAdd + position;
    } else {
      return position - seq.length + bpToAdd;
    }
  };

  const subSequence = function(seq, start, stop) {
    let subSeq;
    if (stop < start) {
      // subSeq = seq.substr(start - 1) + seq.substr(0, stop);
      subSeq = seq.substring(start - 1) + seq.substring(0, stop);
    } else {
      // subSeq = seq.substr(start - 1, (stop - start));
      subSeq = seq.substring(start - 1, stop);
    }
    return subSeq;
  };

  /**
   * This function scales a value from the *from* range to the *to* range.
   * To scale from [min,max] to [a,b]:
   *
   *                 (b-a)(x - min)
   *          f(x) = --------------  + a
   *                   max - min
   */
  const scaleValue = function(value, from = {min: 0, max: 1}, to = {min: 0, max: 1}) {
    return ((to.max - to.min) * (value - from.min) / (from.max - from.min)) + to.min;
  };
};

