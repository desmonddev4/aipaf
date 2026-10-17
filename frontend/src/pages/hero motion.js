/* AIPAF hero motion piece: paste inside your existing IIFE, after the `var root` line.
   It uses your existing `root` and `calm` variables. */
  var mv = root.querySelector('[data-mv]');
  if (mv) {
    var scenes = mv.querySelectorAll('.sc'), segs = mv.querySelectorAll('.mv-bar i'), cap = mv.querySelector('.mv-cap'), cnt = mv.querySelector('.mv-count');
    var data = [['Deliver', 'Build the project properly.'], ['Assure', 'Protect the value before it is lost.'], ['Investigate', 'Establish the truth when a project fails.'], ['AIPAF', 'Assure the promise. Establish the truth.']];
    var DUR = 4400, cur = -1, timer = null;
    mv.style.setProperty('--dur', (DUR / 1000) + 's');
    function go(i) {
      if (cur > -1 && cur !== i) { (function (o) { o.classList.remove('on'); o.classList.add('leave'); setTimeout(function () { o.classList.remove('leave'); }, 800); })(scenes[cur]); }
      if (i === 0) segs.forEach(function (s) { s.className = ''; });
      void mv.offsetWidth;
      scenes[i].classList.add('on');
      segs.forEach(function (s, k) { s.className = k < i ? 'done' : (k === i ? 'run' : ''); });
      cap.firstChild.textContent = data[i][0]; cap.lastChild.textContent = data[i][1];
      cap.classList.remove('swap'); void cap.offsetWidth; cap.classList.add('swap');
      cnt.textContent = '0' + (i + 1) + ' / 04';
      cur = i;
      if (!calm) timer = setTimeout(function () { go((i + 1) % scenes.length); }, DUR);
    }
    if (calm) { go(3); segs.forEach(function (s) { s.className = 'done'; }); }
    else if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { if (!timer) go(cur < 0 ? 0 : cur); }
        else { clearTimeout(timer); timer = null; }
      }, { threshold: .2 }).observe(mv);
    } else { go(0); }
  }