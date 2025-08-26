///////////////////////////////////////////////////////////////////////////////
// Settings
///////////////////////////////////////////////////////////////////////////////

// 'maps' is from maps.js
console.log('Maps (from map.js):', maps)

// Deafult Map
const defaultMap = 'small';
// const defaultMap = 'locations';
// const defaultMap = 'blast';
// const defaultMap = 'full_circle_2mbp';
// const defaultMap = 'linear_1_6';
// const defaultMap = 'labels';
// const defaultMap = 'labels3';
// const defaultMap = 'pcET30c';
// const defaultMap = 'pcDNA3';
// const defaultMap = 'version_0_1';
// const defaultMap = 'small_noplots';
// const defaultMap = 'test';

// The non-full size dimensions of the map
// Performanace tests should be done at this size for consistency
const defaultSize = 600; // 6oo is the size to run perfance test at


// Add CGView
cgv = new CGV.Viewer('#my-viewer', {
  height: defaultSize,
  width: defaultSize,
  SVGContext: svgcanvas.Context,
  // debug: {sections: ['time', 'position']}
});
loadMapFromID(defaultMap);
// setTimeout(function() {
//   moveFeatures(-15050);
// }, 500);
cgv.annotation.labelPlacement = 'angled';



///////////////////////////////////////////////////////////////////////////////
// Map Creation and Selection
///////////////////////////////////////////////////////////////////////////////

// Add maps from maps.js to Select
// Using global variable 'maps' from maps.js
const mapSelect = document.getElementById('map-select');
// let options = '';
let options = `
  <option value='' disabled ${(defaultMap == '') ? 'selected' : ''}>Select an input...</option>
  <option disabled>─────────</option>
  <option value='file' ${(defaultMap == 'file') ? 'selected' : ''}>Open a file...</option>
  <option disabled>─────────</option>
`;
for (const map of Object.keys(maps)) {
  const selected = (map === defaultMap) ? 'selected' : '';
  options += `<option value='${map}' ${selected}>${maps[map].name}</option>`;
}
mapSelect.innerHTML = options;

// Choose a predefined file or show the file input section
// Load map when select changes
mapSelect.innerHTML = options;
// mapSelect.addEventListener('change', (e) => {
//   const id = e.target.value;
//   const fileSection = document.getElementById('file-section');
//   if (id === 'file') {
//     fileSection.style.display = 'block';
//     return;
//   } else {
//     fileSection.style.display = 'none';
//     clearFileInput();
//   }
//   loadInputFromID(id);
// });

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

  var reader = new FileReader();
  reader.onload = function(e) {
    // const inputTextDiv = document.getElementById('input-text');
    // var contents = e.target.result;
    // inputTextDiv.innerHTML = contents;
    runParse();
  };

  reader.onerror = function(e) {
    console.error("File could not be read! Error: " + e.target.error);
  };

  reader.readAsText(file);
});

// Load map when select changes
mapSelect.addEventListener('change', (e) => {
  const id = e.target.value;
  loadMapFromID(id);
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

    // Testing annotation (default is 50)
    // cgv.annotation.priorityMax = 200;

    // Label stuff (Below)
    const distance = cgv.sequence.length / 100;
    labelDistance.value = Math.floor(distance);
    labelFontSize.value = cgv.annotation.font.size;

    cgv.draw();
    setTimeout( () => {
      cgv.resize();
    },1);
  };
  request.send();
}


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
// Full Size Map
///////////////////////////////////////////////////////////////////////////////

function myResize() {
  const width = window.innerWidth;
  const height = window.innerHeight
  cgv.resize(width-438, height-100);

  const testDrawRange = document.getElementById('test-draw-range').checked;
  testDrawRange && (cgv.canvas._testDrawRange = testDrawRange);
}

const fullSize = document.getElementById('option-full-size');
fullSize.addEventListener('click', (e) => {
  if (e.target.checked) {
    window.addEventListener('resize', myResize)
    myResize();
  } else {
    window.removeEventListener('resize', myResize)
    cgv.resize(defaultSize, defaultSize);
  }
});


///////////////////////////////////////////////////////////////////////////////
// Draw Range
///////////////////////////////////////////////////////////////////////////////

const drawRangeOption = document.getElementById('test-draw-range');
drawRangeOption.addEventListener('click', (e) => {
  const testOn = e.target.checked;
  cgv.canvas._testDrawRange = testOn;
  cgv.draw();
});


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
  openInProksee(cgv, 'CGParse', true)
});


///////////////////////////////////////////////////////////////////////////////
// Debug Print
///////////////////////////////////////////////////////////////////////////////

const debugMode = document.getElementById('option-debug');
debugMode.addEventListener('click', (e) => {
  if (e.target.checked) {
    cgv.debug = true;
  } else {
    cgv.debug = false;
    cgv.canvas.clear('debug');
  }
  cgv.draw();
});


///////////////////////////////////////////////////////////////////////////////
// SVG Testing
///////////////////////////////////////////////////////////////////////////////

const svgMode = document.getElementById('option-svg');
svgMode.addEventListener('click', (e) => {
  const svgSection = document.getElementById('svg-section');
  if (e.target.checked) {
    svgSection.style.visibility = 'visible';
    svgSection.style.display = 'block';
  } else {
    svgSection.style.visibility = 'hidden';
    svgSection.style.display = 'none';
  }
});
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
function newPostion(bp, change, length) {
  if (change > 0) {
    return  ((bp + change) > length) ? (bp + change - length) : (bp + change);
  } else {
    return  ((bp + change) < 1) ? (bp + change + length) : (bp + change);
  }
}
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

const labelDistance = document.getElementById('labels-move-distance');
const labelFontSize = document.getElementById('labels-font-size');
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
