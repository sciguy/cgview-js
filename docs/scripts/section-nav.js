// Follow visible sections while retaining the site's dotted IDs and li.active styles.
document.addEventListener('DOMContentLoaded', () => {
  const main = document.querySelector('main');
  const navigation = document.querySelector('#sidebar-nav');
  if (!main || !navigation) return;

  const entries = Array.from(navigation.querySelectorAll('a[href^="#"]'), (link) => ({
    link,
    section: main.querySelector(`#${CSS.escape(decodeURIComponent(link.hash.slice(1)))}`)
  })).filter(({ section }) => section);
  if (!entries.length) return;

  let active;
  let scheduled = false;
  function update() {
    scheduled = false;
    const offset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    let current = entries[0];
    for (const entry of entries) {
      if (entry.section.getBoundingClientRect().top <= offset + 1) current = entry;
    }
    // The last section may be too short to reach the top of the viewport.
    if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 1) {
      current = entries[entries.length - 1];
    }
    if (current === active) return;
    active?.link.parentElement.classList.remove('active');
    active?.link.removeAttribute('aria-current');
    current.link.parentElement.classList.add('active');
    current.link.setAttribute('aria-current', 'location');
    active = current;
  }

  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(update);
  }

  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('load', scheduleUpdate);
  new ResizeObserver(scheduleUpdate).observe(main);
  update();
});
