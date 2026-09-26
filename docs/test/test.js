///////////////////////////////////////////////////////////////////////////////
// Settings
///////////////////////////////////////////////////////////////////////////////

// 'maps' is from maps.js
console.log('Available Maps (from map.js):', maps)

// Default Map
// Initial input file to load: '', 'file', or map from map.js (e.g. 'small')
// const defaultMap = '';     // Empty
// const defaultMap = 'file'; // File Choose
// const defaultMap = 'small';
// const defaultMap = 'small_noplots';
// const defaultMap = 'medium';
// const defaultMap = 'locations';
// const defaultMap = 'blast';
// const defaultMap = 'labels';
// const defaultMap = 'labels3';
// const defaultMap = 'pcET30c';
// const defaultMap = 'pcDNA3';
// const defaultMap = 'paper';
const defaultMap = 'small';



// Default Checkbox Options
const fullSize = true;
const debug = false;
const drawRange = false;
const selection = false;
const showTrackLabels = true;
const showPlotsSettings = false;
const showSequenceTest = false;
const showTranslationTest = true;
const showTrackSizingTest = false;
const showBordersTest = false;
const showPerformanceTest = false;
const showLabelsTest = false;
const showRulerTest = false;
const showSVGTest = false; // fullSize must be turned off for this to be true

// Other Options
const labelPlacement = 'default';
// const labelPlacement = 'angled';


///////////////////////////////////////////////////////////////////////////////
// Initialize
///////////////////////////////////////////////////////////////////////////////

// The non-full size dimensions of the map
// Performanace tests should be done at this size for consistency
const defaultSize = 600;
const defaultMapStorageKey = 'cgview-test-default-map';

function getInitialMap() {
  const storedMap = localStorage.getItem(defaultMapStorageKey);
  if (storedMap === 'file' || maps[storedMap]) {
    return storedMap;
  }
  return defaultMap;
}

const initialMap = getInitialMap();

// Initialize CGView
cgv = new CGView.Viewer('#my-viewer', {
  height: defaultSize,
  width: defaultSize,
  SVGContext: svgcanvas.Context,
  // debug: {sections: ['time', 'position']}
});

// Initialize File Section: hide or show
const fileSectionDisplayStyle = (initialMap === 'file') ? 'block' : 'none';
document.getElementById('file-section').style.display = fileSectionDisplayStyle;
clearFileInput();

// Initialize Options
// Full Size
const fullSizeCheckbox = document.getElementById('option-full-size');
// Debug Print
const debugModeCheckbox = document.getElementById('option-debug');
debugModeCheckbox.checked = debug;
// Safari arc rendering: reflect the active viewer setting, then allow overrides.
const safariArcFixCheckbox = document.getElementById('option-safari-arc-fix');
safariArcFixCheckbox.checked = cgv._useSafariArcWorkaround;
safariArcFixCheckbox.addEventListener('change', (e) => {
  cgv._useSafariArcWorkaround = e.target.checked;
  cgv.draw();
});
// Draw Range
const drawRangeCheckbox = document.getElementById('test-draw-range');
drawRangeCheckbox.checked = drawRange;
// Selection
const selectionCheckbox = document.getElementById('option-selection');
setSelectionEnabled(selection);
selectionCheckbox.addEventListener('click', (e) => {
  setSelectionEnabled(e.target.checked);
});
cgv.on('selection-update.selection-option', () => {
  selectionCheckbox.checked = cgv.selection.enabled;
});
function setSelectionEnabled(enabled) {
  selectionCheckbox.checked = enabled;
  cgv.selection.enabled = enabled;
}
// Track Labels
const trackLabelsCheckbox = document.getElementById('option-show-track-labels');
setTrackLabelsEnabled(showTrackLabels);
trackLabelsCheckbox.addEventListener('click', (e) => {
  setTrackLabelsEnabled(e.target.checked);
});
function setTrackLabelsEnabled(enabled) {
  trackLabelsCheckbox.checked = enabled;
  cgv.settings.showTrackLabels = enabled;
}
// Toggle Plots Settings
const plotsCheckbox = document.getElementById('option-show-plots');
plotsCheckbox.checked = showPlotsSettings;
// Toggle Sequence Testing
const sequenceCheckbox = document.getElementById('option-show-sequence');
sequenceCheckbox.checked = showSequenceTest;
// Toggle Translation Testing
const translationCheckbox = document.getElementById('option-show-translation');
translationCheckbox.checked = showTranslationTest;
// Plot rendering experiment
const plotRendererSelect = document.getElementById('plot-renderer');
const plotOutlineCheckbox = document.getElementById('plot-outline');
function syncPlotOptions() {
  plotRendererSelect.value = cgv.settings.plotRenderer;
  plotOutlineCheckbox.checked = cgv.settings.showPlotOutline;
  plotOutlineCheckbox.disabled = cgv.settings.plotRenderer === 'legacy';
}
plotRendererSelect.addEventListener('change', () => {
  cgv.settings.update({plotRenderer: plotRendererSelect.value});
});
plotOutlineCheckbox.addEventListener('change', () => {
  cgv.settings.update({showPlotOutline: plotOutlineCheckbox.checked});
});
cgv.on('settings-update.plot-options', syncPlotOptions);
syncPlotOptions();

