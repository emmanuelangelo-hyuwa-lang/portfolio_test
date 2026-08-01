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
     NAV · one highlight pill that slides from the current page
     to whatever you are pointing at, and back again.
     ============================================================ */
  const navLinks = $("#nav-links");
  if (navLinks) {
    const indicator = document.createElement("span");
    indicator.className = "nav__indicator";
    indicator.setAttribute("aria-hidden", "true");
    navLinks.prepend(indicator);

    const current = () => navLinks.querySelector('a[aria-current="page"]');
    const wide = () => window.matchMedia("(min-width: 861px)").matches;

    const moveTo = (link) => {
      if (!wide()) return;
      if (!link) {
        indicator.classList.remove("nav__indicator--on");
        return;
      }
      indicator.style.width = `${link.offsetWidth}px`;
      indicator.style.transform = `translateX(${link.offsetLeft}px)`;
      indicator.classList.add("nav__indicator--on");
    };

    const home = () => moveTo(current());

    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("pointerenter", () => moveTo(link));
      link.addEventListener("focus", () => moveTo(link));
    });

    navLinks.addEventListener("pointerleave", home);
    navLinks.addEventListener("focusout", (e) => {
      if (!navLinks.contains(e.relatedTarget)) home();
    });

    // green flash while the pointer is held down
    navLinks.addEventListener("pointerdown", () => navLinks.classList.add("nav__links--pressed"));
    ["pointerup", "pointercancel", "pointerleave"].forEach((ev) =>
      navLinks.addEventListener(ev, () => navLinks.classList.remove("nav__links--pressed"))
    );

    // fonts change link widths, so place it once type has settled
    const place = () => requestAnimationFrame(home);
    place();
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(place);
    window.addEventListener("resize", place);
  }

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
      "building minerva connect",
      "web apps + chrome extensions",
      "CS & AI + physics @ minerva",
      "debugging code i didn't write",
      "supabase, python, vanilla js",
      "peer tutor @ schoolhouse.world",
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
        el.style.transitionDelay = `${Math.min(i++ * 45, 180)}ms`;
        el.classList.add("in");
        // clear the stagger delay once revealed so hover transitions stay snappy
        el.addEventListener("transitionend", () => (el.style.transitionDelay = ""), { once: true });
        revealObserver.unobserve(el);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );
  const observeReveals = () =>
    $$(".reveal:not(.in)").forEach((el) => revealObserver.observe(el));
  observeReveals();
  // blog pages inject their cards after fetching, so re-scan when they say so
  document.addEventListener("content:added", observeReveals);

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
     COPY ATTRIBUTION
     Copying a substantial passage quietly appends a credit line and
     a link back. Nothing is blocked: short copies, code, and anything
     you can select in a field are left exactly as they are, so the
     email address and snippets still paste clean.
     ============================================================ */
  const CREDIT_MIN_CHARS = 120;

  const inExemptRegion = (node) => {
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    return Boolean(
      el &&
        el.closest(
          "pre, code, input, textarea, [contenteditable], .footer, .nav, .contact__meta"
        )
    );
  };

  document.addEventListener("copy", (e) => {
    const sel = document.getSelection();
    if (!sel || sel.isCollapsed) return;

    const text = String(sel);
    // leave short copies alone: names, emails, a single line of a snippet
    if (text.trim().length < CREDIT_MIN_CHARS) return;
    // leave code and form fields alone: those get pasted somewhere it matters
    if (inExemptRegion(sel.anchorNode) || inExemptRegion(sel.focusNode)) return;
    if (!e.clipboardData) return;

    const url = document.querySelector('link[rel="canonical"]')?.href || location.href;
    const credit = `\n\n— Emmanuel Angelo-Hyuwa\n${url}`;

    // keep the rich-text flavour working as well as plain text
    const wrapper = document.createElement("div");
    wrapper.appendChild(sel.getRangeAt(0).cloneContents());
    const html =
      `${wrapper.innerHTML}<p>— Emmanuel Angelo-Hyuwa<br>` +
      `<a href="${url}">${url}</a></p>`;

    e.clipboardData.setData("text/plain", text + credit);
    e.clipboardData.setData("text/html", html);
    e.preventDefault();
  });

  /* ============================================================
     CONSOLE EASTER EGG
     ============================================================ */
  console.log(
    "%cEmmanuel Angelo-Hyuwa",
    "font-size:20px;font-weight:bold;color:#f4f4f4;font-family:Georgia,serif;font-style:italic;"
  );
  console.log(
    "%cHand-built. No frameworks, no dependencies, no build step.\nThe hero runs a live n-body simulation. → kunate0@gmail.com",
    "color:#a0a0a0;font-size:12px;"
  );

  /* ============================================================
     N-BODY GRAVITY · live simulation on the home hero.
     Particles orbit a drifting attractor; a fine pointer
     takes over as the attractor when it moves over the hero.
     ============================================================ */
  const simCanvas = $("#gravity");
  if (simCanvas && !reduceMotion) {
    const sctx = simCanvas.getContext("2d");
    const hero = simCanvas.parentElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const K = 14000; // attractor strength
    const SOFT = 9000; // gravity softening so close passes sling, not explode
    const VMAX = 4.5;
    let W = 0;
    let H = 0;

    const fit = () => {
      const r = hero.getBoundingClientRect();
      W = r.width;
      H = r.height;
      simCanvas.width = Math.floor(W * dpr);
      simCanvas.height = Math.floor(H * dpr);
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    window.addEventListener("resize", fit);

    const count = finePointer ? 150 : 80;
    const dots = [];
    const spawn = () => {
      const a = Math.random() * Math.PI * 2;
      const d = (0.08 + Math.random() * 0.4) * Math.min(W, H);
      const v = Math.sqrt((K * d) / (d * d + SOFT)) * (0.7 + Math.random() * 0.6);
      return {
        x: W / 2 + Math.cos(a) * d,
        y: H * 0.45 + Math.sin(a) * d,
        vx: -Math.sin(a) * v,
        vy: Math.cos(a) * v,
        r: 0.4 + Math.random() * 1.1,
        o: 0.15 + Math.random() * 0.55,
      };
    };
    for (let i = 0; i < count; i++) dots.push(spawn());

    let px = null;
    let py = null;
    let pointerAt = 0;
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      px = e.clientX - r.left;
      py = e.clientY - r.top;
      pointerAt = performance.now();
    });

    let ax = W / 2;
    let ay = H * 0.45;
    let rafId = null;

    const frame = (t) => {
      // attractor: cursor if fresh, otherwise a slow drifting point
      const tx = px !== null && t - pointerAt < 2500 ? px : W / 2 + Math.sin(t * 0.00021) * W * 0.16;
      const ty = px !== null && t - pointerAt < 2500 ? py : H * 0.45 + Math.cos(t * 0.00017) * H * 0.12;
      ax += (tx - ax) * 0.05;
      ay += (ty - ay) * 0.05;

      // fade previous frame's alpha for trails, keeping the canvas transparent
      sctx.globalCompositeOperation = "destination-in";
      sctx.fillStyle = "rgba(0, 0, 0, 0.9)";
      sctx.fillRect(0, 0, W, H);
      sctx.globalCompositeOperation = "source-over";

      for (const p of dots) {
        const dx = ax - p.x;
        const dy = ay - p.y;
        const d2 = dx * dx + dy * dy;
        const dist = Math.sqrt(d2) || 1;
        const acc = K / (d2 + SOFT);
        p.vx += (dx / dist) * acc;
        p.vy += (dy / dist) * acc;
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > VMAX) {
          p.vx = (p.vx / sp) * VMAX;
          p.vy = (p.vy / sp) * VMAX;
        }
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < -60 || p.x > W + 60 || p.y < -60 || p.y > H + 60) {
          Object.assign(p, spawn());
          continue;
        }
        sctx.beginPath();
        sctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        sctx.fillStyle = `rgba(244, 244, 244, ${p.o})`;
        sctx.fill();
      }
      rafId = requestAnimationFrame(frame);
    };

    // only simulate while the hero is on screen
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && rafId === null) {
        rafId = requestAnimationFrame(frame);
      } else if (!entry.isIntersecting && rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }).observe(hero);
  }

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
