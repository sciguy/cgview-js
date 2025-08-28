////////////////////////////////////////////////////////////////////////////////
// Markdown conversion
////////////////////////////////////////////////////////////////////////////////

// Takes text in #markdown-in and
//  - convert to markdown and moves it to #markdown-out
//  - evals the code
//  - copies code without comments to #final-code
// see https://github.com/chjj/marked
function tutorialMarkdown(marked, addFinalCode) {
  //  marked.setOptions({
  //    sanitize: true
  //  });
  var marked_ = marked;
  var marked = function(text) {
    var tok = marked_.lexer(text);
    text = marked_.parser(tok);
    text = text.replace(/<pre>/ig, '<pre class="prettyprint">');
    text = text.replace(/&amp;gt;/g, '>');
    text = text.replace(/&amp;lt;/g, '<');
    return text;
  };

  var inEl = document.querySelector('#markdown-in');
  var outEl = document.querySelector('#markdown-out');
  outEl.innerHTML = marked( inEl.innerHTML );

  // Takes all the code block on the page
  // Copies the code (minus the comments) to an element with the id $(#final-code code)
  // Run the code as well. This is great for demos of CGView.
  if (addFinalCode) {
    var finalCode = document.querySelector('#final-code code');
    var codeEls = document.querySelectorAll('code.language-js:not(.final)');
    codeEls.forEach( function(el) {
      var code = el.innerHTML.replace(/\s*\/\/.*/g, '');
      code = code.replaceAll('&lt;', '<');
      code = code.replaceAll('&gt;', '>');
      // console.log(code);
      // Delay evaulation, to make sure the page content is loaded quickly
      setTimeout( () => {
        eval( code );
      }, 100);
      var textNode = document.createTextNode( code + "\n" );
      finalCode.appendChild(textNode);
    });
  }
}


////////////////////////////////////////////////////////////////////////////////
// Side Nav Collapse
////////////////////////////////////////////////////////////////////////////////

// Collapse Side Nav if narrow enough on window resize 
function sideNavCheck() {
  const sidenav = document.getElementById('sidebar-nav');
  if (!sidenav) {return}
  if (window.innerWidth < 576) {
    sidenav.classList.add("collapse");
  } else {
    sidenav.classList.remove("collapse");
  }
}

// Adjust side nav on window resize
window.addEventListener("resize", sideNavCheck)
setTimeout(sideNavCheck, 100);


////////////////////////////////////////////////////////////////////////////////
// Auto Resize My Viewer
////////////////////////////////////////////////////////////////////////////////

function autoResizeMyViewer() {
  const setHeight = 500;
  const mainPadding = 20 * 2;
  function myResize() {
    const main = document.getElementsByTagName('main')[0];
    const mainWidth = main.clientWidth - mainPadding;
    const height = Math.min(mainWidth, setHeight);
    // const width = Math.min(mainWidth, setWidth);
    cgv.resize(mainWidth, height);
  }
  window.onresize = myResize;
  window.onload = function () {
    setTimeout( () => {
      myResize();
    }, 100);
  }
}


////////////////////////////////////////////////////////////////////////////////
// Create CGView and Load Data
////////////////////////////////////////////////////////////////////////////////

function createViewerAndLoadJSON(path) {
  // Create Viewer in default div: #my-viewer
  const cgv = new CGView.Viewer('#my-viewer', {height: 500});

  // Auto resize viewer
  autoResizeMyViewer();

  // Add viewer as global variable 'cgv'
  window.cgv = cgv;

  // Request data and draw map
  var request = new XMLHttpRequest();
  request.open('GET', path, true);
  request.onload = function() {
    var response = request.response;
    const json = JSON.parse(response);
    cgv.io.loadJSON(json);
    cgv.draw()
  };
  request.send();
}

function createViewerAndLoadGenBank(path, config={}) {
  // Create Viewer in default div: #my-viewer
  const cgv = new CGView.Viewer('#my-viewer', {height: 500});

  // Auto resize viewer
  autoResizeMyViewer();

  // Add viewer as global variable 'cgv'
  window.cgv = cgv;

  // Request data and draw map
  var request = new XMLHttpRequest();
  request.open('GET', path, true);
  request.onload = function() {
    // Get the GenBank file text
    var genbank = request.response;

    // Parse a file
    var builder = new CGParse.CGViewBuilder(genbank, {
      config: config,
      excludeFeatures: ['source', 'gene', 'exon'],
      excludeQualifiers: ['translation'],
    });

    // Load the JSON into CGView.js
    cgv.io.loadJSON(builder.toJSON());

    // Draw the map
    cgv.draw()
  };
  request.send();
}


////////////////////////////////////////////////////////////////////////////////
// Add tables to example
////////////////////////////////////////////////////////////////////////////////

function addExampleTables(id, name, size, link) {
  const ncbiLink = link ? link : `https://www.ncbi.nlm.nih.gov/nuccore/${id}`;
  // Source Table
  const sourceTable = `
    <table>
      <tr><th>Species</th><th>Size (bp)</th><th>GenBank</th><th>NCBI Link</th></tr>
      <tr>
        <td><em>${name}</em></td>
        <td>${size}</td>
        <td><a href='../data/seq/${id}.gbk'>${id}.gbk</a></td>
        <td><a href='${ncbiLink}'>NCBI</a></td>
      </tr>
    </table>`;

  // Files Table (NO LONGER USED)
  // const filesTable = `
  //   <table>
  //     <tr><th>GenBank</th><th>Config</th><th>JSON</th></tr>
  //     <tr>
  //       <td><a href='../data/seq/${id}.gbk'>${id}.gbk</a></td>
  //       <td><a href='../data/config/${id}.yaml'>${id}.yaml</a></td>
  //       <td><a href='../data/json/${id}.json'>${id}.json</a></td>
  //     </tr>
  //   </table>`;

  // Replace tables
  const tableDiv = document.getElementById('example-tables');
  tableDiv.innerHTML = `
    <h3>Source</h3>
    ${sourceTable}`;
}

//     <h3>Files</h3>
//     ${filesTable}`;
// }