// Border testing
const bordersCheckbox = document.getElementById('option-show-borders');
bordersCheckbox.checked = showBordersTest;
const featureBordersCheckbox = document.getElementById('border-features');
const backboneBordersCheckbox = document.getElementById('border-backbone');
const adaptiveBorderThicknessCheckbox = document.getElementById('border-adaptive-thickness');
const automaticBorderColorCheckbox = document.getElementById('border-color-auto');
const borderColorInput = document.getElementById('border-color');
const borderSizeInput = document.getElementById('border-size');
const borderSizeLabel = document.getElementById('border-size-label');
const borderSizeOutput = document.getElementById('border-size-value');

function syncBorderControls() {
  if (cgv.loading) { return; }
  const settings = cgv.settings;
  featureBordersCheckbox.checked = settings.showBorder;
  backboneBordersCheckbox.checked = cgv.backbone.showBorder ?? settings.showBorder;
  adaptiveBorderThicknessCheckbox.checked = settings.adaptiveBorderThickness;
  borderSizeLabel.textContent = settings.adaptiveBorderThickness ? 'Maximum border size:' : 'Border size:';
  automaticBorderColorCheckbox.checked = settings.borderColor == null;
  borderColorInput.disabled = automaticBorderColorCheckbox.checked;
  if (settings.borderColor) {
    borderColorInput.value = `#${settings.borderColor.hex}`;
  }
  // Preserve loaded values outside the usual 0.5-4 px testing range.
  borderSizeInput.min = String(Math.min(0.5, settings.borderThickness));
  borderSizeInput.max = String(Math.max(4, settings.borderThickness));
  borderSizeInput.value = String(settings.borderThickness);
  borderSizeOutput.value = String(settings.borderThickness);
  borderSizeInput.setAttribute('aria-valuetext', `${settings.borderThickness} pixels`);
}

featureBordersCheckbox.addEventListener('change', (e) => {
  const showBorder = e.target.checked;
  // Pin an inherited backbone value so the two checkboxes stay independent.
  if (cgv.backbone.showBorder === undefined) {
    cgv.backbone.update({showBorder: backboneBordersCheckbox.checked});
  }
  cgv.settings.update({showBorder});
});
backboneBordersCheckbox.addEventListener('change', (e) => {
  cgv.backbone.update({showBorder: e.target.checked});
  cgv.drawFull();
});
adaptiveBorderThicknessCheckbox.addEventListener('change', (e) => {
  cgv.settings.update({adaptiveBorderThickness: e.target.checked});
});
automaticBorderColorCheckbox.addEventListener('change', (e) => {
  cgv.settings.update({borderColor: e.target.checked ? undefined : borderColorInput.value});
});
borderColorInput.addEventListener('input', (e) => {
  cgv.settings.update({borderColor: e.target.value});
});
borderSizeInput.addEventListener('input', (e) => {
  cgv.settings.update({borderThickness: e.target.valueAsNumber});
});
for (const event of ['settings-update', 'backbone-update']) {
  cgv.on(`${event}.border-testing`, syncBorderControls);
}
cgv.on('cgv-json-load.border-testing', () => {
  // Replacement settings and backbone records are ready after this event.
  queueMicrotask(syncBorderControls);
});
syncBorderControls();

