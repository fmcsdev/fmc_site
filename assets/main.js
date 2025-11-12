/* ================================
   FMC – Lightweight interactions
================================ */

/* 1) Sticky header shadow on scroll */
(function () {
  const header = document.querySelector('.fmc-header');
  if (!header) return;
  const toggleShadow = () => {
    if (window.scrollY > 8) header.classList.add('shadow-sm');
    else header.classList.remove('shadow-sm');
  };
  toggleShadow();
  window.addEventListener('scroll', toggleShadow, { passive: true });
})();

/* 2) (optional) legacy inline nav toggle */
(function () {
  const btn = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');
  if (!btn || !nav) return;
  btn.addEventListener('click', () => nav.classList.toggle('hidden'));
})();

/* 3) Scroll reveal */
(function () {
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
(function () {
  const buttons = document.querySelectorAll('[data-accordion="button"]');
  buttons.forEach(btn => {
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

/* 5) Schedule filter */
(function () {
  const form = document.querySelector('[data-filter="schedule"]');
  const rows = document.querySelectorAll('#weekly tbody tr');
  if (!form || !rows.length) return;

  const fields = {
    lang: form.querySelector('[name="lang"]'),
    level: form.querySelector('[name="level"]')
  };

  const apply = () => {
    const lang = (fields.lang?.value || '').trim().toLowerCase();
    const level = (fields.level?.value || '').trim().toLowerCase();
    rows.forEach(tr => {
      const course = (tr.cells[2]?.textContent || '').toLowerCase();
      const matchLang = !lang || course.includes(lang);
      const matchLevel = !level || course.includes(level);
      tr.style.display = (matchLang && matchLevel) ? '' : 'none';
    });
  };

  form.addEventListener('change', apply);
  apply();
})();

/* 6) Tiny carousel */
(function () {
  const root = document.querySelector('[data-carousel]');
  if (!root) return;
  const slides = root.querySelectorAll('[data-slide]');
  let i = 0;
  const show = (idx) => slides.forEach((s, j) => s.classList.toggle('opacity-100', j === idx));
  show(0);
  setInterval(() => { i = (i + 1) % slides.length; show(i); }, 3500);
})();

/* 7) Mobile sidebar drawer — SINGLE SOURCE OF TRUTH */
(function () {
  // If you load this file with `defer`, DOM is ready; no need for DOMContentLoaded.
  const drawer   = document.querySelector('[data-drawer]');
  const backdrop = document.querySelector('[data-backdrop]');
  const openBtn  = document.querySelector('[data-drawer-open]');
  const closeBtn = document.querySelector('[data-drawer-close]');
  if (!drawer || !backdrop || !openBtn) return;

  const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';
  let lastActive = null;

  const open = () => {
    lastActive = document.activeElement;
    document.body.style.overflow = 'hidden';
    drawer.classList.remove('drawer-hidden'); drawer.classList.add('drawer-visible');
    backdrop.classList.remove('backdrop-hidden'); backdrop.classList.add('backdrop-visible');
    openBtn.setAttribute('aria-expanded', 'true');
    const first = drawer.querySelector(FOCUSABLE);
    if (first) first.focus();
  };

  const close = () => {
    document.body.style.overflow = '';
    drawer.classList.add('drawer-hidden'); drawer.classList.remove('drawer-visible');
    backdrop.classList.add('backdrop-hidden'); backdrop.classList.remove('backdrop-visible');
    openBtn.setAttribute('aria-expanded', 'false');
    if (lastActive) lastActive.focus();
  };

  // Bind once
  openBtn.addEventListener('click', open, { capture: true });
  backdrop.addEventListener('click', close, { capture: true });
  if (closeBtn) closeBtn.addEventListener('click', close, { capture: true });

  // Close on links inside the drawer
  drawer.addEventListener('click', (e) => {
    if (e.target.closest('a')) close();
  }, { capture: true });

  // ESC to close + basic focus trap
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab' && drawer.classList.contains('drawer-visible')) {
      const f = drawer.querySelectorAll(FOCUSABLE);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // Force closed on load
  close();

  // Debug helpers (optional)
  window.__drawerOpen = open;
  window.__drawerClose = close;
})();


