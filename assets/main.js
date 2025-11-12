/* ================================
   FMC – Lightweight interactions
   ================================ */

/* 1) Sticky header shadow on scroll */
(function(){
  const header = document.querySelector('.fmc-header');
  if (!header) return;
  const toggleShadow = () => {
    if (window.scrollY > 8) header.classList.add('shadow-sm');
    else header.classList.remove('shadow-sm');
  };
  toggleShadow();
  window.addEventListener('scroll', toggleShadow, { passive: true });
})();

/* 2) Mobile nav toggle (legacy simple hide/show for inline nav) */
(function(){
  const btn = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');
  if (!btn || !nav) return;
  btn.addEventListener('click', () => {
    nav.classList.toggle('hidden');
  });
})();

/* 3) Scroll reveal (IntersectionObserver) */
(function(){
  const items = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window) || !items.length) {
    items.forEach(el => el.classList.add('reveal-visible'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('reveal-visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  items.forEach(el => io.observe(el));
})();

/* 4) FAQ accordion */
(function(){
  const faqButtons = document.querySelectorAll('[data-accordion="button"]');
  faqButtons.forEach(btn => {
    const panel = btn.nextElementSibling;
    if (!panel) return;
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      panel.style.maxHeight = expanded ? '0px' : panel.scrollHeight + 'px';
    });
    btn.setAttribute('aria-expanded', 'false');
    panel.style.maxHeight = '0px';
  });
})();

/* 5) Schedule filter (by language/level) – optional */
(function(){
  const form = document.querySelector('[data-filter="schedule"]');
  const rows = document.querySelectorAll('#weekly tbody tr');
  if (!form || !rows.length) return;

  const fields = {
    lang: form.querySelector('[name="lang"]'),
    level: form.querySelector('[name="level"]')
  };

  const apply = () => {
    const lang = (fields.lang?.value || '').trim();
    const level = (fields.level?.value || '').trim();
    rows.forEach(tr => {
      const course = (tr.cells[2]?.textContent || '').toLowerCase();
      const matchLang = !lang || course.includes(lang.toLowerCase());
      const matchLevel = !level || course.includes(level.toLowerCase());
      tr.style.display = (matchLang && matchLevel) ? '' : 'none';
    });
  };

  form.addEventListener('change', apply);
  apply();
})();

/* 6) Tiny carousel (auto-rotate) – optional, for a testimonials strip */
(function(){
  const root = document.querySelector('[data-carousel]');
  if (!root) return;
  const slides = root.querySelectorAll('[data-slide]');
  let i = 0;
  const show = (idx) => {
    slides.forEach((s, j) => s.classList.toggle('opacity-100', j === idx));
  };
  show(0);
  setInterval(() => { i = (i + 1) % slides.length; show(i); }, 3500);
})();

/* 7) Mobile sidebar drawer – single, robust implementation
      Requires in HTML:
        - button[data-drawer-open]   (open button, e.g., 3-dots at right)
        - aside[data-drawer]         (drawer panel)
        - [data-drawer-close]        (X button inside drawer)
        - [data-backdrop]            (dark overlay behind drawer)
      CSS helpers needed:
        .drawer-hidden { transform: translateX(100%); }
        .drawer-visible { transform: translateX(0%); }
        .backdrop-hidden { opacity: 0; pointer-events: none; }
        .backdrop-visible { opacity: 1; pointer-events: auto; }
*/
(function(){
  const drawer   = document.querySelector('[data-drawer]');
  const backdrop = document.querySelector('[data-backdrop]');
  const openBtn  = document.querySelector('[data-drawer-open]');

  if (!drawer || !backdrop || !openBtn) return;

  // --- Force CLOSED state on load (prevents visible-by-default issues) ---
  const forceClosed = () => {
    document.body.style.overflow = '';
    drawer.classList.add('drawer-hidden');
    drawer.classList.remove('drawer-visible');
    backdrop.classList.add('backdrop-hidden');
    backdrop.classList.remove('backdrop-visible');
    openBtn.setAttribute('aria-expanded','false');
  };
  forceClosed();

  const open = () => {
    document.body.style.overflow = 'hidden';
    drawer.classList.remove('drawer-hidden'); drawer.classList.add('drawer-visible');
    backdrop.classList.remove('backdrop-hidden'); backdrop.classList.add('backdrop-visible');
    openBtn.setAttribute('aria-expanded','true');
    // Focus first focusable for accessibility
    const first = drawer.querySelector('a[href],button,[tabindex]:not([tabindex="-1"])');
    if (first) first.focus();
  };

  const close = () => {
    document.body.style.overflow = '';
    drawer.classList.add('drawer-hidden'); drawer.classList.remove('drawer-visible');
    backdrop.classList.add('backdrop-hidden'); backdrop.classList.remove('backdrop-visible');
    openBtn.setAttribute('aria-expanded','false');
  };

  // Open when tapping the open button
  openBtn.addEventListener('click', open);

  // Close on: backdrop tap, X button, or any link inside drawer (event delegation)
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-backdrop]')) return close();
    if (e.target.closest('[data-drawer-close]')) return close();
    if (e.target.closest('[data-drawer] a')) return close();
  });

  // Close on Esc
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
})();