// Ruler Labels
const rulerLabelPositionRadios = document.querySelectorAll('input[name="ruler-label-position"]');
const rulerLabelOrientationRadios = document.querySelectorAll('input[name="ruler-label-orientation"]');
function syncRadioGroup(radios, value) {
  radios.forEach((radio) => {
    radio.checked = radio.value === value;
  });
}
function syncRulerLabelOptions() {
  syncRadioGroup(rulerLabelPositionRadios, cgv.ruler.labelPosition);
  syncRadioGroup(rulerLabelOrientationRadios, cgv.ruler.labelOrientation);
}
function updateRulerLabelOption(attribute, value) {
  cgv.ruler.update({[attribute]: value});
  cgv.draw();
}
rulerLabelPositionRadios.forEach((radio) => {
  radio.addEventListener('change', (e) => {
    if (e.target.checked) {
      updateRulerLabelOption('labelPosition', e.target.value);
    }
  });
});
rulerLabelOrientationRadios.forEach((radio) => {
  radio.addEventListener('change', (e) => {
    if (e.target.checked) {
      updateRulerLabelOption('labelOrientation', e.target.value);
    }
  });
});
cgv.on('ruler-update.ruler-label-options', syncRulerLabelOptions);
syncRulerLabelOptions();
// Sequence detail
const baseDisplayModeSelect = document.getElementById('sequence-base-display-mode');
const baseTextOrientationRadios = document.querySelectorAll(
  'input[name="sequence-base-text-orientation"]',
);
function syncSequenceControls() {
  baseDisplayModeSelect.value = cgv.sequence.baseDisplayMode;
  syncRadioGroup(baseTextOrientationRadios, cgv.sequence.baseTextOrientation);
}
baseDisplayModeSelect.addEventListener('change', (e) => {
  cgv.sequence.update({baseDisplayMode: e.target.value});
  cgv.draw();
});
baseTextOrientationRadios.forEach((radio) => {
  radio.addEventListener('change', (e) => {
    if (e.target.checked) {
      cgv.sequence.update({baseTextOrientation: e.target.value});
      cgv.draw();
    }
  });
});
cgv.on('sequence-update.sequence-testing', () => {
  if (!cgv.loading) {
    syncSequenceControls();
  }
});
syncSequenceControls();
// Translation detail
const translationVisibleCheckbox = document.getElementById('translation-visible');
const translationStartsCheckbox = document.getElementById('translation-highlight-starts');
const translationStopsCheckbox = document.getElementById('translation-highlight-stops');
const translationGeneticCodeSelect = document.getElementById('translation-genetic-code');
const translationStartColorInput = document.getElementById('translation-start-color');
const translationStopColorInput = document.getElementById('translation-stop-color');
for (const [id, name] of Object.entries(cgv.codonTables.names())) {
  translationGeneticCodeSelect.add(new Option(`${id}: ${name}`, id));
}

function syncTranslationControls() {
  const translation = cgv.sequence.translation;
  translationVisibleCheckbox.checked = translation.visible;
  translationStartsCheckbox.checked = translation.highlightStartCodons;
  translationStopsCheckbox.checked = translation.highlightStopCodons;
  translationGeneticCodeSelect.value = String(cgv.geneticCode);
  translationStartColorInput.value = `#${translation.startColor.hex}`;
  translationStopColorInput.value = `#${translation.stopColor.hex}`;
}

// Avoid redrawing overview maps for changes that cannot affect visible detail.
function updateTranslation(attributes) {
  const translation = cgv.sequence.translation;
  const pixelsPerBp = cgv.backbone.pixelsPerBp();
  const wasDrawn = translation.scaleFactor(pixelsPerBp) > 0;
  translation.update(attributes);
  if (wasDrawn || translation.scaleFactor(pixelsPerBp) > 0) {
    cgv.draw();
  }
}

