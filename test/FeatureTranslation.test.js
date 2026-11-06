import Viewer from '../src/Viewer';

describe('Feature translation codonStart', () => {
  let viewer;

  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '<div id="map"></div>';
  });

  afterEach(() => {
    viewer?.annotation._externalLabels.destroy();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  // Each shape yields AATGAAACCCTAA in the feature's reading direction.
  // Wrapped shapes cross the origin after six bases, inside a codon for both offsets.
  function createFeature({shape = 'ordinary', strand = 1, codonStart, translation} = {}) {
    const dna = strand === 1 ? 'AATGAAACCCTAA' : 'TTAGGGTTTCATT';
    const tailLength = strand === 1 ? 6 : 7;
    const wrapped = shape !== 'ordinary';
    const seq = wrapped ? dna.slice(tailLength) + 'CCCC' + dna.slice(0, tailLength) : 'CC' + dna + 'GG';
    const start = wrapped ? seq.length - tailLength + 1 : 3;
    const stop = wrapped ? dna.length - tailLength : dna.length + 2;
    viewer = new Viewer('#map', {
      settings: {geneticCode: 1},
      sequence: {contigs: [
        {name: 'A', seq: 'C'.repeat(20)},
        {name: 'B', seq, topology: 'circular'},
        {name: 'C', seq: 'G'.repeat(20)},
      ]},
      features: [{name: 'CDS', contig: 'B', start, stop, strand, codonStart, translation,
        ...(shape === 'joined' ? {locations: [[start, seq.length], [1, stop]]} : {})}],
    });
    return viewer.features(1);
  }

  const offsets = [
    {codonStart: 2, protein: 'MKP*'}, // ATG AAA CCC TAA
    {codonStart: 3, protein: '*NP'}, // TGA AAC CCT, trailing AA is incomplete
  ];
  const cases = offsets.flatMap(offset => ['ordinary', 'wrapped', 'joined'].flatMap(shape =>
    [1, -1].map(strand => ({...offset, shape, strand}))));

  test.each(cases)('translates $shape features with codonStart $codonStart on strand $strand', options => {
    const feature = createFeature(options);
    expect(feature.seq).toBe('AATGAAACCCTAA');
    expect(feature.translate()).toBe(options.protein);
  });

  test.each([undefined, 1])('preserves the first reading frame for codonStart %s', codonStart => {
    const feature = createFeature({codonStart});
    expect(feature.translate()).toBe('NETL'); // AAT GAA ACC CTA
  });

  test.each(offsets)('honors codonStart $codonStart when recomputing a saved translation', options => {
    const feature = createFeature({...options, shape: 'wrapped', strand: -1, translation: 'IMPORTED'});
    expect(feature.translate()).toBe('IMPORTED');
    expect(feature.translate(1)).toBe(options.protein);
  });

  const stringCases = [{codonStart: 1, protein: 'NETL'}, ...offsets].flatMap(offset =>
    ['ordinary', 'wrapped', 'joined'].flatMap(shape =>
      [1, -1].map(strand => ({...offset, codonStart: String(offset.codonStart), shape, strand}))));

  test.each(stringCases)('normalizes string codonStart $codonStart for $shape features on strand $strand', options => {
    const feature = createFeature(options);
    expect(feature.codonStart).toBe(Number(options.codonStart));
    expect(feature.translate()).toBe(options.protein);
    if (feature.codonStart !== 1) { expect(feature.toJSON().codonStart).toBe(Number(options.codonStart)); }
  });

  test.each([undefined, null])('resets codonStart to the default for %s', value => {
    const feature = createFeature({codonStart: 2});
    feature.codonStart = value;
    expect(feature.codonStart).toBe(1);
    expect(feature.translate()).toBe('NETL');
  });

  test.each([0, 4, -1, 2.5, NaN, Infinity, '', ' ', '2oops', true, false, [], [2], {}])(
    'rejects invalid codonStart %p without changing the current translation', value => {
      const feature = createFeature({codonStart: 2});
      const error = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        feature.codonStart = value;
        expect(feature.codonStart).toBe(2);
        expect(feature.translate()).toBe('MKP*');
        expect(error).toHaveBeenCalledTimes(1);
      } finally {
        error.mockRestore();
      }
    }
  );
});
