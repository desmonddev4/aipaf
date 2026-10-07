import { initForms } from './forms.js';

const header = document.querySelector('[data-header]');
const toggle = document.querySelector('[data-nav-toggle]');
const nav = document.querySelector('[data-nav]');

/* Header: gains a darker glass once the page scrolls */
const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 24);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

/* Mobile menu */
const setMenu = (open) => {
  if (!toggle || !nav) return;
  toggle.setAttribute('aria-expanded', String(open));
  nav.classList.toggle('is-open', open);
};
toggle?.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));

/* Dropdown menus */
const dropdowns = [...document.querySelectorAll('.nav-dropdown')];
const setDropdown = (dropdown, open) => {
  const trigger = dropdown?.querySelector('.nav-dropdown-trigger');
  if (!dropdown || !trigger) return;
  dropdown.classList.toggle('is-open', open);
  trigger.setAttribute('aria-expanded', String(open));
};
dropdowns.forEach((dropdown) => {
  const trigger = dropdown.querySelector('.nav-dropdown-trigger');
  trigger?.addEventListener('click', (event) => {
    event.stopPropagation();
    const willOpen = trigger.getAttribute('aria-expanded') !== 'true';
    dropdowns.forEach((item) => setDropdown(item, item === dropdown && willOpen));
  });
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.nav-dropdown')) dropdowns.forEach((dropdown) => setDropdown(dropdown, false));
  if (nav?.classList.contains('is-open') && !event.target.closest('.nav-shell')) setMenu(false);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    setMenu(false);
    dropdowns.forEach((dropdown) => setDropdown(dropdown, false));
    toggle?.focus();
  }
});
nav?.addEventListener('click', (event) => { if (event.target.closest('a')) setMenu(false); });

/* Hero videos: autoplay while the hero is visible and pause when it scrolls away */
const hero = document.querySelector('.hero');
const heroVideo = document.querySelector('[data-hero-video]');
const sealVideo = document.querySelector('[data-seal-video]');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

if (heroVideo || sealVideo) {
  const videos = [heroVideo, sealVideo].filter(Boolean);
  const playVideos = () => {
    if (reduceMotion.matches) return;
    videos.forEach((video) => video.play?.().catch(() => {}));
  };
  const pauseVideos = () => videos.forEach((video) => video.pause());

  if (reduceMotion.matches) {
    pauseVideos();
  } else {
    const heroObserver = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) playVideos(); else pauseVideos();
    }, { threshold: 0.2 });
    heroObserver.observe(hero);
  }
}

/* Hero scroll animation: sets --p (0 to 1) as the hero scrolls away; CSS does the rest */
if (hero && !reduceMotion.matches) {
  let ticking = false;
  const update = () => {
    const p = Math.min(1, Math.max(0, window.scrollY / (hero.offsetHeight * 0.85)));
    hero.style.setProperty('--p', p.toFixed(3));
    ticking = false;
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener('resize', update);
  update();
}

initForms();