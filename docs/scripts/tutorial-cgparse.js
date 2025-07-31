
// <!-- D3 -->
// <script src="../scripts/d3.min.js"></script>
// <!-- CGView -->
// <!-- <script src='../dist/cgview.min.js'></script> -->
// <link rel="stylesheet" href="../dist/cgview.css" />
// <!-- CGParse -->
// <script src='../scripts/CGParse.min.js'></script>
// <!-- This Script (type must be set to module) -->
// <script type="module" src="../scripts/tutorial-cgparse.js"></script>

import * as CGView from 'https://esm.sh/cgview';

// First create the viewer
let cgv = new CGView.Viewer('#my-viewer', {
  height: 500,
  width: 500
});

// Download a sequence file
const response = await fetch('https://js.cgview.ca/data/seq/NZ_CP010546.gbk');
let seqFileText = await response.text();

// Parse the file with CGParse
const seqFile = new CGParse.SequenceFile(seqFileText)
const cgvJSON = seqFile.toCGViewJSON();

// Load the JSON into CGView
cgv.io.loadJSON(cgvJSON);