translationVisibleCheckbox.addEventListener('change', (e) => {
  updateTranslation({visible: e.target.checked});
});
translationStartsCheckbox.addEventListener('change', (e) => {
  updateTranslation({highlightStartCodons: e.target.checked});
});
translationStopsCheckbox.addEventListener('change', (e) => {
  updateTranslation({highlightStopCodons: e.target.checked});
});
translationStartColorInput.addEventListener('input', (e) => {
  updateTranslation({startColor: e.target.value});
});
translationStopColorInput.addEventListener('input', (e) => {
  updateTranslation({stopColor: e.target.value});
});
translationGeneticCodeSelect.addEventListener('change', (e) => {
  cgv.settings.update({geneticCode: Number(e.target.value)});
  if (cgv.sequence.translation.scaleFactor(cgv.backbone.pixelsPerBp()) > 0) {
    cgv.draw();
  }
});
cgv.on('sequence-translation-update.translation-testing', () => {
  if (!cgv.loading) { syncTranslationControls(); }
});
cgv.on('settings-update.translation-testing', () => {
  if (!cgv.loading) { syncTranslationControls(); }
});
cgv.on('cgv-json-load.translation-testing', () => {
  // This event fires before replacement records are constructed.
  queueMicrotask(syncTranslationControls);
});
syncTranslationControls();
// Toggle Track Sizing Test
const trackSizingCheckbox = document.getElementById('option-show-track-sizing');
trackSizingCheckbox.checked = showTrackSizingTest;
// Toggle Label Test
const labelsCheckbox = document.getElementById('option-show-labels');
labelsCheckbox.checked = showLabelsTest;
// Toggle Ruler Test
const rulerCheckbox = document.getElementById('option-show-ruler');
rulerCheckbox.checked = showRulerTest;
// Toggle Performance Test
const performanceCheckbox = document.getElementById('option-show-performance');
performanceCheckbox.checked = showPerformanceTest;
// Toggle SVG Test
const svgModeCheckbox = document.getElementById('option-show-svg');
svgModeCheckbox.checked = showSVGTest;

// Load default map
loadMapFromID(initialMap);


///////////////////////////////////////////////////////////////////////////////
// Map Creation and Selection
///////////////////////////////////////////////////////////////////////////////

// File selector
// Add maps from maps.js to Select
// Using global variable 'maps' from maps.js
const mapSelect = document.getElementById('map-select');
const groups = { generated: 'Generated with CGParse', labels: 'Labels', test: 'Tests', basic: 'Basic', large: 'Large', contigs: 'Contigs', version: 'Versions', bad: 'Bad' };
const order = ['generated', 'basic', 'contigs', 'large', 'test', 'labels', 'version', 'bad'];
const optionsByGroup = {};
for (const inputKey of Object.keys(maps)) {
  const input = maps[inputKey];
  const selected = (inputKey === initialMap) ? 'selected' : '';
  const option = `<option value='${inputKey}' ${selected}>${input.name}</option>`;
  if (optionsByGroup[input.type]) {
    optionsByGroup[input.type].push(option);
  } else {
    optionsByGroup[input.type] = [option];
  }
}

let optionGroups = "";
for (const group of order) {
  if (!optionsByGroup[group]) { continue; }
  const groupOptions = optionsByGroup[group].join('\n');
  optionGroups += `<optgroup label="${groups[group]}">${groupOptions}</optgroup>`;
}

let options = `
  <option value='' disabled ${(initialMap == '') ? 'selected' : ''}>Select an map...</option>
  <option disabled>─────────</option>
  <option value='file' ${(initialMap == 'file') ? 'selected' : ''}>Open a file...</option>
  <option disabled>─────────</option>
  ${optionGroups}
`;

// Choose a predefined file or show the file input section
// Load map when select changes
mapSelect.innerHTML = options;
mapSelect.addEventListener('change', (e) => {
  const id = e.target.value;
  localStorage.setItem(defaultMapStorageKey, id);
  const fileSection = document.getElementById('file-section');
  if (id === 'file') {
    fileSection.style.display = 'block';
    return;
  } else {
    fileSection.style.display = 'none';
    clearFileInput();
  }
  setTimeout(() => {
    loadMapFromID(id);
  }, 100);
});

// Clear the file input when the file section is closed
function clearFileInput() {
  const fileInput = document.getElementById('file-input');
  fileInput.value = '';
}

// Load from file chooser
const fileInput = document.getElementById('file-input');
fileInput.addEventListener('change', (event) => {
  var file = event.target.files[0];
  if (!file) { return; }

  // Show Log
  showLog();

  var reader = new FileReader();
  reader.onload = function(e) {
    var fileText = e.target.result;
    parseFileWrapped(fileText);
  };

  reader.onerror = function(e) {
    console.error("File could not be read! Error: " + e.target.error);
  };

  reader.readAsText(file);
});

