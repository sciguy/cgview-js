import Viewer from '../src/Viewer';

describe('Highlighter', () => {

  let cgv;

  beforeEach(() => {
    document.body.innerHTML = '<div id="map"></div>';
    cgv = new Viewer('#map');
  });

  test('does not expose an undefined name for unnamed features', () => {
    const feature = cgv.addFeatures({
      type: 'ORF',
      start: 10,
      stop: 30,
    })[0];

    const html = cgv.highlighter.featurePopoverContentsDefault({element: feature});

    expect(html).toContain('<div>ORF<div>');
    expect(html).not.toContain('undefined');
  });

  test('uses a common qualifier when an explicit feature name is absent', () => {
    const feature = cgv.addFeatures({
      type: 'CDS',
      start: 10,
      stop: 30,
      qualifiers: {locus_tag: ['ABC_001']},
    })[0];

    expect(cgv.highlighter.featurePopoverContentsDefault({element: feature}))
      .toContain('<div>CDS: ABC_001<div>');
  });

  test('prefers the explicit feature name over qualifiers', () => {
    const feature = cgv.addFeatures({
      name: 'dnaA',
      type: 'CDS',
      start: 10,
      stop: 30,
      qualifiers: {gene: ['other-name']},
    })[0];

    expect(cgv.highlighter.featurePopoverContentsDefault({element: feature}))
      .toContain('<div>CDS: dnaA<div>');
  });

});
