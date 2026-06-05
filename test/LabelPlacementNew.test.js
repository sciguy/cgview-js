import LabelPlacementNew from '../src/LabelPlacementNew';
import Rect from '../src/Rect';

describe('LabelPlacementNew', () => {

  let labelPlacement;

  beforeEach(() => {
    labelPlacement = new LabelPlacementNew({
      _labelLineLength: 20,
      _labelLineMarginInner: 1,
      _labelLineMarginOuter: 1
    });
  });

  function label({bp, y, x = 100, width = 40, height = 12}) {
    return {
      bp,
      height,
      width,
      rect: new Rect(x, y - (height / 2), width, height),
      _defaultOuterPt: {x, y}
    };
  }

  test('keeps upper labels close to the map when horizontally clear', () => {
    const sideLabel = label({bp: 1, x: 220, y: 100, width: 60});
    const topLabel = label({bp: 2, x: 108, y: 96, width: 20});
    const defaultTopY = topLabel.rect.y;

    labelPlacement._placeUpperHalf([sideLabel, topLabel]);

    expect(topLabel.rect.y).toBe(defaultTopY);
  });

  test('moves upper labels outward when they overlap horizontally', () => {
    const sideLabel = label({bp: 1, x: 108, y: 100, width: 60});
    const topLabel = label({bp: 2, x: 112, y: 96, width: 50});

    labelPlacement._placeUpperHalf([sideLabel, topLabel]);

    expect(topLabel.rect.bottom).toBe(sideLabel.rect.y - 2);
  });

  test('moves upper labels outward when only the horizontal gap overlaps', () => {
    const sideLabel = label({bp: 1, x: 108, y: 100, width: 20});
    const topLabel = label({bp: 2, x: 131, y: 96, width: 20});

    labelPlacement._placeUpperHalf([sideLabel, topLabel]);

    expect(topLabel.rect.bottom).toBe(sideLabel.rect.y - 2);
  });

  test('resets upper labels closer to the map after an outward label when horizontally clear', () => {
    const sideLabel = label({bp: 1, x: 108, y: 100, width: 60});
    const overlappingTopLabel = label({bp: 2, x: 112, y: 96, width: 50});
    const clearTopLabel = label({bp: 3, x: 220, y: 92, width: 20});
    const defaultClearTopY = clearTopLabel.rect.y;

    labelPlacement._placeUpperHalf([sideLabel, overlappingTopLabel, clearTopLabel]);

    expect(clearTopLabel.rect.y).toBe(defaultClearTopY);
  });

  test('keeps long upper labels in the outward stack', () => {
    const sideLabel = label({bp: 1, x: 108, y: 100, width: 60});
    const longTopLabel = label({bp: 2, x: 220, y: 96, width: 100});

    labelPlacement._placeUpperHalf([sideLabel, longTopLabel]);

    expect(longTopLabel.rect.bottom).toBe(sideLabel.rect.y - 2);
  });

  test('keeps lower labels close to the map when horizontally clear', () => {
    const sideLabel = label({bp: 1, x: 220, y: 100, width: 60});
    const bottomLabel = label({bp: 2, x: 108, y: 104, width: 20});
    const defaultBottomY = bottomLabel.rect.y;

    labelPlacement._placeLowerHalf([sideLabel, bottomLabel]);

    expect(bottomLabel.rect.y).toBe(defaultBottomY);
  });

  test('moves lower labels outward when they overlap horizontally', () => {
    const sideLabel = label({bp: 1, x: 108, y: 100, width: 60});
    const bottomLabel = label({bp: 2, x: 112, y: 104, width: 50});

    labelPlacement._placeLowerHalf([sideLabel, bottomLabel]);

    expect(bottomLabel.rect.y).toBe(sideLabel.rect.bottom + 2);
  });

  test('moves lower labels outward when they overlap upper blockers', () => {
    const upperLabel = label({bp: 1, x: 108, y: 100, width: 50});
    const lowerLabel = label({bp: 2, x: 112, y: 104, width: 50});

    labelPlacement._placeLowerHalf([lowerLabel], [upperLabel]);

    expect(lowerLabel.rect.y).toBe(upperLabel.rect.bottom + 2);
  });

  test('resets lower labels closer to the map after an outward label when horizontally clear', () => {
    const sideLabel = label({bp: 1, x: 108, y: 100, width: 60});
    const overlappingBottomLabel = label({bp: 2, x: 112, y: 104, width: 50});
    const clearBottomLabel = label({bp: 3, x: 220, y: 108, width: 20});
    const defaultClearBottomY = clearBottomLabel.rect.y;

    labelPlacement._placeLowerHalf([sideLabel, overlappingBottomLabel, clearBottomLabel]);

    expect(clearBottomLabel.rect.y).toBe(defaultClearBottomY);
  });

  test('keeps long lower labels in the outward stack', () => {
    const sideLabel = label({bp: 1, x: 108, y: 100, width: 60});
    const longBottomLabel = label({bp: 2, x: 220, y: 104, width: 100});

    labelPlacement._placeLowerHalf([sideLabel, longBottomLabel]);

    expect(longBottomLabel.rect.y).toBe(sideLabel.rect.bottom + 2);
  });

});
