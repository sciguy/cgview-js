document.addEventListener("DOMContentLoaded", function () {
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