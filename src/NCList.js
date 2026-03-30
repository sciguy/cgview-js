//////////////////////////////////////////////////////////////////////////////
// NCList
//////////////////////////////////////////////////////////////////////////////

/**
 * NCList.js – based on original code licensed under the Artistic License 2.0
 * See https://www.perlfoundation.org/artistic-license-20.html for license details.
 *
 * Major modifications by Jason R. Grant, © 2016–2026.
 *
 * This code is adapted from code in the JBrowse project:
 * https://searchcode.com/codesearch/view/17093141
 * (https://github.com/GMOD/jbrowse)
 *
 * The original algorithm is described in the paper:
 * Alekseyenko, A., and Lee, C. (2007).
 * Nested Containment List (NCList): A new algorithm for accelerating
 * interval query of genome alignment and interval databases.
 * Bioinformatics, doi:10.1093/bioinformatics/btl647
 * https://academic.oup.com/bioinformatics/article/23/11/1386/199545/Nested-Containment-List-NCList-a-new-algorithm-for
 */

/**
 * The NCList is a container for intervals that allows fast searching of overlaping regions.
 */
class NCList {

  /**
   * Each interval should have a start and stop property.
   * @param {Array} intervals - Array of Intervals used to create the NCList.
   * @param {Object} options -
   * @return {NCList}
   * @private
   */
  constructor(intervals = [], options = {}) {
    this.intervals = [];
    this.circularLength = options.circularLength;
    this.startProperty = options.startProperty || 'start';
    this.stopProperty = options.stopProperty || 'stop';
    this.fill(intervals);
  }

  /**
   * @member {Number} - The number of intervals in the NCList
   */
  get length() {
    return this._length;
  }


  /**
   * Splits intervals that span the Origin of cicular sequences
   */
  _normalize(intervals) {
    let interval;
    const nomalizedIntervals = [];
    for (let i = 0, len = intervals.length; i < len; i++) {
      interval = intervals[i];
      // if (interval.start <= interval.stop) {
      if (interval[this.startProperty] <= interval[this.stopProperty]) {
        nomalizedIntervals.push( {interval: interval, index: i});
      } else {
        nomalizedIntervals.push({
          interval: interval,
          index: i,
          // start: interval.start,
          // start: this.start(interval),
          // stop: this.circularLength,
          [this.startProperty]: this.start(interval),
          [this.stopProperty]: this.circularLength,
          crossesOrigin: true
        });
        nomalizedIntervals.push({
          interval: interval,
          index: i,
          // start: 1,
          // stop: this.end(interval),
          [this.startProperty]: 1,
          [this.stopProperty]: this.end(interval),
          crossesOrigin: true
        });
      }
    }
    return nomalizedIntervals;
  }

  /**
   * Fils the NCList with the given intervals
   * @param {Array} intervals - Array of intervals
   */
  fill(intervals) {
    this._length = intervals.length;
    if (intervals.length === 0) {
      this.topList = [];
      return;
    }
    // const start = this.start;
    // const end = this.end;
    const sublist = this.sublist;

    intervals = this._normalize(intervals);
    this.intervals = intervals;

    // Sort by overlap
    // intervals.sort(function(a, b) {
    intervals.sort( (a, b) => {
      if (this.start(a) !== this.start(b)) return this.start(a) - this.start(b);
      else return this.end(b) - this.end(a);
    });
    const sublistStack = [];
    let curList = [];
    this.topList = curList;
    curList.push(intervals[0]);
    if (intervals.length === 1) return;
    let curInterval, topSublist;
    for (let i = 1, len = intervals.length; i < len; i++) {
      curInterval = intervals[i];
      // if this interval is contained in the previous interval,
      if (this.end(curInterval) < this.end(intervals[i - 1])) {
        // create a new sublist starting with this interval
        sublistStack.push(curList);
        curList = new Array(curInterval);
        sublist(intervals[i - 1], curList);
      } else {
        // find the right sublist for this interval
        while (true) {
          if (0 === sublistStack.length) {
            curList.push(curInterval);
            break;
          } else {
            topSublist = sublistStack[sublistStack.length - 1];
            if (this.end(topSublist[topSublist.length - 1])
                        > this.end(curInterval)) {
              // curList is the first (deepest) sublist that
              // curInterval fits into
              curList.push(curInterval);
              break;
            } else {
              curList = sublistStack.pop();
            }
          }
        }
      }
    }
  }

