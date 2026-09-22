import Viewer from '../src/Viewer';

describe('Bookmark ordering', () => {
  let cgv;
  let bookmarks;

  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '<div id="map"></div>';
    cgv = new Viewer('#map');
    bookmarks = cgv.addBookmarks([
      {name: 'First', bp: 100, zoom: 1, shortcut: '1', bbOffset: 0},
      {name: 'Second', bp: 200, zoom: 2, shortcut: '2', bbOffset: 10, favorite: true},
      {name: 'Third', bp: 300, zoom: 3, shortcut: '3', bbOffset: 20, format: 'linear'},
    ]);
    cgv.update({dataHasChanged: false});
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test.each([
    [0, 2, [1, 2, 0]],
    [2, 0, [2, 0, 1]],
    [1, 1, [0, 1, 2]],
  ])('moveBookmark(%i, %i) updates order before emitting the move event', (oldIndex, newIndex, order) => {
    const expected = order.map(index => bookmarks[index]);
    const onMoved = jest.fn(() => {
      expect(Array.from(cgv.bookmarks())).toEqual(expected);
    });
    cgv.on('bookmarks-moved', onMoved);

    cgv.moveBookmark(oldIndex, newIndex);

    expect(Array.from(cgv.bookmarks())).toEqual(expected);
    expect(onMoved).toHaveBeenCalledTimes(1);
    expect(onMoved).toHaveBeenCalledWith({oldIndex, newIndex});
    expect(cgv.dataHasChanged).toBe(true);
  });

  test('moving a bookmark repeatedly uses its current index and preserves its identity and attributes', () => {
    const [first, second, third] = bookmarks;
    const saved = bookmarks.map(bookmark => bookmark.toJSON());
    const view = {bp: cgv.bp, zoom: cgv.zoomFactor, format: cgv.format, bbOffset: cgv.bbOffset};

    first.move(2);
    expect(Array.from(cgv.bookmarks())).toEqual([second, third, first]);
    first.move(1);
    expect(Array.from(cgv.bookmarks())).toEqual([second, first, third]);

    bookmarks.forEach((bookmark, index) => {
      expect(cgv.bookmarkByShortcut(String(index + 1))).toBe(bookmark);
      expect(cgv.objects(bookmark.cgvID)).toBe(bookmark);
      expect(bookmark.toJSON()).toEqual(saved[index]);
    });
    expect({bp: cgv.bp, zoom: cgv.zoomFactor, format: cgv.format, bbOffset: cgv.bbOffset}).toEqual(view);
  });

  test('the new order and saved bookmark attributes survive JSON export and reload', () => {
    const expected = [bookmarks[1], bookmarks[2], bookmarks[0]].map(bookmark => bookmark.toJSON());
    bookmarks[0].move(2);

    const json = JSON.parse(JSON.stringify(cgv.io.toJSON()));
    expect(json.cgview.bookmarks).toEqual(expected);
    cgv.io.loadJSON(json);

    expect(Array.from(cgv.bookmarks(), bookmark => bookmark.toJSON())).toEqual(expected);
    expect(cgv.bookmarkByShortcut('1').name).toBe('First');
    expect(cgv.bookmarkByShortcut('2').name).toBe('Second');
    expect(cgv.bookmarkByShortcut('3').name).toBe('Third');
  });

  test('moveTo still restores the saved map position after reordering', () => {
    const bookmark = bookmarks[2];
    const zoomTo = jest.spyOn(cgv, 'zoomTo').mockImplementation(() => {});
    bookmark.move(0);

    bookmark.moveTo(250);
    jest.runOnlyPendingTimers();

    expect(cgv.format).toBe('linear');
    expect(zoomTo).toHaveBeenCalledWith(300, 3, {duration: 250, bbOffset: 20});
    expect(Array.from(cgv.bookmarks())).toEqual([bookmark, bookmarks[0], bookmarks[1]]);
  });

  test.each([
    [-1, 0], [3, 0], [0, -1], [0, 3], [0.5, 1], [0, 1.5],
    ['1', 0], [0, '1'], [undefined, 0], [0, undefined], [NaN, 0], [0, Infinity],
  ])('rejects invalid indices (%s, %s) without changing bookmarks or emitting an event', (oldIndex, newIndex) => {
    const onMoved = jest.fn();
    cgv.on('bookmarks-moved', onMoved);

    expect(() => cgv.moveBookmark(oldIndex, newIndex)).toThrow(RangeError);

    expect(Array.from(cgv.bookmarks())).toEqual(Array.from(bookmarks));
    expect(onMoved).not.toHaveBeenCalled();
    expect(cgv.dataHasChanged).toBe(false);
  });

  test('a removed bookmark cannot move another bookmark', () => {
    const [removed, second, third] = bookmarks;
    removed.remove();
    cgv.update({dataHasChanged: false});
    const onMoved = jest.fn();
    cgv.on('bookmarks-moved', onMoved);

    expect(() => removed.move(0)).toThrow(RangeError);

    expect(Array.from(cgv.bookmarks())).toEqual([second, third]);
    expect(onMoved).not.toHaveBeenCalled();
    expect(cgv.dataHasChanged).toBe(false);
  });

  test('an empty bookmark array cannot acquire undefined entries through a move', () => {
    cgv.removeBookmarks(bookmarks);
    cgv.update({dataHasChanged: false});

    expect(() => cgv.moveBookmark(0, 0)).toThrow(RangeError);

    expect(cgv.bookmarks()).toHaveLength(0);
    expect(cgv.io.toJSON().cgview.bookmarks).toEqual([]);
    expect(cgv.dataHasChanged).toBe(false);
  });
});
