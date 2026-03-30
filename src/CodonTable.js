//////////////////////////////////////////////////////////////////////////////
// CodonTable and CodonTables
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
 * Holder for CodonTables.
 * This class will be populated with each [CodonTable](CodonTable.html) as it's required.
 *
 * ### Examples:
 * ```js
 * // Initially this class will have no
 * const codonTables = new CodonTables();
 * codonTables.tables;
 * // => {}
 *
 * Tables are accessed via byID
 * codonTables.byID(1)
 * // => CodonTable {name: 'Standard', ...}
 *
 * // This will also add the table to tables:
 * codonTables.tables;
 * // => { 1: {name: 'Standard', ...} }
 * ```
 */
class CodonTables {

  /**
   * Create an empty container to lazy load codon tables as needed
   */
  constructor() {
    this._tables = {};
  }

  /**
   * Return the current tables
   */
  get tables() {
    return this._tables;
  }

  /**
   * Return the table for provided code
   * @param {Number|String} id - ID of the Codon Table (e.g. 1, '1')
   */
  byID(id) {
    const availableIDs = CodonTable.availableGeneticCodeIDs;
    const idString = id.toString();
    let table;
    if (this.tables[idString]) {
      table = this.tables[idString];
    } else if (availableIDs.includes(idString)) {
      table = new CodonTable(idString);
      this.tables[idString] = table;
    } else {
      console.error(`Unknown Codon Table ID: '${id}'`)
    }
    return table;
  }

  /**
   * Returns object with table codes as the keys and the values as the table names
   * ```js
   * codonTables.names()
   * // => {1: 'Standard', 2: 'Vertebrate Mitochondrial', ...}
   * ```
   */
  names() {
    const codes = {};
    const ids = Object.keys(CodonTable.definitions);
    ids.map( id => codes[id] = CodonTable.definitions[id].name);
    return codes
  }

  /**
   * Translate a sequence
   * @param {String} seq - The sequence to translate
   * @param {Number} geneticCodeID - The genetic code ID (e.g. 1)
   * @param {Number} startCodon - Position (bp) of the first codon
   */
  translate(seq, geneticCodeID, startCodon=1) {
    const table = this.byID(geneticCodeID);
    if (table) {
      return table.translate(seq, startCodon);
    }
  }
}

/**
 * This class contains all the codon table definitions and has the ability to translate
 * DNA seqeunces to protein.
 */
class CodonTable {

  /**
   * Create a new codon table
   * @param {Number} geneticCodeID - ID for the genetic code (e.g. 1 for 'Standard' code)
   */
  constructor(geneticCodeID) {
    this._codons = this.generateCodons();
    this._geneticCodeID = geneticCodeID && geneticCodeID.toString();
    this._generateTable();
  }

  /**
   * Return the class name as a string.
   * @return {String} - 'CodonTable'
   */
  toString() {
    return 'CodonTable';
  }

  /**
   * Return array of all the available genetic code IDs
   */
  static get availableGeneticCodeIDs() {
    return Object.keys(CodonTable.definitions);
  }

  /**
   * Return a list of the 64 codons, sorted in the following order: T, C, A, G
   */
  get codons() {
    return this._codons;
  }

  /**
   * Return the genetic code for this codon table
   */
  get geneticCodeID() {
    return this._geneticCodeID;
  }

  /**
   * Return the name for this codon table
   */
  get name() {
    return this._name;
  }

  /**
   * Return the table for this codon table
   */
  get table() {
    return this._table;
  }

  /**
   * Return the start codons for this codon table
   */
  get starts() {
    return this._starts;
  }

  /**
   * Return the stop codons for this codon table
   */
  get stops() {
    return this._stops;
  }

  /**
   * Creates the table for this codon table
   * @private
   */
  _generateTable() {
    const codeID = this.geneticCodeID;
    if (CodonTable.availableGeneticCodeIDs.includes(codeID)) {
      const definition = CodonTable.definitions[codeID];
      // Name
      this._name = definition.name;
      // Table, starts, stops
      const table = {};
      const starts = [];
      const stops = [];
      for (const [i, codon] of this.codons.entries()) {
        table[codon] = definition.aa[i];
        if (definition.starts[i] === 'M') {
          starts.push(codon);
        }
        if (definition.aa[i] === '*') {
          stops.push(codon);
        }
      }
      this._table = table;
      this._starts = starts;
      this._stops = stops;
    } else {
      console.error(`Unknown Codon Table ID: '${codeID}'`)
    }
  }

  /**
   * Generate the codons using the nucleotides sorted by: T, C, A, G
   * @private
   */
  generateCodons() {
    // Base1 = TTTTTTTTTTTTTTTTCCCCCCCCCCCCCCCCAAAAAAAAAAAAAAAAGGGGGGGGGGGGGGGG
    // Base2 = TTTTCCCCAAAAGGGGTTTTCCCCAAAAGGGGTTTTCCCCAAAAGGGGTTTTCCCCAAAAGGGG
    // Base3 = TCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAG
    const bases = ['T', 'C', 'A', 'G'];
    const codons = [];
    for (const b1 of bases) {
      for (const b2 of bases) {
        for (const b3 of bases) {
          codons.push(`${b1}${b2}${b3}`);
        }
      }
    }
    return codons;
  }

