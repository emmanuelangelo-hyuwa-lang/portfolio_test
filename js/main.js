/* Emmanuel Angelo-Hyuwa · main.js (vanilla, zero dependencies, shared by all pages) */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  /* ============================================================
     NAV · scrolled state + mobile menu
     ============================================================ */
  const nav = $("#nav");
  const burger = $("#nav-burger");

  function closeMenu() {
    if (!nav) return;
    nav.classList.remove("nav--open");
    burger?.setAttribute("aria-expanded", "false");
  }

  burger?.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = nav.classList.toggle("nav--open");
    burger.setAttribute("aria-expanded", String(open));
  });

  document.addEventListener("click", (e) => {
    if (nav?.classList.contains("nav--open") && !nav.contains(e.target)) closeMenu();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  /* ============================================================
     HERO · letter-by-letter title (home only)
     ============================================================ */
  $$("[data-split]").forEach((line) => {
    const text = line.textContent.trim();
    line.setAttribute("aria-label", text);
    line.textContent = "";
    [...text].forEach((chr, i) => {
      const s = document.createElement("span");
      s.className = "ch";
      s.setAttribute("aria-hidden", "true");
      s.textContent = chr === " " ? " " : chr;
      s.style.transitionDelay = `${0.15 + i * 0.04}s`;
      line.appendChild(s);
    });
  });
  requestAnimationFrame(() => document.body.classList.add("loaded"));

  /* rotating roles typewriter (home only) */
  const roleEl = $("#role-text");
  if (roleEl) {
    const roles = [
      "software engineer in the making",
      "physics + math, always",
      "olympiad medalist ×20+",
      "peer tutor @ schoolhouse.world",
      "chess player, dangerously unrated",
      "CS & AI + Physics @ Minerva",
    ];
    let roleIdx = 0;

    function typeRole() {
      const target = roles[roleIdx];
      let i = 0;
      (function type() {
        if (i <= target.length) {
          roleEl.textContent = target.slice(0, i++);
          setTimeout(type, 34 + Math.random() * 40);
        } else {
          setTimeout(erase, 2300);
        }
      })();
      function erase() {
        let j = target.length;
        (function del() {
          if (j >= 0) {
            roleEl.textContent = target.slice(0, j--);
            setTimeout(del, 16);
          } else {
            roleIdx = (roleIdx + 1) % roles.length;
            setTimeout(typeRole, 250);
          }
        })();
      }
    }

    if (reduceMotion) {
      roleEl.textContent = roles[0];
    } else {
      setTimeout(typeRole, 1100);
    }
  }

  /* ============================================================
     LIVE COUNTERS · age (born 13 Sep 2007, WAT) + Lagos clock
     ============================================================ */
  const BIRTH = new Date("2007-09-13T00:00:00+01:00").getTime();
  const YEAR_MS = 365.2425 * 24 * 60 * 60 * 1000;
  const ageEl = $("#age");
  const ageFooterEl = $("#age-footer");

  if (ageEl || ageFooterEl) {
    const tickAge = () => {
      const now = Date.now();
      if (ageEl) ageEl.textContent = ((now - BIRTH) / YEAR_MS).toFixed(9);
      if (ageFooterEl) ageFooterEl.textContent = Math.floor((now - BIRTH) / 1000).toLocaleString();
    };
    tickAge();
    setInterval(tickAge, 100);
  }

  const timeEl = $("#lagos-time");
  if (timeEl) {
    const tickClock = () => {
      timeEl.textContent = new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Lagos",
      }).format(new Date());
    };
    tickClock();
    setInterval(tickClock, 10_000);
  }

  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

  /* ============================================================
     MARQUEE · duplicate track for seamless loop (home only)
     ============================================================ */
  $$("[data-marquee]").forEach((t) => (t.innerHTML += t.innerHTML));

  /* ============================================================
     SCROLL · nav state + back-to-top
     ============================================================ */
  const toTop = $("#to-top");

  window.addEventListener(
    "scroll",
    () => {
      nav?.classList.toggle("nav--scrolled", scrollY > 40);
      toTop?.classList.toggle("to-top--show", scrollY > innerHeight * 0.8);
    },
    { passive: true }
  );

  toTop?.addEventListener("click", () => {
    scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  });

  /* ============================================================
     REVEALS · staggered, with transition-delay cleanup
     ============================================================ */
  const revealObserver = new IntersectionObserver(
    (entries) => {
      let i = 0;
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.style.transitionDelay = `${Math.min(i++ * 65, 320)}ms`;
        el.classList.add("in");
        // clear the stagger delay once revealed so hover transitions stay snappy
        el.addEventListener("transitionend", () => (el.style.transitionDelay = ""), { once: true });
        revealObserver.unobserve(el);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );
  $$(".reveal").forEach((el) => revealObserver.observe(el));

  /* animated counters */
  function animateCount(el) {
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    const prefix = el.dataset.prefix || "";
    const suffix = el.dataset.suffix || "";
    const dur = 1400;
    const start = performance.now();
    (function frame(t) {
      const p = Math.min((t - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      el.textContent = prefix + (target * eased).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(frame);
    })(start);
  }

  const countObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          countObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.6 }
  );
  $$("[data-count]").forEach((el) => countObserver.observe(el));

  /* score bars */
  const barObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.width = `${entry.target.dataset.bar}%`;
          barObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );
  $$("[data-bar]").forEach((el) => barObserver.observe(el));

  /* ============================================================
     CONSOLE EASTER EGG
     ============================================================ */
  console.log(
    "%c⚡ Emmanuel Angelo-Hyuwa",
    "font-size:20px;font-weight:bold;background:linear-gradient(90deg,#92a2ff,#5eead4);-webkit-background-clip:text;color:transparent;"
  );
  console.log(
    "%cHand-built. No frameworks, no dependencies, no build step.\n→ kunate0@gmail.com",
    "color:#9ba1b3;font-size:12px;"
  );

  if (reduceMotion || !finePointer) return; // everything below is decorative pointer motion

  /* ============================================================
     CARD SPOTLIGHT + PORTRAIT TILT
     ============================================================ */
  $$(".card-spot").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });

  $$("[data-tilt]").forEach((el) => {
    const max = parseFloat(el.dataset.tiltMax || "8");
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(800px) rotateY(${x * max}deg) rotateX(${-y * max}deg)`;
    });
    el.addEventListener("pointerleave", () => {
      el.style.transform = "";
    });
  });
})();
