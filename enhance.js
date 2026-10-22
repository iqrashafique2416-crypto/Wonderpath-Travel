// WanderPath — clarity layer: image fallbacks, hero slideshow, tab scroll-spy.
(function () {
  /* ---------- 1) Broken images never show alt text ---------- */
  function failImage(img) {
    var holder = img.closest('.card-media, .gallery-item, .mini-gallery a, .detail-gallery a, .exp-photo') || img.parentElement;
    if (!holder) return;
    holder.classList.add('img-failed');
    holder.setAttribute('data-label', img.getAttribute('alt') || '');
  }
  function watchImages() {
    document.querySelectorAll('img').forEach(function (img) {
      if (img.classList.contains('testi-avatar') || img.closest('.lightbox')) return;
      if (img.complete && img.naturalWidth === 0 && img.src) failImage(img);
      img.addEventListener('error', function () { failImage(img); }, { once: true });
    });
  }
  /* CSS background heroes: test the URL, fall back to a gradient */
  function watchBackgrounds() {
    document.querySelectorAll('.hero-bg, .hero-slide').forEach(function (el) {
      var m = /url\((['"]?)(.*?)\1\)/.exec(el.style.backgroundImage || '');
      if (!m) return;
      var t = new Image();
      t.onerror = function () { el.classList.add('hero-fallback'); };
      t.src = m[2];
    });
  }

  /* ---------- 2) Home hero slideshow (6s crossfade) ---------- */
  function initSlideshow() {
    var slides = document.querySelectorAll('.hero-slide');
    if (slides.length < 2) return;
    var dots = document.querySelectorAll('.hero-dot');
    var caption = document.querySelector('.hero-caption');
    var i = 0, timer = null;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function show(n) {
      i = (n + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
      dots.forEach(function (d, k) { d.classList.toggle('is-active', k === i); d.setAttribute('aria-current', k === i ? 'true' : 'false'); });
      if (caption) caption.textContent = slides[i].getAttribute('data-caption') || '';
    }
    function start() { if (reduce) return; stop(); timer = setInterval(function () { show(i + 1); }, 6000); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    dots.forEach(function (d, k) { d.addEventListener('click', function () { show(k); start(); }); });
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    show(0); start();
  }

  /* ---------- 3) Sticky tab bar scroll-spy ---------- */
  function initTabs() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.dest-tabs a[href^="#"]'));
    if (!links.length) return;
    var sections = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });
    function onScroll() {
      var y = window.scrollY + 170, current = 0;
      sections.forEach(function (s, k) { if (s && s.offsetTop <= y) current = k; });
      if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 4) current = links.length - 1;
      links.forEach(function (a, k) { a.classList.toggle('is-active', k === current); });
      var active = links[current];
      var bar = active && active.parentElement;
      if (bar && bar.scrollWidth > bar.clientWidth) {
        bar.scrollLeft = active.offsetLeft - bar.clientWidth / 2 + active.clientWidth / 2;
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  document.addEventListener('DOMContentLoaded', function () {
    watchImages(); watchBackgrounds(); initSlideshow(); initTabs();
    if (document.querySelector('.mobile-cta')) document.body.classList.add('has-mobile-cta');
  });
})();
