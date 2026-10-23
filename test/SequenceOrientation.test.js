import Sequence from '../src/Sequence';
import Viewer from '../src/Viewer';

describe('Sequence complementation', () => {
  test.each([
    ['A', 'T'], ['T', 'A'], ['G', 'C'], ['C', 'G'],
    ['R', 'Y'], ['Y', 'R'], ['S', 'S'], ['W', 'W'],
    ['K', 'M'], ['M', 'K'], ['B', 'V'], ['D', 'H'],
    ['H', 'D'], ['V', 'B'], ['N', 'N'], ['U', 'A'],
  ])('complements %s to %s in either case', (base, complement) => {
    expect(Sequence.complement(base)).toBe(complement);
    expect(Sequence.complement(base.toLowerCase())).toBe(complement.toLowerCase());
  });

  test('preserves mixed case, gaps and unknown symbols independently', () => {
    expect(Sequence.complement('aCgT')).toBe('tGcA');
    expect(Sequence.complement('?A?R.-u')).toBe('?T?Y.-a');
    expect(Sequence.complement('')).toBe('');
    expect(Sequence.reverseComplement('')).toBe('');
  });

  test('reverse complements ambiguity bases without reusing the preceding result', () => {
    expect(Sequence.reverseComplement('ARY')).toBe('RYT');
    expect(Sequence.reverseComplement('ACGTRYSWKMBDHVN')).toBe('NBDHVKMWSRYACGT');
    expect(Sequence.reverseComplement('acgtryswkmbdhvn')).toBe('nbdhvkmwsryacgt');
    expect(Sequence.reverseComplement(Sequence.reverseComplement('ACGTRYSWKMBDHVN')))
      .toBe('ACGTRYSWKMBDHVN');
  });

  test('reverse complements the complete extracted range, including origin wrapping', () => {
    expect(Sequence.forRange('AARYC', {start: 2, stop: 4}, true)).toBe('RYT');
    expect(Sequence.forRange('ARYCGT', {start: 5, stop: 3}, true)).toBe('RYTAC');
  });
});

describe('Contig orientation', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="map"></div>'; });

  test('changes bases and feature coordinates once per orientation transition', () => {
    const viewer = new Viewer('#map', {
      sequence: {contigs: [{name: 'one', seq: 'ACGTRYSWKMBDHVN'}]},
      features: [{name: 'gene', contig: 'one', start: 2, stop: 5, strand: 1}],
    });
    const contig = viewer.sequence.contigs(1);
    const feature = viewer.features(1);
    contig.update({orientation: '+'});
    expect(contig.seq).toBe('ACGTRYSWKMBDHVN');
    expect([feature.start, feature.stop, feature.strand]).toEqual([2, 5, 1]);

    contig.update({orientation: '-'});
    expect(contig.seq).toBe('NBDHVKMWSRYACGT');
    expect([feature.start, feature.stop, feature.strand]).toEqual([11, 14, -1]);
    contig.update({orientation: '-'});
    expect(contig.seq).toBe('NBDHVKMWSRYACGT');
    expect([feature.start, feature.stop, feature.strand]).toEqual([11, 14, -1]);

    contig.update({orientation: '+'});
    expect(contig.seq).toBe('ACGTRYSWKMBDHVN');
    expect([feature.start, feature.stop, feature.strand]).toEqual([2, 5, 1]);
    contig.update({orientation: '+'});
    expect(contig.seq).toBe('ACGTRYSWKMBDHVN');
    contig.update({orientation: '-'});
    expect(contig.seq).toBe('NBDHVKMWSRYACGT');
  });

  test.each(['+', '-'])('preserves already oriented bases when loading and reopening %s', orientation => {
    const viewer = new Viewer('#map', {
      sequence: {contigs: [{name: 'one', seq: 'ARYCGT', orientation}]},
      features: [{name: 'gene', contig: 'one', start: 2, stop: 4, strand: -1}],
    });
    expect(viewer.sequence.contigs(1).seq).toBe('ARYCGT');
    const saved = viewer.io.toJSON();
    viewer.io.loadJSON(saved);
    const contig = viewer.sequence.contigs(1);
    const feature = viewer.features(1);
    expect(contig.orientation).toBe(orientation);
    expect(contig.seq).toBe('ARYCGT');
    expect([feature.start, feature.stop, feature.strand]).toEqual([2, 4, -1]);

    contig.update({orientation});
    expect(contig.seq).toBe('ARYCGT');
    expect([feature.start, feature.stop, feature.strand]).toEqual([2, 4, -1]);
    contig.update({orientation: orientation === '+' ? '-' : '+'});
    expect(contig.seq).toBe('ACGRYT');
    expect([feature.start, feature.stop, feature.strand]).toEqual([3, 5, 1]);
  });

  test('still reverses feature coordinates on contigs without bases', () => {
    const viewer = new Viewer('#map', {
      sequence: {contigs: [{name: 'one', length: 100}]},
      features: [{name: 'gene', contig: 'one', start: 2, stop: 5, strand: 1}],
    });
    const contig = viewer.sequence.contigs(1);
    const feature = viewer.features(1);
    contig.update({orientation: '-'});
    expect(contig.seq).toBeUndefined();
    expect([feature.start, feature.stop, feature.strand]).toEqual([96, 99, -1]);
    contig.update({orientation: '-'});
    expect([feature.start, feature.stop, feature.strand]).toEqual([96, 99, -1]);
    contig.update({orientation: '+'});
    expect([feature.start, feature.stop, feature.strand]).toEqual([2, 5, 1]);
  });
});
