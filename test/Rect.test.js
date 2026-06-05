import Rect from '../src/Rect';

describe('Rect', () => {

  test('overlap includes the horizontal label gap on both sides', () => {
    const leftRect = new Rect(100, 100, 20, 10);
    const rightRect = new Rect(123, 100, 20, 10);

    expect(rightRect.overlap([leftRect])).toBe(leftRect);
  });

});
