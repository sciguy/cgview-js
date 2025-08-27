document.addEventListener("DOMContentLoaded", function () {

  // INSERT Logo HTML with appropriate relative paths
  // NOTE: I gave up on this for now and just added the HTML blocks manually

  //      <!-- CG Apps Logo -->
  //      <div id="logo-container">
  //        <!-- Fallback - this is replaced in logo.js -->
  //        <a class="navbar-brand" href="index.html"><img class='logo-fallback' src='images/cgview-logo.png' />CGView.js</a>
  //      </div>

  // APP LOGO NAME
  // const appLogoName = "cgview-logo.png";

  // // Get the script element for this file
  // var scriptEl = document.currentScript || (function () {
  //   var scripts = document.getElementsByTagName('script');
  //   return scripts[scripts.length - 1];
  // })();

  // // src might be relative ("scripts/logo.js") or absolute ("file:///.../scripts/logo.js")
  // var scriptSrc = scriptEl.getAttribute('src');

  // // Always resolve against the document's base URI
  // var scriptURL     = new URL(scriptSrc, document.baseURI);  // absolute URL to logo.js
  // var scriptsDirURL = new URL('./', scriptURL);              // .../docs/scripts/
  // var siteRootURL   = new URL('../', scriptsDirURL);         // .../docs/
  // var imagesURL     = new URL('images/', siteRootURL);       // .../docs/images/

  // var urls = {
  //   cgAppsLogo: new URL('cgparse-logo.png', imagesURL).href,
  //   cgviewLogo: new URL('cgview-logo.png', imagesURL).href,
  //   cgparseLogo: new URL('cgparse-logo.png', imagesURL).href,
  //   homeHref:   new URL('index.html', siteRootURL).href,
  // };

  // const html = `
  //   <!-- CG Apps Logo -->
  //   <div class="logo-wrap">
  //     <a href="${urls.homeHref}" id="app-logo" aria-haspopup="true" aria-expanded="false">
  //       <img src="${urls.cgAppsLogo}" alt="CG Apps" />
  //     </a>
  //     <div id="cg-apps" role="menu" aria-label="CG Apps">
  //       <a role="menuitem" href="https://js.cgview.ca">
  //         <img src="${urls.cgviewLogo}" alt="CGView.js" />CGView.js
  //       </a>
  //       <a role="menuitem" href="https://parse.cgview.ca">
  //         <img src="${urls.cgparseLogo}" alt="CGParse.js" />CGParse.js
  //       </a>
  //     </div>
  //   </div>
  //   <a class="navbar-brand" href="${urls.homeHref}">CGView.js</a>
  // `;

  // const mount = document.getElementById('logo-container');
  // if (mount) mount.innerHTML = html;


  // LOGO INTERACTION

  const logo = document.getElementById('app-logo');
  const panel = document.getElementById('cg-apps');
  const wrap  = document.querySelector('.logo-wrap');
  let hideTimer;

  function isOpen() {
    return panel.classList.contains('open');
  }

  function openPanel() {
    panel.classList.add('open');
    logo.setAttribute('aria-expanded', 'true');
  }

  function closePanel() {
    panel.classList.remove('open');
    logo.setAttribute('aria-expanded', 'false');
  }

  function togglePanel() {
    if (isOpen()) closePanel();
    else openPanel();
  }

  function scheduleClose(delay = 150) {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(closePanel, delay);
  }

  function cancelClose() {
    clearTimeout(hideTimer);
  }

  // Click the logo to toggle
  logo.addEventListener('click', function (e) {
    // If the logo is a home link, prevent navigating when using it as a trigger
    e.preventDefault();
    togglePanel();
  });

  // Open on hover over the logo; close after mouse leaves both
  logo.addEventListener('mouseenter', openPanel);
  logo.addEventListener('mouseleave', scheduleClose);

  panel.addEventListener('mouseenter', cancelClose);
  panel.addEventListener('mouseleave', scheduleClose);

  // Close on outside click
  document.addEventListener('click', function (e) {
    if (!wrap.contains(e.target)) {
      closePanel();
    }
  });

  // Close on Escape for keyboard users
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closePanel();
  });

  // Basic focus management: move focus to the first item when opening via keyboard
  logo.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && !isOpen()) {
      e.preventDefault();
      openPanel();
      const first = panel.querySelector('[role="menuitem"]');
      if (first) first.focus();
    }
  });
});