  /**
   * Method to retrieve the stop coordinate of the interval
   */
  end(interval) {
    // return interval.stop || interval.interval.stop;
    // return interval.stop || interval.interval[this.stopProperty];
    return interval[this.stopProperty] || interval.interval[this.stopProperty];
  }

  /**
   * Method to retrieve the start coordinate of the interval
   */
  start(interval) {
    // return interval.start || interval.interval.start;
    // return interval.start || interval.interval[this.startProperty];
    return interval[this.startProperty] || interval.interval[this.startProperty];
  }

  /**
   * Method to set the sublist for the given interval.
   */
  sublist(interval, list) {
    interval.sublist = list;
  }

  _run(start, stop = start, step = 1, callback = function() {}, list = this.topList) {
    let skip, skipWrappingFeature;
    const len = list.length;
    let i, direction;
    if (step > 0) {
      direction = 1;
      i = this._binarySearch(list, start, true, 'end');
    } else if (step < 0) {
      direction = -1;
      i = this._binarySearch(list, stop, false, 'start');
    }
    while (i >= 0 && i < len &&
      ( (direction === 1) ? (this.start(list[i]) <= stop) : (this.end(list[i]) >= start) ) ) {
      skip = false;
      skipWrappingFeature = false;
      // Check for features that wrap around the visible region
      // E.g. starts near beginning of sequence and ends near end of sequence and were zoomed into the origin region
      if (this.visbleRangeCrossesOrigin) {
        if (this.start(list[i]) < stop && this.end(list[i]) > start) {
          skipWrappingFeature = true
        }
      }
      if (list[i].crossesOrigin || skipWrappingFeature) {
        if (this._runIntervalsCrossingOrigin.indexOf(list[i].interval) !== -1) {
          skip = true;
        } else {
          this._runIntervalsCrossingOrigin.push(list[i].interval);
        }
      }

      if (!skip && list[i].index % step === 0) {
        callback.call(list[i].interval, list[i].interval);
      }
      if (list[i].sublist) {
        this._run(start, stop, step, callback, list[i].sublist);
      }
      i += direction;
    }
  }

  /*
   * Run the callback for each interval that overlaps with the given range.
   * @param {Number} start - Start position of the range
   * @param {Number} stop - Stop position of the range [Default: same as start]
   * @param {Number} step - Skip intervals by increasing the step [Default: 1]
   */
  run(start, stop = start, step = 1, callback = function() {}) {
    // Keep track of features that cross the origin OR wrap around the visible range (e.g. visible range is zoomed into origin and feature starts at 1 and end near end of the sequence)
    // - so they will not be counted twice
    this._runIntervalsCrossingOrigin = [];
    if (this.circularLength && stop < start) {
      this.visbleRangeCrossesOrigin = true;
      this._run(start, this.circularLength, step,  callback);
      this._run(1, stop, step,  callback);
    } else {
      this.visbleRangeCrossesOrigin = false
      this._run(start, stop, step, callback);
    }
  }

  /*
   * Count the number of intervals that overlaps with the given range.
   * @param {Number} start - Start position of the range
   * @param {Number} stop - Stop position of the range [Default: same as start]
   * @param {Number} step - Skip intervals by increasing the step [Default: 1]
   * @return {Number}
   */
  count(start, stop, step) {
    let count = 0;
    this.run(start, stop, step, () => {
      count++;
    });
    return count;
  }

  /*
   * Return intervals that overlaps with the given range.
   * @param {Number} start - Start position of the range
   * @param {Number} stop - Stop position of the range [Default: same as start]
   * @param {Number} step - Skip intervals by increasing the step [Default: 1]
   * @return {Array}
   */
  find(start, stop, step) {
    const overlaps = [];
    this.run(start, stop, step, (i) => {
      overlaps.push(i);
    });
    return overlaps;
  }