// Load local predefined map by id
function loadMapFromID(id) {
  if (id === 'file') { return; }
  if (!maps[id]) { return; }
  const map = maps[id];
  const url = map.url;
  console.log(`Loading Map: ${url}`);
  var request = new XMLHttpRequest();
  request.open('GET', url, true);
  request.onload = function() {
    if (map.format === 'genbank') {
      const logDiv = document.getElementById('log-text');
      logDiv.innerHTML = 'Parsing GenBank file with CGParse.js...';
      showLog();
      setTimeout(() => {
        try {
          const builder = createCGParseBuilder(request.responseText);
          const json = builder.toJSON();
          window.parse = {input: request.responseText, cgvJSON: json};
          logDiv.innerHTML = builder.logger.history({showIcons: true});
          loadMapJSON(json, map.name);
        } catch (error) {
          logDiv.innerHTML = `Error loading file.\n${error.message}`;
        }
      }, 100);
    } else {
      loadMapJSON(JSON.parse(request.responseText), map.name);
    }
  };
  request.send();
}

function loadMapJSON(json, name) {
  cgv.io.loadJSON(json);
  cgv.name = name;
  syncPlotOptions();
  setTrackLabelsEnabled(trackLabelsCheckbox.checked);
  syncRulerLabelOptions();
  syncSequenceControls();
  syncTranslationControls();

  // Default label placement
  cgv.annotation.labelPlacement = labelPlacement;

  // Testing annotation (default is 50)
  // cgv.annotation.priorityMax = 200;

  // Label stuff (Below)
  const distance = cgv.sequence.length / 100;
  labelDistance.value = Math.floor(distance);
  labelFontSize.value = cgv.annotation.font.size;
  syncLabelOptions();

  cgv.draw();
  setTimeout( () => {
    cgv.resize();
  },1);
}


///////////////////////////////////////////////////////////////////////////////
// Page Layout
///////////////////////////////////////////////////////////////////////////////

plotsCheckbox.addEventListener('click', () => {
  updatePageLayout();
});
sequenceCheckbox.addEventListener('click', () => {
  updatePageLayout();
});
translationCheckbox.addEventListener('click', updatePageLayout);
bordersCheckbox.addEventListener('change', updatePageLayout);
trackSizingCheckbox.addEventListener('click', () => {
  updatePageLayout();
});
labelsCheckbox.addEventListener('click', (e) => {
  updatePageLayout();
});
rulerCheckbox.addEventListener('click', (e) => {
  updatePageLayout();
});
performanceCheckbox.addEventListener('click', (e) => {
  updatePageLayout();
});

function updatePageLayout() {
  // Plots
  const plotsDiv = document.querySelector('.section-plots');
  plotsDiv.style.display = plotsCheckbox.checked ? 'block' : 'none';
  // Sequence
  const sequenceDiv = document.querySelector('.section-sequence');
  sequenceDiv.style.display = sequenceCheckbox.checked ? 'block' : 'none';
  // Translation
  document.getElementById('translation-testing').hidden = !translationCheckbox.checked;
  // Borders
  document.getElementById('border-testing').hidden = !bordersCheckbox.checked;
  // Track Sizing
  const trackSizingDiv = document.querySelector('.section-track-sizing');
  trackSizingDiv.style.display = trackSizingCheckbox.checked ? 'block' : 'none';
  // Labels
  const labelsDiv = document.querySelector('.section-labels');
  labelsDiv.style.display = labelsCheckbox.checked ? 'block' : 'none';
  // Ruler
  const rulerDiv = document.querySelector('.section-ruler');
  rulerDiv.style.display = rulerCheckbox.checked ? 'block' : 'none';
  // Performance
  const performanceDiv = document.querySelector('.section-performance');
  performanceDiv.style.display = performanceCheckbox.checked ? 'block' : 'none';
}

// Initial Layout
updatePageLayout();

///////////////////////////////////////////////////////////////////////////////
// Events
///////////////////////////////////////////////////////////////////////////////

cgv.on('mousemove', (e) => {
  // const elements = ['caption', 'legendItem', 'label'];
  const elements = ['caption', 'legendItem'];
  if (elements.includes(e.elementType)) {
    e.element.highlight();
  }
  if (e.elementType === 'label') {
    const label = e.element;
    label.feature.highlight();
  }
  if (e.elementType === 'feature') {
  }
});


///////////////////////////////////////////////////////////////////////////////
// Performance Test
///////////////////////////////////////////////////////////////////////////////

