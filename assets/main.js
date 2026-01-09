/* ================================
   FMC – Lightweight interactions
================================ */

/* 1) Sticky header shadow on scroll */
(() => {
  const header = document.querySelector(".fmc-header");
  if (!header) return;

  const toggleShadow = () => {
    header.classList.toggle("shadow-sm", window.scrollY > 8);
  };

  toggleShadow();
  window.addEventListener("scroll", toggleShadow, { passive: true });
})();

/* 2) Scroll reveal */
(() => {
  const items = document.querySelectorAll("[data-reveal]");
  if (!items.length) return;

  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("reveal-visible"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("reveal-visible");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  items.forEach((el) => io.observe(el));
})();

/* 3) FAQ accordion */
(() => {
  const buttons = document.querySelectorAll('[data-accordion="button"]');
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    const panel = btn.nextElementSibling;
    if (!panel) return;

    btn.setAttribute("aria-expanded", "false");
    panel.style.maxHeight = "0px";

    btn.addEventListener("click", () => {
      const expanded = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!expanded));
      panel.style.maxHeight = expanded ? "0px" : panel.scrollHeight + "px";
    });
  });
})();

/* 4) Schedule filter */
(() => {
  const form = document.querySelector('[data-filter="schedule"]');
  const rows = document.querySelectorAll("#weekly tbody tr");
  if (!form || !rows.length) return;

  const langEl = form.querySelector('[name="lang"]');
  const levelEl = form.querySelector('[name="level"]');

  const apply = () => {
    const lang = (langEl?.value || "").trim().toLowerCase();
    const level = (levelEl?.value || "").trim().toLowerCase();

    rows.forEach((tr) => {
      const course = (tr.cells[2]?.textContent || "").toLowerCase();
      const matchLang = !lang || course.includes(lang);
      const matchLevel = !level || course.includes(level);
      tr.style.display = matchLang && matchLevel ? "" : "none";
    });
  };

  form.addEventListener("change", apply);
  apply();
})();

/* 5) Tiny carousel (school images) */
(() => {
  const root = document.querySelector("[data-carousel]");
  if (!root) return;

  const slides = Array.from(root.querySelectorAll("[data-slide]"));
  if (slides.length <= 1) return;

  let i = 0;

  const show = (idx) => {
    slides.forEach((s, j) => {
      s.classList.toggle("opacity-100", j === idx);
      s.classList.toggle("opacity-0", j !== idx);
    });
  };

  show(0);

  setInterval(() => {
    i = (i + 1) % slides.length;
    show(i);
  }, 6000);
})();

/* 6) Mobile sidebar drawer */
(() => {
  const drawer = document.querySelector("[data-drawer]");
  const backdrop = document.querySelector("[data-backdrop]");
  const openBtn = document.querySelector("[data-drawer-open]");
  const closeBtn = document.querySelector("[data-drawer-close]");
  if (!drawer || !backdrop || !openBtn) return;

  const FOCUSABLE =
    'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  let lastActive = null;

  const open = () => {
    lastActive = document.activeElement;
    document.body.style.overflow = "hidden";

    drawer.classList.remove("drawer-hidden");
    drawer.classList.add("drawer-visible");

    backdrop.classList.remove("backdrop-hidden");
    backdrop.classList.add("backdrop-visible");

    openBtn.setAttribute("aria-expanded", "true");
    backdrop.setAttribute("aria-hidden", "false");

    const first = drawer.querySelector(FOCUSABLE) || drawer;
    first.focus?.();
  };

  const close = () => {
    document.body.style.overflow = "";

    drawer.classList.add("drawer-hidden");
    drawer.classList.remove("drawer-visible");

    backdrop.classList.add("backdrop-hidden");
    backdrop.classList.remove("backdrop-visible");

    openBtn.setAttribute("aria-expanded", "false");
    backdrop.setAttribute("aria-hidden", "true");

    lastActive?.focus?.();
  };

  openBtn.addEventListener("click", open);
  backdrop.addEventListener("click", close);
  closeBtn?.addEventListener("click", close);

  drawer.addEventListener("click", (e) => {
    if (e.target.closest("a")) close();
  });

  window.addEventListener("keydown", (e) => {
    if (!drawer.classList.contains("drawer-visible")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });

  close();
})();
