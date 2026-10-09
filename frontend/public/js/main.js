import { initForms } from './forms.js';

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