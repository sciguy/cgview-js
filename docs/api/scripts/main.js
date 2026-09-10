// API navigation: literal filtering and independent, keyboard-accessible sections.
(() => {
  'use strict';

  const navigation = document.querySelector('.navigation');
  if (!navigation) return;
  const search = navigation.querySelector('#search');
  const list = navigation.querySelector('.list');
  const currentFilename = location.pathname.split('/').pop().replace(/\.js\.html$/, '.html');
  const items = Array.from(list.querySelectorAll('.item'), (element) => {
    const link = element.querySelector('.title a');
    const current = new URL(link.href).pathname.split('/').pop() === currentFilename;
    const group = element.querySelector('.itemMembers');
    const toggle = element.querySelector('.members-toggle');
    const item = {
      element, group, toggle, expanded: current,
      name: element.dataset.name.toLowerCase(),
      members: Array.from(element.querySelectorAll('li[data-name]'))
    };
    if (current) list.prepend(element);
    if (toggle) {
      toggle.hidden = false;
      toggle.addEventListener('click', () => {
        item.expanded = group.hidden;
        group.hidden = !item.expanded;
        toggle.setAttribute('aria-expanded', String(item.expanded));
      });
    }
    return item;
  });

  const filter = () => {
    const query = search.value.trim().toLowerCase();
    for (const item of items) {
      const matchesClass = item.name.includes(query);
      let matchesMember = false;
      for (const member of item.members) {
        const matches = matchesClass || member.dataset.name.toLowerCase().includes(query);
        member.hidden = !matches;
        matchesMember ||= matches;
      }
      item.element.hidden = !matchesClass && !matchesMember;
      if (item.group) {
        // Restore the user's expanded sections after clearing the search.
        item.group.hidden = query ? item.element.hidden : !item.expanded;
        for (const section of item.group.querySelectorAll('.member-section')) {
          section.hidden = !Array.from(section.querySelectorAll('li')).some((member) => !member.hidden);
        }
        item.toggle.setAttribute('aria-expanded', String(!item.group.hidden));
      }
    }
    list.scrollTop = 0;
  };

  search.addEventListener('input', filter);
  filter();
})();
