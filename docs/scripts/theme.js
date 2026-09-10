// Load synchronously in <head> before styles so the saved theme applies at first paint.
(() => {
  'use strict';

  const storageKey = 'cgview-docs-theme';
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  const validPreference = (value) => ['light', 'dark', 'system'].includes(value) ? value : 'system';
  let preference = 'system';
  let toggle;

  try {
    preference = validPreference(localStorage.getItem(storageKey));
  } catch {
    // Storage can be disabled. Theme controls still work for this page.
  }

  const applyTheme = () => {
    const theme = preference === 'system' ? (systemTheme.matches ? 'dark' : 'light') : preference;
    document.documentElement.dataset.bsTheme = theme;
    if (toggle) {
      const action = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;
      toggle.setAttribute('aria-label', action);
      toggle.title = action;
    }
  };

  applyTheme();
  systemTheme.addEventListener('change', applyTheme);
  window.addEventListener('storage', (event) => {
    try {
      if (event.storageArea !== localStorage) return;
    } catch {
      return;
    }
    if (event.key === storageKey || event.key === null) {
      preference = validPreference(event.newValue);
      applyTheme();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    const navigation = document.querySelector('.navbar-collapse');
    if (!navigation) return;

    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = 'docs-theme';
    toggle.className = 'theme-toggle';
    toggle.innerHTML = `
      <svg class="theme-icon-sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
      </svg>
      <svg class="theme-icon-moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
        <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />
      </svg>`;
    applyTheme();
    toggle.addEventListener('click', () => {
      preference = document.documentElement.dataset.bsTheme === 'dark' ? 'light' : 'dark';
      applyTheme();
      try {
        localStorage.setItem(storageKey, preference);
      } catch {
        // Keep the selected theme in memory when persistence is unavailable.
      }
    });
    navigation.append(toggle);
  });
})();
