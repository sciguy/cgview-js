// Share Prism with the rest of the site while preserving existing #lineN URLs.
(() => {
  'use strict';

  Prism.hooks.add('after-highlight', ({ element }) => {
    if (!element.parentElement.matches('pre.source')) return;
    element.innerHTML = element.innerHTML.split('\n')
      .map((line, index) => `<span id="line${index + 1}"></span>${line}`).join('\n');
  });

  // JSDoc examples without a language fence are JavaScript by default.
  for (const code of document.querySelectorAll('pre > code')) {
    if (Prism.util.getLanguage(code) === 'none') code.classList.add('language-javascript');
  }
  Prism.highlightAll();

  // The browser may have tried to scroll before the source anchors existed.
  if (/^#line\d+$/.test(location.hash)) {
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'instant' });
  }
})();
