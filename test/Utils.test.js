import utils from '../src/Utils';

describe('Utils', () => {

  describe('uniqueName', () => {

    test('return original name if unique', () => {
      const allNames = ['Other', 'RNA'];
      const origName = 'CDS';
      const uniqueName = utils.uniqueName(origName, allNames);
      expect(uniqueName).toBe('CDS');
    });

    test('return new name if not unique', () => {
      const allNames = ['CDS', 'RNA'];
      const origName = 'CDS';
      const uniqueName = utils.uniqueName(origName, allNames);
      expect(uniqueName).toBe('CDS-2');
    });

    test('return blank name if empty', () => {
      const allNames = ['CDS', 'RNA'];
      const origName = '';
      const uniqueName = utils.uniqueName(origName, allNames);
      expect(uniqueName).toBe('');
    });

    test('return "-2" if blank name present', () => {
      const allNames = ['CDS', ''];
      const origName = '';
      const uniqueName = utils.uniqueName(origName, allNames);
      expect(uniqueName).toBe('-2');
    });

  });

  describe('isSafari', () => {

    test('recognizes desktop and mobile Safari', () => {
      expect(utils.isSafari(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ' +
        '(KHTML, like Gecko) Version/18.6 Safari/605.1.15'
      )).toBe(true);
      expect(utils.isSafari(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 ' +
        '(KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1'
      )).toBe(true);
    });

    test('does not classify other WebKit or Blink browsers as Safari', () => {
      expect(utils.isSafari(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
      )).toBe(false);
      expect(utils.isSafari(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 ' +
        '(KHTML, like Gecko) CriOS/140.0.0.0 Mobile/15E148 Safari/604.1'
      )).toBe(false);
    });

  });

});