  _binarySearch(data, searchValue, upper, getter) {
    let minIndex = -1;
    let maxIndex = data.length;
    let currentIndex, currentValue;

    while (maxIndex - minIndex > 1) {
      currentIndex = (minIndex + maxIndex) / 2 | 0;
      currentValue = this[getter](data[currentIndex]);
      if (currentValue < searchValue) {
        minIndex = currentIndex;
      } else if (currentValue > searchValue) {
        maxIndex = currentIndex;
      } else {
        return currentIndex;
      }
    }
    return (upper ? maxIndex : minIndex);
  }


  /*
   * Test that the correct intervals are returned especially for circular sequences
   */
  static test() {
    function testInterval(nc, start, stop, expected) {
      const result = nc.find(start, stop).map( n => n.name ).sort().join(', ');
      expected = expected.sort().join(', ');
      let testOut = `${start}..${stop}: ${expected} - `;
      testOut += (result === expected) ? 'Pass' : `${'FAIL' + ' - '}${result}`;
      console.log(testOut);
    }

    const intervals = [
      {name: 'A', start: 1, stop: 20},
      {name: 'B', start: 10, stop: 15},
      {name: 'C', start: 10, stop: 20},
      {name: 'D', start: 15, stop: 30},
      {name: 'E', start: 20, stop: 30},
      {name: 'F', start: 20, stop: 50},
      {name: 'G', start: 80, stop: 100},
      {name: 'H', start: 90, stop: 95},
      {name: 'I', start: 90, stop: 5},
      {name: 'J', start: 95, stop: 15},
      {name: 'K', start: 95, stop: 2},
      {name: 'L', start: 92, stop: 50}
    ];
    const nc = new NCList(intervals, { circularLength: 100 });

    testInterval(nc, 10, 20, ['A', 'B', 'C', 'D', 'E', 'F', 'J', 'L']);
    testInterval(nc, 40, 85, ['F', 'G', 'L']);
    testInterval(nc, 40, 95, ['F', 'G', 'H', 'I', 'J', 'K', 'L']);
    testInterval(nc, 95, 10, ['A', 'B', 'C', 'G', 'H', 'I', 'J', 'K', 'L']);

    return nc;
  }

  static testMapStarts() {
    function testInterval(nc, start, stop, expected) {
      const result = nc.find(start, stop).map( n => n.name ).sort().join(', ');
      expected = expected.sort().join(', ');
      let testOut = `${start}..${stop}: ${expected} - `;
      testOut += (result === expected) ? 'Pass' : `${'FAIL' + ' - '}${result}`;
      console.log(testOut);
    }

    const intervals = [
      {name: 'A', mapStart: 10, mapStop: 10},
      {name: 'B', mapStart: 20, mapStop: 21},
      {name: 'C', mapStart: 950, mapStop: 5},
    ];
    // const nc = new NCList(intervals, { circularLength: 1000 });
    const nc = new NCList(intervals, { circularLength: 1000, startProperty: 'mapStart', stopProperty: 'mapStop'});

    testInterval(nc, 900, 200, ['A', 'B', 'C']);

    return nc;
  }
  static testMapStarts2() {
    function testInterval(nc, start, stop, expected) {
      const result = nc.find(start, stop).map( n => n.name ).sort().join(', ');
      expected = expected.sort().join(', ');
      let testOut = `${start}..${stop}: ${expected} - `;
      testOut += (result === expected) ? 'Pass' : `${'FAIL' + ' - '}${result}`;
      console.log(testOut);
    }

    const intervals = [
      {name: 'A', start: 10, stop: 10},
      {name: 'B', start: 20, stop: 21},
      {name: 'C', start: 950, stop: 5},
    ];
    // const nc = new NCList(intervals, { circularLength: 1000 });
    const nc = new NCList(intervals, { circularLength: 1000, startProperty: 'start', stopProperty: 'stop'});

    testInterval(nc, 900, 200, ['A', 'B', 'C']);

    return nc;
  }

}

export default NCList;
