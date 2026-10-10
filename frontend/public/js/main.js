import { initForms } from './forms.js';

/* Hero videos: autoplay while the hero is visible and pause when it scrolls away */
const hero = document.querySelector('.hero');
const heroVideo = document.querySelector('[data-hero-video]');
const sealVideo = document.querySelector('[data-seal-video]');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

if (heroVideo || sealVideo) {
  const videos = [heroVideo, sealVideo].filter(Boolean);
  let heroIsVisible = false;
  let retryListenersAdded = false;

  const retryPlayback = () => {
    if (heroIsVisible && !reduceMotion.matches) playVideos();
  };
  const addPlaybackRetryListeners = () => {
    if (retryListenersAdded) return;
    retryListenersAdded = true;
    document.addEventListener('pointerdown', retryPlayback, { passive: true });
    document.addEventListener('touchstart', retryPlayback, { passive: true });
    document.addEventListener('keydown', retryPlayback);
  };
  const playVideos = () => {
    if (reduceMotion.matches) return;
    videos.forEach((video) => {
      const playback = video.play();
      playback?.catch((error) => {
        if (error.name === 'NotAllowedError') {
          addPlaybackRetryListeners();
          return;
        }
        if (error.name === 'AbortError') return;
        console.warn('Unable to play an AIPAF hero video.', error);
      });
    });
  };
  const pauseVideos = () => videos.forEach((video) => video.pause());

  if (reduceMotion.matches) {
    pauseVideos();
  } else {
    const heroObserver = new IntersectionObserver((entries) => {
      heroIsVisible = Boolean(entries[0]?.isIntersecting);
      if (heroIsVisible) playVideos(); else pauseVideos();
    }, { threshold: 0.2 });
    heroObserver.observe(hero);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pauseVideos();
      else if (heroIsVisible) playVideos();
    });
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