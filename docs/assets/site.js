const toggle = document.querySelector('[data-menu-toggle]');
const menu = document.querySelector('[data-menu]');

toggle?.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') === 'true';
  toggle.setAttribute('aria-expanded', String(!open));
  menu?.toggleAttribute('data-open', !open);
});
