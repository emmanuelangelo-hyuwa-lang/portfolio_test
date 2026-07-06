/* Emmanuel Angelo-Hyuwa — main.js (vanilla, zero dependencies) */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- live age (born 13 Sep 2007, WAT) ---------- */
  const BIRTH = new Date("2007-09-13T00:00:00+01:00").getTime();
  const YEAR_MS = 365.2425 * 24 * 60 * 60 * 1000;
  const ageEl = document.getElementById("age");
  const ageFooterEl = document.getElementById("age-footer");

  function tickAge() {
    const now = Date.now();
    if (ageEl) ageEl.textContent = ((now - BIRTH) / YEAR_MS).toFixed(9);
    if (ageFooterEl) ageFooterEl.textContent = Math.floor((now - BIRTH) / 1000).toLocaleString();
    requestAnimationFrame(tickAge);
  }
  tickAge();

  /* ---------- Lagos clock ---------- */
  const timeEl = document.getElementById("lagos-time");
  function tickClock() {
    if (timeEl) {
      timeEl.textContent = new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Lagos",
      }).format(new Date());
    }
  }
  tickClock();
  setInterval(tickClock, 10_000);

  document.getElementById("year").textContent = new Date().getFullYear();

  /* ---------- marquee: duplicate track for seamless loop ---------- */
  const track = document.getElementById("marquee-track");
  if (track) track.innerHTML += track.innerHTML;

  /* ---------- scroll reveals ---------- */
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          entry.target.style.transitionDelay = `${Math.min(i * 70, 350)}ms`;
          entry.target.classList.add("in");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );
  document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

  /* ---------- animated counters ---------- */
  function animateCount(el) {
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    const prefix = el.dataset.prefix || "";
    const suffix = el.dataset.suffix || "";
    const dur = 1400;
    const start = performance.now();

    function frame(t) {
      const p = Math.min((t - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      el.textContent = prefix + (target * eased).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
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
  document.querySelectorAll("[data-count]").forEach((el) => countObserver.observe(el));

  /* ---------- nav: scrolled state + active section ---------- */
  const nav = document.getElementById("nav");
  window.addEventListener(
    "scroll",
    () => nav.classList.toggle("nav--scrolled", window.scrollY > 40),
    { passive: true }
  );

  const navLinks = [...document.querySelectorAll("[data-nav]")];
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          navLinks.forEach((a) =>
            a.classList.toggle("active", a.getAttribute("href") === `#${entry.target.id}`)
          );
        }
      });
    },
    { rootMargin: "-40% 0px -55% 0px" }
  );
  document.querySelectorAll("section[id], header[id]").forEach((s) => sectionObserver.observe(s));

  if (reduceMotion) return; // everything below is decorative motion

  /* ---------- cursor glow ---------- */
  const glow = document.querySelector(".cursor-glow");
  let gx = innerWidth / 2, gy = innerHeight / 2, tx = gx, ty = gy;
  window.addEventListener("pointermove", (e) => {
    tx = e.clientX;
    ty = e.clientY;
    glow.style.opacity = "1";
  });
  (function lerpGlow() {
    gx += (tx - gx) * 0.08;
    gy += (ty - gy) * 0.08;
    glow.style.left = `${gx}px`;
    glow.style.top = `${gy}px`;
    requestAnimationFrame(lerpGlow);
  })();

  /* ---------- per-card spotlight ---------- */
  document.querySelectorAll(".card-spot").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });

  /* ---------- portrait tilt ---------- */
  const tilt = document.querySelector("[data-tilt]");
  if (tilt) {
    tilt.addEventListener("pointermove", (e) => {
      const r = tilt.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      tilt.style.transform = `perspective(800px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`;
    });
    tilt.addEventListener("pointerleave", () => {
      tilt.style.transform = "perspective(800px) rotateY(0deg) rotateX(0deg)";
    });
  }

  /* ---------- magnetic buttons ---------- */
  document.querySelectorAll(".magnetic").forEach((btn) => {
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      btn.style.transform = `translate(${x * 0.18}px, ${y * 0.28}px)`;
    });
    btn.addEventListener("pointerleave", () => {
      btn.style.transform = "";
    });
  });

  /* ---------- console easter egg ---------- */
  console.log(
    "%c⚡ Emmanuel Angelo-Hyuwa",
    "font-size:20px;font-weight:bold;background:linear-gradient(90deg,#8b9cff,#5eead4);-webkit-background-clip:text;color:transparent;"
  );
  console.log(
    "%cHand-built. No frameworks, no dependencies — view source, it's all there.\n→ kunate0@gmail.com",
    "color:#9ba1b3;font-size:12px;"
  );
})();
