import Slot from '../src/Slot';
import CGArray from '../src/CGArray';

// Keep Slot and its NCList real; observe drawing at the feature boundary.
function createSlot(records, {start = 100, stop = 400, drawOrder = 'position',
  shading = false, debug = false, fastFeaturesPerSlot = 3} = {}) {
  const drawn = [];
  const range = {start, stop, isMapLength: () => start === 1 && stop === 1000};
  const canvas = {visibleRangeForCenterOffset: jest.fn(() => range)};
  const layout = {fastFeaturesPerSlot};
  const viewer = {
    _objects: {}, sequence: {length: 1000}, canvas, layout,
    backbone: {adjustedCenterOffset: 100},
    annotation: {visible: false}, settings: {showShading: shading}, debug,
    slots: () => track._slots,
  };
  const track = {viewer, layout, drawOrder, _slots: new CGArray()};
  const slot = new Slot(track, {strand: 'direct'});
  slot._bbOffset = 20;
  slot._thickness = 12;
  const features = records.map(record => ({
    ...record,
    length: record.mapStop >= record.mapStart ? record.mapStop - record.mapStart + 1 :
      1000 - record.mapStart + record.mapStop + 1,
    draw: jest.fn((...args) => drawn.push({id: record.id, args})),
  }));
  slot.replaceFeatures(new CGArray(features));
  const count = jest.spyOn(slot._featureNCList, 'count');
  return {slot, canvas, range, drawn, features, count, viewer};
}

const nestedRecords = [
  {id: 'late', mapStart: 330, mapStop: 410, score: 0.7},
  {id: 'early', mapStart: 80, mapStop: 160, score: 0.3},
  {id: 'nested', mapStart: 110, mapStop: 130, score: 0.9},
  {id: 'middle', mapStart: 200, mapStop: 260, score: 0.3},
  {id: 'outside', mapStart: 600, mapStop: 700, score: 0.1},
];

const wrappedRecords = [
  {id: 'wrap', mapStart: 950, mapStop: 50, score: 0.6},
  {id: 'left', mapStart: 20, mapStop: 70, score: 0.2},
  {id: 'right', mapStart: 920, mapStop: 990, score: 0.8},
  {id: 'outside', mapStart: 400, mapStop: 600, score: 0.1},
  {id: 'cover', mapStart: 70, mapStop: 940, score: 0.4},
];

describe('Slot feature drawing and visible counts', () => {
  test('preserves partial-range position order and feature draw arguments', () => {
    const {slot, canvas, range, drawn} = createSlot(nestedRecords);
    slot.draw(canvas);

    expect(drawn.map(item => item.id)).toEqual(['early', 'nested', 'middle', 'late']);
    for (const {args} of drawn) {
      expect(args).toEqual(['map', 120, 12, range, {showShading: undefined}]);
    }
  });

  test('preserves descending traversal for shaded direct-strand features', () => {
    const {slot, canvas, drawn} = createSlot(nestedRecords, {shading: true});
    slot.draw(canvas);

    expect(drawn.map(item => item.id)).toEqual(['late', 'middle', 'early', 'nested']);
  });

  test('preserves score order and length tie-breaking for partial ranges', () => {
    const {slot, canvas, drawn} = createSlot(nestedRecords, {drawOrder: 'score'});
    slot.draw(canvas);

    expect(drawn.map(item => item.id)).toEqual(['middle', 'early', 'late', 'nested']);
  });

  test('preserves wrapped-range traversal without drawing spanning features twice', () => {
    const {slot, canvas, drawn} = createSlot(wrappedRecords, {start: 900, stop: 150});
    slot.draw(canvas);

    expect(drawn.map(item => item.id)).toEqual(['cover', 'right', 'wrap', 'left']);
  });

  test('preserves score order for an origin-crossing visible range', () => {
    const {slot, canvas, drawn} = createSlot(wrappedRecords,
      {start: 900, stop: 150, drawOrder: 'score'});
    slot.draw(canvas);

    expect(drawn.map(item => item.id)).toEqual(['left', 'cover', 'wrap', 'right']);
  });

  test.each([undefined, false])('skips unused full-draw counts with fast=%s', fast => {
    const {slot, canvas, count, drawn} = createSlot(nestedRecords);
    slot.draw(canvas, fast);

    expect(count).not.toHaveBeenCalled();
    expect(drawn).toHaveLength(4);
  });

  test('skips unused full-draw counts when debug has no count panel', () => {
    const {slot, canvas, count} = createSlot(nestedRecords, {debug: {data: {time: {}}}});
    slot.draw(canvas);

    expect(count).not.toHaveBeenCalled();
  });

  test('keeps the full visible count and stable original-index sampling for fast draws', () => {
    const records = Array.from({length: 12}, (_, index) =>
      ({id: index, mapStart: 10 + index * 50, mapStop: 20 + index * 50, score: index / 12}));
    const {slot, canvas, count, drawn, range} = createSlot(records, {start: 60, stop: 460});
    slot.draw(canvas, true);

    expect(count).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenCalledWith(60, 460);
    expect(drawn.map(item => item.id)).toEqual([4, 8]);
    expect(drawn[0].args).toEqual(['map', 120, 12, range, {showShading: false}]);
  });

  test('reports exact debug counts for wrapped full draws', () => {
    const debug = {data: {n: {}}};
    const {slot, canvas, count, drawn} = createSlot(wrappedRecords,
      {start: 900, stop: 150, debug});
    slot.draw(canvas);

    expect(count).toHaveBeenCalledTimes(1);
    expect(debug.data.n.slot_0).toBe(4);
    expect(drawn).toHaveLength(4);
  });

  test('reports visible features rather than the sample size for fast debug draws', () => {
    const debug = {data: {n: {}}};
    const {slot, canvas, count, drawn} = createSlot(nestedRecords,
      {debug, fastFeaturesPerSlot: 1});
    slot.draw(canvas, true);

    expect(count).toHaveBeenCalledTimes(1);
    expect(debug.data.n.slot_0).toBe(4);
    expect(drawn.map(item => item.id)).toEqual(['late']);
  });

  test.each([undefined, true])('avoids a range count at whole-map scale with fast=%s', fast => {
    const debug = {data: {n: {}}};
    const {slot, canvas, count} = createSlot(nestedRecords, {start: 1, stop: 1000, debug});
    slot.draw(canvas, fast);

    expect(count).not.toHaveBeenCalled();
    expect(debug.data.n.slot_0).toBe(5);
  });
});
