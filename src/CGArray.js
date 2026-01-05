//////////////////////////////////////////////////////////////////////////////
// CGArray
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
 * CGArray is essentially an array for holding CGV Objects. Any method
 * that works on an Array will also work on a CGArray.
 *
 * If a single array is provided it will be converted to an CGArray.
 * If mulitple elements are provided, they will be added to the new CGArray.
 *
 * ### Examples
 * ```js
 * const a1 = new CGArray(1, 2, 3);
 * => CGArray [1,2,3]
 *
 * const a2 = new CGArray([1,2,3])
 * => CGArray [1,2,3]
 * ```
 */
class CGArray extends Array {

  constructor(...items) {
    let elements = items;
    if ( (items.length === 1) && (Array.isArray(items[0])) ) {
      elements = items[0];
    }
    if (elements.length === 1) {
      super();
      this.push(elements[0]);
    } else if (elements.length > 20000) {
      // Note: 50,000 was too large, so we're trying 40,000
      // Note: 40,000 was too large (on Chrome), so now we're trying 30,000 - 2022-02-22
      // Note: 30,000 was too large (on Chrome), so now we're trying 20,000 - 2022-05-03
      super();
      for (let i = 0, len = elements.length; i < len; i++) {
        this.push(elements[i]);
      }
    } else {
      super(...elements);
    }
  }

  /**
 * Return the string 'CGArray'
 * @return {String}
 */
  toString() {
    return 'CGArray';
  }

  /**
 * Returns true if the CGArray is not empty.
 * @return {Boolean}
 */
  present() {
    return this.length > 0;
  }

  /**
 * Return true if the CGArray is empty.
 * @return {Boolean}
 */
  empty() {
    return this.length === 0;
  }

  /**
 * Returns new CGArray with element removed
 * @return {CGArray}
 */
  remove(element) {
    return this.filter( i => i !== element );
  }

  /**
   * Return the first element of the CGArray or "undefined" if the array is empty
   * @return {Element|or|undefined}
   */
  get first() {
    return this[0];
  }

  /**
   * Return the last element of the CGArray or "undefined" if the array is empty
   * @return {Element|or|undefined}
   */
  get last() {
    return this[this.length - 1];
  }

  // FIXME: return an CGArray with a single element of 0 when it should be empty
  // FIXME: Using Polyfill for now
  // filter(selector) {
    // return new CGV.CGArray(Array.prototype.filter(selector));
  // }

  filter(func, thisArg) {
    if ( ! ((typeof func === 'Function' || typeof func === 'function') && this) )
      throw new TypeError();

    let len = this.length >>> 0,
        res = new Array(len), // preallocate array
        t = this, c = 0, i = -1;
    if (thisArg === undefined){
      while (++i !== len){
        // checks to see if the key was set
        if (i in this){
          if (func(t[i], i, t)){
            res[c++] = t[i];
          }
        }
      }
    } else {
      while (++i !== len){
        // checks to see if the key was set
        if (i in this){
          if (func.call(thisArg, t[i], i, t)){
            res[c++] = t[i];
          }
        }
      }
    }

    res.length = c; // shrink down array to proper size
    return new CGArray(res);
  }

  /**
   * @private
   */
  // FIXME: return an CGArray with a single element of 0 when it should be empty
  // FIXME: Using Polyfill for now
  // https://github.com/jonathantneal/array-flat-polyfill/blob/master/src/flat.js
  flat() {
    var self = this;
    var depth = isNaN(arguments[0]) ? 1 : Number(arguments[0]);
    return depth ? Array.prototype.reduce.call(this, function (acc, cur) {
      if (Array.isArray(cur)) {
        acc.push.apply(acc, self.flat.call(cur, depth - 1));
      } else {
        acc.push(cur);
      }

      return acc;
    }, []) : Array.prototype.slice.call(this);
  }

  /**
   * @private
   */
  map(...rest) {
    return (this.length === 0) ? this : super.map(...rest);
  }

  /**
   * Move the an item from oldIndex to newIndex.
   * @param {Number} oldIndex - index of element to move
   * @param {Number} newIndex - move element to this index
   */
  move(oldIndex, newIndex) {
    if (newIndex >= this.length) {
      let k = newIndex - this.length;
      while ((k--) + 1) {
        this.push(undefined);
      }
    }
    this.splice(newIndex, 0, this.splice(oldIndex, 1)[0]);
    return this;
  }