// Start Performance Test
const resultsDiv = document.getElementById('results');
const perfBtn = document.getElementById('performance-start');
perfBtn.addEventListener('click', async () => {
  const iterationSelect = document.getElementById('iterations-select');
  const iterations = Number(iterationSelect.value);
  resizeAction(false);
  perfBtn.disabled = true;
  resultsDiv.textContent = 'Running benchmark...';

  try {
    const performance = new CGVPerformance(cgv, `${cgv.name} [${cgv.settings.plotRenderer}, outline ${cgv.settings.showPlotOutline ? 'on' : 'off'}]`, iterations);
    await performance.ready;
    console.log(performance.toJSON());
    resultsDiv.innerHTML = performance.report();
  } catch (error) {
    console.error(error);
    resultsDiv.textContent = `Benchmark failed: ${error.message}`;
  } finally {
    perfBtn.disabled = false;
  }
});

// Clear Test Results
const clearBtn = document.getElementById('performance-clear');
clearBtn.addEventListener('click', (e) => {
  resultsDiv.innerHTML = '';
});

///////////////////////////////////////////////////////////////////////////////
// Options
///////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////
// Full Size Map
///////////////////////////////////////////////////////////////////////////////

function myResize() {
  const width = window.innerWidth;
  const height = window.innerHeight
  cgv.resize(width-428, height-100);

  const testDrawRange = document.getElementById('test-draw-range').checked;
  testDrawRange && (cgv.canvas._testDrawRange = testDrawRange);
}

// const fullSize = document.getElementById('option-full-size');
fullSizeCheckbox.addEventListener('click', (e) => {
  resizeAction(e.target.checked);
});

function resizeAction(resize) {
  fullSizeCheckbox.checked = resize;
  if (resize) {
    svgModeAction(false); // Turn off SVG mode
    window.addEventListener('resize', myResize)
    myResize();
  } else {
    window.removeEventListener('resize', myResize)
    cgv.resize(defaultSize, defaultSize);
  }
}

// Initial Resize
resizeAction(fullSize);


///////////////////////////////////////////////////////////////////////////////
// Open in Proksee API
///////////////////////////////////////////////////////////////////////////////

function openInProksee(cgv, origin, open=false) {
  let responseData = {};
  const url = 'https://proksee.ca/api/v1/projects.json';
  const data = { origin, data: JSON.stringify(cgv.io.toJSON()) };
  const response = fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then((response) => response.json())
  .then((data) => {
    console.log(data);
    if (data?.status === 'success' && data?.url) {
      if (open) {
        window.location.href = data.url;
      }
    } else {
      alert(`Unable to send map to Proksee: ${data?.error} `)
    }
  })
  .catch((error) => {
    console.log('Error:', error);
  });
  return responseData;
}

// Add openInProksee to a button with id of 'open-in-proksee-btn'
const openInProkseeBtn = document.getElementById('open-in-proksee-btn');
openInProkseeBtn.addEventListener('click', (e) => {
  openInProksee(cgv, 'CGViewTest', true)
});


///////////////////////////////////////////////////////////////////////////////
// Debug Print
///////////////////////////////////////////////////////////////////////////////

debugModeCheckbox.addEventListener('click', (e) => {
  debugAction(e.target.checked);
});

function debugAction(debug) {
  if (debug) {
    cgv.debug = true;
  } else {
    cgv.debug = false;
    cgv.canvas.clear('debug');
  }
  cgv.draw();
}

// Initial Debug
debugAction(debug);


///////////////////////////////////////////////////////////////////////////////
// SVG Testing
///////////////////////////////////////////////////////////////////////////////

svgModeCheckbox.addEventListener('click', (e) => {
  svgModeAction(e.target.checked);
});

function svgModeAction(svgMode) {
  const svgSection = document.getElementById('svg-section');
  svgModeCheckbox.checked = svgMode;
  if (svgMode) {
    resizeAction(false);
    svgSection.style.visibility = 'visible';
    svgSection.style.display = 'block';
  } else {
    svgSection.style.visibility = 'hidden';
    svgSection.style.display = 'none';
  }
}

const createSVGBtn = document.getElementById('create-svg');
createSVGBtn.addEventListener('click', (e) => {
  const svgDiv = document.getElementById('svg-map');
  svgDiv.innerHTML = cgv.io.getSVG();
});
const downloadSVGBtn = document.getElementById('download-svg');
downloadSVGBtn.addEventListener('click', (e) => {
  cgv.io.downloadSVG('cgview.svg');
});


