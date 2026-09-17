import '../docs/test/rendering-benchmark';

const {generate, statistics, settle} = globalThis.CGVRenderingBenchmark;

describe('development rendering benchmark', () => {
  test('produces the same intervals for both layouts/decorations and a repeatable seed', () => {
    const first = generate({count: 10000, seed: 42, labels: 100});
    const variant = generate({count: 10000, seed: 42, format: 'linear', decoration: 'arrow', labels: 100});
    expect(first.json.cgview.features).toEqual(variant.json.cgview.features);
    expect(first.identity).toEqual(variant.identity);
    expect(generate({count: 10000, seed: 43}).identity.featureFingerprint).not.toBe(first.identity.featureFingerprint);
    const features = first.json.cgview.features;
    expect(features.filter(feature => feature.name)).toHaveLength(100);
    expect(features.every(feature => Number.isInteger(feature.start) && Number.isInteger(feature.stop) &&
      feature.start >= 1 && feature.stop >= 1 && feature.start <= first.identity.sequenceLength &&
      feature.stop <= first.identity.sequenceLength)).toBe(true);
    expect(new Set(features.map(feature => feature.strand))).toEqual(new Set([-1, 1]));
    expect(new Set(features.map(feature => feature.legend)).size).toBe(4);
  });

  test('keeps plot positions sorted and bounds labels by the feature count', () => {
    const result = generate({count: 7, labels: 20, plotPoints: 101});
    const {features, plots, tracks} = result.json.cgview;
    expect(features.filter(feature => feature.name)).toHaveLength(7);
    expect(tracks).toHaveLength(2);
    expect(plots[0].scores).toHaveLength(101);
    expect(plots[0].positions).toEqual([...plots[0].positions].sort((a, b) => a - b));
    expect(plots[0].positions.at(-1)).toBeLessThanOrEqual(result.identity.sequenceLength);
  });

  test('rejects inexact coordinate counts', () => {
    for (const count of [0, -1, 1.5, Number.MAX_SAFE_INTEGER]) {
      expect(() => generate({count})).toThrow();
    }
  });

  test('retains raw outliers and uses nearest-rank percentiles', () => {
    const samples = [1000, 2, 1, 3, 4];
    expect(statistics(samples)).toEqual({samples, median: 3, p90: 1000, min: 1, max: 1000});
    expect(samples).toEqual([1000, 2, 1, 3, 4]);
  });

  test('waits until all progressive slot callbacks complete', async () => {
    const viewer = {layout: {fullDrawInProgress: true}};
    let slots = 0;
    let completed = false;
    const drawSlot = () => {
      slots++;
      if (slots < 3) setTimeout(drawSlot, 0);
      else viewer.layout.fullDrawInProgress = false;
    };
    setTimeout(drawSlot, 0);
    const pending = settle(viewer).then(() => { completed = true; });
    expect(completed).toBe(false);
    await pending;
    expect(slots).toBe(3);
    expect(completed).toBe(true);
  });
});
