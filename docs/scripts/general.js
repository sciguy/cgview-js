////////////////////////////////////////////////////////////////////////////////
// Markdown conversion
////////////////////////////////////////////////////////////////////////////////

/**
 * Render trusted, checked-in Markdown with the site's existing heading anchors.
 * Raw HTML supports embedded viewers and controls. Requires the markdown-it asset;
 * does not modify the document.
 * @param {string} source Markdown read from #markdown-in.innerHTML.
 * @returns {string} HTML ready for #markdown-out.
 */
function renderDocsMarkdown(source) {
  const parser = window.markdownit({ html: true, linkify: true });
  const slugs = new Set();
  const headingText = (tokens) => tokens.map((token) => {
    if (token.type === 'image') return headingText(token.children);
    if (['text', 'code_inline', 'html_inline'].includes(token.type)) return token.content;
    if (['softbreak', 'hardbreak'].includes(token.type)) return '\n';
    return '';
  }).join('');
  parser.renderer.rules.heading_open = (tokens, index, options, env, renderer) => {
    // Retain the old Marked heading normalization so existing URLs keep working.
    // See vendor/marked-LICENSE.txt for the original slugger's MIT license.
    const base = headingText(tokens[index + 1].children).toLowerCase().trim()
      .replace(/<[!\/a-z].*?>/gi, '')
      .replace(/[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g, '')
      .replace(/\s/g, '-');
    let slug = base;
    let suffix = 0;
    while (slugs.has(slug)) slug = `${base}-${++suffix}`;
    slugs.add(slug);
    tokens[index].attrSet('id', slug);
    return renderer.renderToken(tokens, index, options);
  };

  // Reading Markdown from an HTML container escapes angle brackets in code twice.
  return parser.render(source).replace(/&amp;gt;/g, '>').replace(/&amp;lt;/g, '<');
}

/**
 * Render #markdown-in into #markdown-out and optionally run the tutorial examples.
 * @param {boolean} [addFinalCode=false] Run JavaScript blocks after a short delay
 *   and append their code without comments to #final-code.
 * @returns {void}
 */
function tutorialMarkdown(addFinalCode = false) {
  var inEl = document.querySelector('#markdown-in');
  var outEl = document.querySelector('#markdown-out');
  outEl.innerHTML = renderDocsMarkdown(inEl.innerHTML);

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
document.addEventListener('DOMContentLoaded', sideNavCheck);


////////////////////////////////////////////////////////////////////////////////
// Auto Resize My Viewer
////////////////////////////////////////////////////////////////////////////////

/**
 * Fit the page's global CGView viewer to the main content after load and resize.
 * Installs window load/resize handlers; the viewer may be created by a deferred example.
 * @returns {void}
 */
function autoResizeMyViewer() {
  const setHeight = 500;
  const mainPadding = 20 * 2;
  function myResize() {
    if (!window.cgv) return; // Tutorial examples create the viewer after a short delay.
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