///////////////////////////////////////////////////////////////////////////////
// Label Testing
///////////////////////////////////////////////////////////////////////////////

// Moves all the map features by the specified distance
// This is usful to see how the labels react as the feature change positions
function moveFeatures(distance) {
  distance = Math.floor(distance);
  console.log(`Move Labels: ${distance} bp`)
  const changes = {};
  cgv.features().forEach( f => {
    const start = newPostion(f.start, distance, cgv.sequence.length);
    const stop = newPostion(f.stop, distance, cgv.sequence.length);
    changes[f.cgvID] = {start, stop};
  });
  cgv.updateFeatures(changes);
  cgv.draw();
}

// Use the following to move the features initially
// setTimeout(function() {
//   moveFeatures(-15050);
// }, 500);

function newPostion(bp, change, length) {
  if (change > 0) {
    return  ((bp + change) > length) ? (bp + change - length) : (bp + change);
  } else {
    return  ((bp + change) < 1) ? (bp + change + length) : (bp + change);
  }
}

const labelDistance = document.getElementById('labels-move-distance');
const labelFontSize = document.getElementById('labels-font-size');
const labelPositionRadios = document.querySelectorAll('input[name="labels-position"]');
const labelInlineShrink = document.getElementById('labels-inline-shrink');
const labelInlineTruncate = document.getElementById('labels-inline-truncate');

function syncLabelOptions() {
  labelPositionRadios.forEach((radio) => {
    radio.checked = radio.value === cgv.annotation.labelPosition;
  });
  const inlineEnabled = ['inline', 'auto'].includes(cgv.annotation.labelPosition);
  labelInlineShrink.checked = cgv.annotation.inlineLabelAllowShrinking;
  labelInlineTruncate.checked = cgv.annotation.inlineLabelAllowTruncation;
  labelInlineShrink.disabled = !inlineEnabled;
  labelInlineTruncate.disabled = !inlineEnabled;
}

labelPositionRadios.forEach((radio) => {
  radio.addEventListener('change', (e) => {
    if (!e.target.checked) { return; }
    cgv.annotation.update({labelPosition: e.target.value});
    cgv.draw();
  });
});

cgv.on('annotation-update.label-position-options', () => {
  if (!cgv.loading) {
    syncLabelOptions();
  }
});

syncLabelOptions();

labelInlineShrink.addEventListener('change', (e) => {
  cgv.annotation.update({inlineLabelAllowShrinking: e.target.checked});
  cgv.draw();
});

labelInlineTruncate.addEventListener('change', (e) => {
  cgv.annotation.update({inlineLabelAllowTruncation: e.target.checked});
  cgv.draw();
});

labelFontSize.addEventListener('change', (e) => {
  cgv.annotation.update({font: `monospace, plain, ${labelFontSize.value}`});
  cgv.draw();
});

const labelsForward = document.getElementById('labels-move-forward');
labelsForward.addEventListener('click', (e) => {
  const distance = labelDistance.value;
  moveFeatures(distance);
});
const labelsBackward = document.getElementById('labels-move-back');
labelsBackward.addEventListener('click', (e) => {
  const distance = labelDistance.value;
  moveFeatures(-distance);
});

const labelsDefault = document.getElementById('labels-default');
labelsDefault.addEventListener('click', (e) => {
  cgv.annotation.labelPlacement = 'default';
  cgv.draw();
});
const labelsAngled = document.getElementById('labels-angled');
labelsAngled.addEventListener('click', (e) => {
  cgv.annotation.labelPlacement = 'angled';
  cgv.draw();
});


///////////////////////////////////////////////////////////////////////////////
// Parse
///////////////////////////////////////////////////////////////////////////////

// Runs parse within a timeout, allowing for UI updates
function parseFileWrapped(fileText) {
  const logDiv = document.getElementById('log-text');
  logDiv.innerHTML = "Loading..."
  setTimeout(() => {
    try {
      parseFile(fileText);
    } catch (error) {
      logDiv.innerHTML = `Error loading file.\n${error.message}`;
    }
  }, 100);
}

