/* ======================================================
   FMC Shared Frontend Script
   (drawer, reveal animation, header shadow, etc.)
   ====================================================== */

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

/* 2) Reveal animation for [data-reveal] */
(function () {
  const items = document.querySelectorAll('[data-reveal]');
  if (!items.length) return;

  if (!('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('reveal-visible'));
    return;
  }

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('reveal-visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });

  items.forEach(el => io.observe(el));
})();

/* 3) Mobile drawer menu */
(function () {
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
    drawer.classList.replace('drawer-hidden', 'drawer-visible');
    backdrop.classList.replace('backdrop-hidden', 'backdrop-visible');
    openBtn.setAttribute('aria-expanded', 'true');

    const first = drawer.querySelector(FOCUSABLE);
    if (first) first.focus();
  };

  const close = () => {
    document.body.style.overflow = '';
    drawer.classList.replace('drawer-visible', 'drawer-hidden');
    backdrop.classList.replace('backdrop-visible', 'backdrop-hidden');
    openBtn.setAttribute('aria-expanded', 'false');
    if (lastActive) lastActive.focus();
  };

  openBtn.addEventListener('click', open, { capture: true });
  backdrop.addEventListener('click', close, { capture: true });
  if (closeBtn) closeBtn.addEventListener('click', close, { capture: true });

  // Close drawer when clicking a link inside
  drawer.addEventListener('click', e => {
    if (e.target.closest('a')) close();
  });

  // ESC closes drawer + basic focus trap
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();

    if (e.key === 'Tab' && drawer.classList.contains('drawer-visible')) {
      const focusable = drawer.querySelectorAll(FOCUSABLE);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // Keep drawer closed on load
  drawer.classList.add('drawer-hidden');
  backdrop.classList.add('backdrop-hidden');
})();

