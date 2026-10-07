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

/* Hero seal video: plays once and rests on the finished seal; can be replayed */
const seal = document.querySelector('[data-seal-video]');
const replay = document.querySelector('[data-seal-replay]');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
if (seal) {
  const rest = () => { if (replay) replay.hidden = false; };
  seal.addEventListener('ended', rest);
  if (reduceMotion.matches) {
    // No motion: show the finished seal straight away.
    const toEnd = () => { seal.currentTime = Math.max(0, seal.duration - 0.05); rest(); };
    if (seal.readyState >= 1) toEnd(); else seal.addEventListener('loadedmetadata', toEnd, { once: true });
  } else {
    const play = () => seal.play().catch(() => {});
    // Start once the hero is on screen
    new IntersectionObserver((entries, io) => {
      if (entries.some((e) => e.isIntersecting)) { setTimeout(play, 500); io.disconnect(); }
    }, { threshold: 0.3 }).observe(seal);
  }
  replay?.addEventListener('click', () => { replay.hidden = true; seal.currentTime = 0; seal.play().catch(() => {}); });
}

/* Hero scroll animation: sets --p (0 to 1) as the hero scrolls away; CSS does the rest */
const hero = document.querySelector('.hero');
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