// Speed of steps:
// - Fastest is going right to map (no innerHTML)
// - When using innerHTML, it is faster when the sequence is replaced
// - Prism.highlight is slowest step
function parseFile(fileText) {
  const logDiv = document.getElementById('log-text');
  window.parse = {}; // For debugging

  // Get input text
  window.parse.input = fileText; // For debugging
  let cgvJSON;

  if (fileText.startsWith('{')) {
    // Load JSON
    cgvJSON = JSON.parse(fileText);
    logDiv.innerHTML = 'Loading as a JSON file. No Parsing required.'
  } else {
    // Load Sequence File using CGParse.js
    // const parseStartTime = new Date().getTime();
    const builder = createCGParseBuilder(fileText);
    cgvJSON = builder.toJSON();
    window.parse.cgvJSON = cgvJSON; // For debugging

    // const parseRunTime = elapsedTime(parseStartTime);
    // updateTime('time-seq-json', seqJsonRunTime);

    // MESSAGES
    const messages = builder.logger.history({showIcons: true});
    logDiv.innerHTML = messages;
  }

  // Load Map with JSON
  if (cgvJSON) {
    cgv.io.loadJSON(cgvJSON);
    cgv.draw();
    resizeAction(fullSize);
  }
}

function createCGParseBuilder(fileText) {
  // CGParse removes unused legend items, so each parse needs its own config copy.
  const config = JSON.parse(JSON.stringify(exampleConfig));
  return new CGParse.CGViewBuilder(fileText, {
    config: config,
    excludeFeatures: ['source', 'gene', 'exon'],
    excludeQualifiers: ['translation'],
    maxLogCount: 2
  });
}


///////////////////////////////////////////////////////////////////////////////
// Sidebar Logs/Help 
///////////////////////////////////////////////////////////////////////////////

const logLink = document.getElementById('show-log');
const helpLink = document.getElementById('show-help');
const logSection = document.querySelector('.sidebar-log');
const helpSection = document.querySelector('.sidebar-help');

logLink.addEventListener('click', (e) => {
  e.preventDefault();
  showLog()
});
function showLog() {
  logSection.style.display = 'block';
  helpSection.style.display = 'none';
  logLink.classList.add('btn-selected');
  helpLink.classList.remove('btn-selected');
}

helpLink.addEventListener('click', (e) => {
  e.preventDefault();
  showHelp()
});
function showHelp() {
  logSection.style.display = 'none';
  helpSection.style.display = 'block';
  helpLink.classList.add('btn-selected');
  logLink.classList.remove('btn-selected');
}



///////////////////////////////////////////////////////////////////////////////
// Draw Range
///////////////////////////////////////////////////////////////////////////////

drawRangeCheckbox.addEventListener('click', (e) => {
  drawRangeAction(e.target.checked);
});

function drawRangeAction(drawRange) {
  cgv.canvas._testDrawRange = drawRange;
  cgv.draw();
}
// Initial DrawRange
drawRangeAction(drawRange);

// I wanted to be able to move the view window for the draw range
// but this will require a lot more work

// const drawRange = document.getElementById('draw-range');
// dragElement(drawRange)
// function dragElement(elmnt) {
//   var mX = 0, mY = 0, dx = 0, dy = 0;
//   if (document.getElementById(elmnt.id + "header")) {
//     // if present, the header is where you move the DIV from:
//     document.getElementById(elmnt.id + "header").onmousedown = dragMouseDown;
//   } else {
//     // otherwise, move the DIV from anywhere inside the DIV:
//     elmnt.onmousedown = dragMouseDown;
//   }
//
//   function dragMouseDown(e) {
//     e = e || window.event;
//     e.preventDefault();
//     // get the mouse cursor position at startup:
//     mX = e.clientX;
//     mY = e.clientY;
//     document.onmouseup = closeDragElement;
//     // call a function whenever the cursor moves:
//     document.onmousemove = elementDrag;
//   }
//
//   function elementDrag(e) {
//     console.log('move')
//     e = e || window.event;
//     e.preventDefault();
//     // calculate the new cursor position:
//     dx = mX - e.clientX;
//     dy = mY - e.clientY;
//     mX = e.clientX;
//     mY = e.clientY;
//     // console.log(dx, dy)
//     // set the element's new position:
//     elmnt.style.left = (elmnt.offsetLeft - dx) + "px";
//     elmnt.style.top = (elmnt.offsetTop - dy) + "px";
//   }
//
//   function closeDragElement() {
//     // stop moving when mouse button is released:
//     document.onmouseup = null;
//     document.onmousemove = null;
//   }
// }

///////////////////////////////////////////////////////////////////////////////