  /**
   * Returns all the available codon table definitions
   */
  static get definitions() {
    //   Base1 = TTTTTTTTTTTTTTTTCCCCCCCCCCCCCCCCAAAAAAAAAAAAAAAAGGGGGGGGGGGGGGGG
    //   Base2 = TTTTCCCCAAAAGGGGTTTTCCCCAAAAGGGGTTTTCCCCAAAAGGGGTTTTCCCCAAAAGGGG
    //   Base3 = TCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAG
    const definitions = {
      1: {
        name:   'Standard',
        aa:     'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
        starts: '---M---------------M---------------M----------------------------',
      },
      2: {
        name:   'Vertebrate Mitochondrial',
        aa:     'FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIMMTTTTNNKKSS**VVVVAAAADDEEGGGG',
        starts: '--------------------------------MMMM---------------M------------',
      },
      3: {
        name:   'Yeast Mitochondrial',
        aa:     'FFLLSSSSYY**CCWWTTTTPPPPHHQQRRRRIIMMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
        starts: '----------------------------------MM----------------------------',
      },
      4: {
        name:   'Mold, Protozoan, Coelenterate Mitochondrial and Mycoplasma/Spiroplasma',
        aa:     'FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
        starts: '--MM---------------M------------MMMM---------------M------------',
      },
      5: {
        name:   'Invertebrate Mitochondrial',
        aa:     'FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIMMTTTTNNKKSSSSVVVVAAAADDEEGGGG',
        starts: '---M----------------------------MMMM---------------M------------',
      },
      6: {
        name:   'Ciliate, Dasycladacean and Hexamita Nuclear',
        aa:     'FFLLSSSSYYQQCC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
        starts: '-----------------------------------M----------------------------',
      },
      9: {
        name:   'Echinoderm and Flatworm Mitochondrial',
        aa:     'FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIIMTTTTNNNKSSSSVVVVAAAADDEEGGGG',
        starts: '-----------------------------------M---------------M------------',
      },
      10: {
        name:   'Euplotid Nuclear',
        aa:     'FFLLSSSSYY**CCCWLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
        starts: '-----------------------------------M----------------------------',
      },
      11: {
        name:   'Bacterial and Plant Plastid',
        aa:     'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
        starts: '---M---------------M------------MMMM---------------M------------',
      },
      12: {
        name:   'Alternative Yeast Nuclear',
        aa:     'FFLLSSSSYY**CC*WLLLSPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
        starts: '-------------------M---------------M----------------------------',
      },
      13: {
        name:   'Ascidian Mitochondrial',
        aa:     'FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIMMTTTTNNKKSSGGVVVVAAAADDEEGGGG',
        starts: '---M------------------------------MM---------------M------------',
      },
      14: {
        name:   'Alternative Flatworm Mitochondrial',
        aa:     'FFLLSSSSYYY*CCWWLLLLPPPPHHQQRRRRIIIMTTTTNNNKSSSSVVVVAAAADDEEGGGG',
        starts: '-----------------------------------M----------------------------',
      },
      15: {
        name:   'Blepharisma Nuclear',
        aa:     'FFLLSSSSYY*QCC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
        starts: '-----------------------------------M----------------------------',
      },
      16: {
        name:   'Chlorophycean Mitochondrial',
        aa:     'FFLLSSSSYY*LCC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
        starts: '-----------------------------------M----------------------------',
      },
      21: {
        name:   'Trematode Mitochondrial',
        aa:     'FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIMMTTTTNNNKSSSSVVVVAAAADDEEGGGG',
        starts: '-----------------------------------M---------------M------------',
      },
      22: {
        name:   'Scenedesmus obliquus mitochondrial',
        aa:     'FFLLSS*SYY*LCC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
        starts: '-----------------------------------M----------------------------',
      },
      23: {
        name:   'Thraustochytrium Mitochondrial',
        aa:     'FF*LSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
        starts: '--------------------------------M--M---------------M------------',
      },
    }
    return definitions;
  }

    /**
   * Translate a sequence using this codon table. If the first codon, is a start codon,
   * it will be translated as 'M' instead of the amino acid.
   * @param {String} rawSeq - The sequence to translate
   * @param {Number} codonStart - Position (bp) of the first codon
   */
    translate(rawSeq, codonStart=1) {
      const codonSize = 3;
      const seq = rawSeq.toUpperCase();
      let index = -1 + codonStart;
      let codon = seq.slice(index, index + codonSize);
      let translated = '';
      let firstCodon = true;
      while (codon.length === codonSize) {
        if (firstCodon && this.starts.includes(codon)) {
          translated += 'M';
        } else {
          translated += this.table[codon] || 'X';
        }
        index += codonSize;
        codon = seq.slice(index, index + codonSize);
        firstCodon = false;
      }
      return translated;
    }

}

export { CodonTables, CodonTable };

