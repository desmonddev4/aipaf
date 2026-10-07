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
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { setMenu(false); toggle?.focus(); } });
nav?.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('click', (e) => { if (nav?.classList.contains('is-open') && !e.target.closest('.nav-shell')) setMenu(false); });

/* Hero video: respects reduced motion, with a pause control */
const video = document.querySelector('[data-hero-video]');
const pauseBtn = document.querySelector('[data-hero-pause]');
if (video) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sync = () => pauseBtn?.setAttribute('aria-pressed', String(video.paused));
  if (reduce.matches) video.pause(); else video.play?.().catch(() => {});
  video.addEventListener('play', sync);
  video.addEventListener('pause', sync);
  sync();
  pauseBtn?.addEventListener('click', () => (video.paused ? video.play() : video.pause()));
}

/* Hero card: the highlighted stage steps through Deliver > Assure > Investigate */
const stages = [...document.querySelectorAll('[data-stage]')];
if (stages.length) {
  let current = 0;
  let timer;
  const show = (i) => {
    current = i;
    stages.forEach((el, n) => {
      el.classList.toggle('is-active', n === i);
      if (n === i) el.setAttribute('aria-current', 'true'); else el.removeAttribute('aria-current');
    });
  };
  const start = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    stop();
    timer = setInterval(() => show((current + 1) % stages.length), 3800);
  };
  const stop = () => clearInterval(timer);
  stages.forEach((el, n) => {
    el.addEventListener('mouseenter', () => { stop(); show(n); });
    el.addEventListener('focus', () => { stop(); show(n); });
    el.addEventListener('mouseleave', start);
    el.addEventListener('blur', start);
  });
  show(0);
  start();
}

initForms();
