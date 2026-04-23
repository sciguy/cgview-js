///////////////////////////////////////////////////////////////////////////////
// Settings
///////////////////////////////////////////////////////////////////////////////

// 'maps' is from maps.js
console.log('Available Maps (from map.js):', maps)

// Default Map
// Initial input file to load: '', 'file', or map from map.js (e.g. 'small')
// const defaultMap = '';     // Empty
// const defaultMap = 'file'; // File Choose
const defaultMap = 'small';
// const defaultMap = 'small_noplots';
// const defaultMap = 'medium';
// const defaultMap = 'locations';
// const defaultMap = 'blast';
// const defaultMap = 'labels';
// const defaultMap = 'labels3';
// const defaultMap = 'pcET30c';
// const defaultMap = 'pcDNA3';
// const defaultMap = 'paper';



// Default Checkbox Options
const fullSize = true;
const debug = false;
const drawRange = false;
const showPerformanceTest = false;
const showLabelsTest = false;
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

// Initialize CGView
cgv = new CGView.Viewer('#my-viewer', {
  height: defaultSize,
  width: defaultSize,
  SVGContext: svgcanvas.Context,
  // debug: {sections: ['time', 'position']}
});

// Initialize File Section: hide or show
const fileSectionDisplayStyle = (defaultMap === 'file') ? 'block' : 'none';
document.getElementById('file-section').style.display = fileSectionDisplayStyle;
clearFileInput();

// Initialize Options
// Full Size
const fullSizeCheckbox = document.getElementById('option-full-size');
// Debug Print
const debugModeCheckbox = document.getElementById('option-debug');
debugModeCheckbox.checked = debug;
// Draw Range
const drawRangeCheckbox = document.getElementById('test-draw-range');
drawRangeCheckbox.checked = drawRange;
// Toggle Label Test
const labelsCheckbox = document.getElementById('option-show-labels');
labelsCheckbox.checked = showLabelsTest;
// Toggle Performance Test
const performanceCheckbox = document.getElementById('option-show-performance');
performanceCheckbox.checked = showPerformanceTest;
// Toggle SVG Test
const svgModeCheckbox = document.getElementById('option-show-svg');
svgModeCheckbox.checked = showSVGTest;

// Load default map
loadMapFromID(defaultMap);


///////////////////////////////////////////////////////////////////////////////
// Map Creation and Selection
///////////////////////////////////////////////////////////////////////////////

// File selector
// Add maps from maps.js to Select
// Using global variable 'maps' from maps.js
const mapSelect = document.getElementById('map-select');
const groups = { labels: 'Labels', test: 'Tests', basic: 'Basic', large: 'Large', contigs: 'Contigs', version: 'Versions', bad: 'Bad' };
const order = ['basic', 'contigs', 'large', 'test', 'labels', 'version', 'bad'];
const optionsByGroup = {};
for (const inputKey of Object.keys(maps)) {
  const input = maps[inputKey];
  const selected = (inputKey === defaultMap) ? 'selected' : '';
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
  <option value='' disabled ${(defaultMap == '') ? 'selected' : ''}>Select an map...</option>
  <option disabled>─────────</option>
  <option value='file' ${(defaultMap == 'file') ? 'selected' : ''}>Open a file...</option>
  <option disabled>─────────</option>
  ${optionGroups}
`;

// Choose a predefined file or show the file input section
// Load map when select changes
mapSelect.innerHTML = options;
mapSelect.addEventListener('change', (e) => {
  const id = e.target.value;
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
  const url = maps[id].url
  console.log(`Loading Map: ${url}`);
  var request = new XMLHttpRequest();
  request.open('GET', url, true);
  request.onload = function() {
    const json = JSON.parse(request.responseText);
    cgv.io.loadJSON(json);
    cgv.name = maps[id].name;

    // Default label placement
    cgv.annotation.labelPlacement = labelPlacement;

    // Testing annotation (default is 50)
    // cgv.annotation.priorityMax = 200;

    // Label stuff (Below)
    const distance = cgv.sequence.length / 100;
    labelDistance.value = Math.floor(distance);
    syncLabelControls();

    cgv.draw();
    setTimeout( () => {
      cgv.resize();
    },1);
  };
  request.send();
}


///////////////////////////////////////////////////////////////////////////////
// Page Layout
///////////////////////////////////////////////////////////////////////////////

labelsCheckbox.addEventListener('click', (e) => {
  updatePageLayout();
});
performanceCheckbox.addEventListener('click', (e) => {
  updatePageLayout();
});

function updatePageLayout() {
  // Labels
  const labelsDiv = document.querySelector('.section-labels');
  labelsDiv.style.display = labelsCheckbox.checked ? 'block' : 'none';
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
perfBtn.addEventListener('click', (e) => {
  const iterationSelect = document.getElementById('iterations-select');
  const iterations = Number(iterationSelect.value);
  let performance = new CGVPerformance(cgv, cgv.name, iterations);
  console.log(performance.results);
  setTimeout(function() {
    resultsDiv.innerHTML = performance.report();
  }, 1000);
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
const labelPriorityMax = document.getElementById('labels-priority-max');

function syncLabelControls() {
  labelFontSize.value = cgv.annotation.font.size;
  labelPriorityMax.value = cgv.annotation.priorityMax;
}

labelFontSize.addEventListener('change', (e) => {
  cgv.annotation.update({font: `monospace, plain, ${labelFontSize.value}`});
  cgv.draw();
});
labelPriorityMax.addEventListener('change', () => {
  const priorityMax = Number(labelPriorityMax.value);
  if (Number.isNaN(priorityMax)) { return; }
  cgv.annotation.update({priorityMax});
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
const labelsNew = document.getElementById('labels-new');
labelsNew.addEventListener('click', () => {
  cgv.annotation.labelPlacement = 'new';
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
    const builder = new CGParse.CGViewBuilder(fileText, {
      config: exampleConfig,
      excludeFeatures: ['source', 'gene', 'exon'],
      excludeQualifiers: ['translation'],
      maxLogCount: 2
    });
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
    syncLabelControls();
    cgv.draw();
    resizeAction(fullSize);
  }
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