  /**
   * Retrieve subset of CGArray or an individual element from CGArray depending on term provided.
   * To find elements by cgvID use [Viewer.objects](Viewer.html#objects) instead.
   * Term      | Returns
   * ----------|----------------
   * undefined | Full CGArray
   * Ingeter   | The element at the index (base-1)
   * String    | First element with an 'name' property same as string or undefined
   * Array     | CGArray with elements with matching 'name' property
   *
   * @param {Integer|String|Array} term - The values returned depend on the term (see above table).
   * @return {CGArray|or|Element}
   */
  get(term) {
    if (term === undefined) {
      return this;
    } else if (Number.isInteger(term)) {
      return this[term - 1];
    } else if (typeof term === 'string') {
      return this.filter( element => element.name && element.name.toLowerCase() === term.toLowerCase() )[0];
    } else if (Array.isArray(term)) {
      return this.filter( element => term.some( name => element.name === name ) );
    } else {
      return new CGArray();
    }
  }

  /**
   * Return new CGArray with no duplicated values.
   * @return {CGArray}
   */
  unique() {
  // return new CGArray(this.filter( onlyUnique ));
    return CGArray.from(new Set(this));
  }

  /**
   * Change one or more properties of each element of the CGArray.
   * ```javascript
   * my_cgarray.attr(property, value)
   * my_cgarray.attr( {property1: value1, property2: value2} )
   * ```
   *
   * @param {Property|Value} attributes A property name and the new value.
   * @param {Object}     attributes An object properties and their new values.
   * @return {CGArray}
   */
  attr(attributes) {
    if ( (arguments.length === 1) && (typeof attributes === 'object') ) {
      const keys = Object.keys(attributes);
      const keyLen = keys.length;
      for (let i = 0, len = this.length; i < len; i++) {
        for (let j = 0; j < keyLen; j++) {
          this[i][keys[j]] = attributes[keys[j]];
        }
      }
    } else if (arguments.length === 2) {
      for (let i = 0, len = this.length; i < len; i++) {
        this[i][arguments[0]] = arguments[1];
      }
    } else if (attributes !== undefined) {
      throw new Error('attr(): must be 2 arguments or a single object');
    }
    return this;
  }

  /**
  * iterates through each element of the cgarray and run the callback.
  * In the callback _this_ will refer to the element.
  * ```javascript
  * .each(function(index, element))
  * ```
  *
  * Note: This is slower then a _forEach_ or a _for loop_ directly on the set.
  * @param {Function} callback Callback run on each element of CGArray.
  *   The callback will be called with 2 parameters: the index of the element
  *   and the element itself.
  * @return {CGArray}
  */
  // NOTE: it may feel better if this was (item, index) not (index, item)
  each(callback) {
    for (let i = 0, len = this.length; i < len; i++) {
      callback.call(this[i], i, this[i]);
    }
    return this;
  }

  /**
   * Return the CGArray as an Array
   * @return {Array}
   * @private
   */
  asArray() {
    return Array.from(this);
  }

  /**
   * Returns the object incased as a CGArray. If it's already a CGArray, it is returned untouched.
   * Helpfull to handle method parameters that can submit a single object or a CGArray of objects.
   * @param {Object} object
   *
   * @return {CGArray}
   */
  static arrayerize (object) {
    return (object.toString() === 'CGArray') ? object : new CGArray(object);
  }

  /** @ignore */

  /**
 * Sorts the CGArray by the provided property name.
 * @param {String} property Property to order each element set by [default: 'center']
 * @param {Boolean} descending Order in descending order (default: false)
 * @return {CGArray}
 */
  // orderBy(property, descending) {
  //   // Sort by function call
  //   if (this.length > 0) {
  //
  //     if (typeof this[0][property] === 'function'){
  //       this.sort(function(a,b) {
  //         if (a[property]() > b[property]()) {
  //           return 1;
  //         } else if (a[property]() < b[property]()) {
  //           return -1;
  //         } else {
  //           return 0;
  //         }
  //       })
  //     } else {
  //     // Sort by property
  //       this.sort(function(a,b) {
  //         if (a[property] > b[property]) {
  //           return 1;
  //         } else if (a[property] < b[property]) {
  //           return -1;
  //         } else {
  //           return 0;
  //         }
  //       })
  //     }
  //   }
  //   if (descending) this.reverse();
  //   return this;
  // }


}

export default CGArray;


