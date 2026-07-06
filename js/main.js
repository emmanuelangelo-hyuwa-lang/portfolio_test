/* Emmanuel Angelo-Hyuwa · main.js (vanilla, zero dependencies) */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;

  /* ============================================================
     SOUND ENGINE · everything synthesised live in WebAudio
     ============================================================ */
  const Sound = (() => {
    let ctx = null;
    let master = null;
    let enabled = localStorage.getItem("sound") !== "off";
    let lastHover = 0;

    function ensure() {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = 0.5;
        master.connect(ctx.destination);
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }

    function tone({ freq = 800, end = freq, dur = 0.08, gain = 0.05, type = "sine", delay = 0 }) {
      if (!enabled || !ctx) return;
      const t = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(end, 1), t + dur);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }

    return {
      get enabled() {
        return enabled;
      },
      toggle() {
        enabled = !enabled;
        localStorage.setItem("sound", enabled ? "on" : "off");
        if (enabled) {
          ensure();
          tone({ freq: 520, end: 1040, dur: 0.14, gain: 0.06, type: "sine" });
        }
        return enabled;
      },
      unlock() {
        if (enabled) ensure();
      },
      hover() {
        const now = performance.now();
        if (now - lastHover < 70) return;
        lastHover = now;
        tone({ freq: 2300, end: 2600, dur: 0.045, gain: 0.018, type: "sine" });
      },
      click() {
        tone({ freq: 620, end: 210, dur: 0.09, gain: 0.06, type: "triangle" });
        tone({ freq: 1500, end: 1500, dur: 0.03, gain: 0.02, type: "square", delay: 0.005 });
      },
      whoosh() {
        tone({ freq: 260, end: 720, dur: 0.22, gain: 0.028, type: "sine" });
      },
      chime() {
        tone({ freq: 880, dur: 0.35, gain: 0.035, type: "sine" });
        tone({ freq: 1318.5, dur: 0.4, gain: 0.025, type: "sine", delay: 0.09 });
        tone({ freq: 1760, dur: 0.5, gain: 0.018, type: "sine", delay: 0.18 });
      },
    };
  })();

  // audio can only start after a user gesture
  ["pointerdown", "keydown", "touchstart"].forEach((ev) =>
    window.addEventListener(ev, () => Sound.unlock(), { once: true, passive: true })
  );

  const soundBtn = document.getElementById("sound-toggle");
  soundBtn.classList.toggle("sound-toggle--muted", !Sound.enabled);
  soundBtn.addEventListener("click", () => {
    const on = Sound.toggle();
    soundBtn.classList.toggle("sound-toggle--muted", !on);
  });

  document.querySelectorAll("a, button, .tag").forEach((el) => {
    el.addEventListener("pointerenter", () => Sound.hover());
  });
  document.querySelectorAll("a, button").forEach((el) => {
    el.addEventListener("pointerdown", () => Sound.click());
  });

  /* ============================================================
     PRELOADER
     ============================================================ */
  const preloader = document.getElementById("preloader");
  const pctEl = document.getElementById("preloader-pct");
  const fillEl = document.getElementById("preloader-fill");

  (function boot() {
    let p = 0;
    const start = performance.now();
    function step(t) {
      const elapsed = t - start;
      p = Math.min(100, (elapsed / 1100) * 100);
      pctEl.textContent = `${Math.floor(p)}%`;
      fillEl.style.width = `${p}%`;
      if (p < 100) {
        requestAnimationFrame(step);
      } else {
        preloader.classList.add("preloader--done");
        document.body.classList.add("loaded");
        Sound.chime();
        setTimeout(() => preloader.remove(), 800);
      }
    }
    requestAnimationFrame(step);
  })();

  /* ============================================================
     HERO · letter-by-letter title
     ============================================================ */
  document.querySelectorAll("[data-split]").forEach((line) => {
    const text = line.textContent;
    line.textContent = "";
    [...text].forEach((chr, i) => {
      const s = document.createElement("span");
      s.className = "ch";
      s.textContent = chr === " " ? " " : chr;
      s.style.transitionDelay = `${0.55 + i * 0.045}s`;
      line.appendChild(s);
    });
  });

  /* ---------- rotating roles typewriter ---------- */
  const roles = [
    "software engineer in the making",
    "physics + math, always",
    "olympiad medalist ×20+",
    "peer tutor @ schoolhouse.world",
    "chess player, dangerously unrated",
    "CS & AI + Physics @ Minerva",
  ];
  const roleEl = document.getElementById("role-text");
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
    setTimeout(typeRole, 1600);
  }

  /* ============================================================
     LIVE COUNTERS · age (born 13 Sep 2007, WAT) + Lagos clock
     ============================================================ */
  const BIRTH = new Date("2007-09-13T00:00:00+01:00").getTime();
  const YEAR_MS = 365.2425 * 24 * 60 * 60 * 1000;
  const ageEl = document.getElementById("age");
  const ageFooterEl = document.getElementById("age-footer");

  (function tickAge() {
    const now = Date.now();
    if (ageEl) ageEl.textContent = ((now - BIRTH) / YEAR_MS).toFixed(9);
    if (ageFooterEl) ageFooterEl.textContent = Math.floor((now - BIRTH) / 1000).toLocaleString();
    requestAnimationFrame(tickAge);
  })();

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

  /* ============================================================
     MARQUEES · duplicate tracks for seamless loop
     ============================================================ */
  document.querySelectorAll("[data-marquee]").forEach((t) => (t.innerHTML += t.innerHTML));

  /* ============================================================
     SCROLL · progress bar, nav state, reveals, counters, bars
     ============================================================ */
  const progressFill = document.getElementById("progress-fill");
  const nav = document.getElementById("nav");
  const toTop = document.getElementById("to-top");

  window.addEventListener(
    "scroll",
    () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      progressFill.style.width = `${(scrollY / max) * 100}%`;
      nav.classList.toggle("nav--scrolled", scrollY > 40);
      toTop.classList.toggle("to-top--show", scrollY > innerHeight * 0.8);
    },
    { passive: true }
  );

  toTop.addEventListener("click", () => {
    Sound.whoosh();
    scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  });

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          entry.target.style.transitionDelay = `${Math.min(i * 60, 320)}ms`;
          entry.target.classList.add("in");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );
  document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

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
  document.querySelectorAll("[data-count]").forEach((el) => countObserver.observe(el));

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
  document.querySelectorAll("[data-bar]").forEach((el) => barObserver.observe(el));

  /* nav active section */
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

  /* ============================================================
     CONSOLE EASTER EGG
     ============================================================ */
  console.log(
    "%c⚡ Emmanuel Angelo-Hyuwa",
    "font-size:20px;font-weight:bold;background:linear-gradient(90deg,#8b9cff,#5eead4);-webkit-background-clip:text;color:transparent;"
  );
  console.log(
    "%cHand-built. No frameworks, no dependencies. Even the sounds are synthesised in WebAudio.\n→ kunate0@gmail.com",
    "color:#9ba1b3;font-size:12px;"
  );

  if (reduceMotion) return; // everything below is decorative motion

  /* ============================================================
     STARFIELD
     ============================================================ */
  const canvas = document.getElementById("stars");
  const cx2d = canvas.getContext("2d");
  let stars = [];
  let W, H;

  function resizeStars() {
    W = canvas.width = innerWidth * devicePixelRatio;
    H = canvas.height = innerHeight * devicePixelRatio;
    const n = Math.min(160, Math.floor((innerWidth * innerHeight) / 9000));
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: (Math.random() * 1.1 + 0.3) * devicePixelRatio,
      tw: Math.random() * Math.PI * 2,
      sp: 0.4 + Math.random() * 1.2,
      depth: 0.3 + Math.random() * 0.7,
    }));
  }
  resizeStars();
  window.addEventListener("resize", resizeStars);

  let mouseX = 0.5, mouseY = 0.5;
  window.addEventListener("pointermove", (e) => {
    mouseX = e.clientX / innerWidth - 0.5;
    mouseY = e.clientY / innerHeight - 0.5;
  });

  (function drawStars(t) {
    cx2d.clearRect(0, 0, W, H);
    for (const s of stars) {
      const a = 0.25 + 0.55 * Math.abs(Math.sin(s.tw + t * 0.0006 * s.sp));
      const px = s.x - mouseX * 28 * s.depth * devicePixelRatio;
      const py = s.y - mouseY * 28 * s.depth * devicePixelRatio;
      cx2d.beginPath();
      cx2d.arc(px, py, s.r, 0, Math.PI * 2);
      cx2d.fillStyle = `rgba(200, 210, 255, ${a})`;
      cx2d.fill();
    }
    requestAnimationFrame(drawStars);
  })(0);

  /* ============================================================
     CURSOR · dot + trailing ring + big glow
     ============================================================ */
  const glow = document.querySelector(".cursor-glow");
  const dot = document.getElementById("cursor-dot");
  const ring = document.getElementById("cursor-ring");

  if (finePointer) {
    document.body.classList.add("custom-cursor");
    let tx = innerWidth / 2, ty = innerHeight / 2;
    let rx = tx, ry = ty, gx = tx, gy = ty;

    window.addEventListener("pointermove", (e) => {
      tx = e.clientX;
      ty = e.clientY;
      dot.style.opacity = ring.style.opacity = "1";
      glow.style.opacity = "1";
      dot.style.left = `${tx}px`;
      dot.style.top = `${ty}px`;
    });

    (function lerpCursor() {
      rx += (tx - rx) * 0.18;
      ry += (ty - ry) * 0.18;
      gx += (tx - gx) * 0.07;
      gy += (ty - gy) * 0.07;
      ring.style.left = `${rx}px`;
      ring.style.top = `${ry}px`;
      glow.style.left = `${gx}px`;
      glow.style.top = `${gy}px`;
      requestAnimationFrame(lerpCursor);
    })();

    document.querySelectorAll("a, button, .tag, .card-spot").forEach((el) => {
      el.addEventListener("pointerenter", () => ring.classList.add("cursor-ring--hover"));
      el.addEventListener("pointerleave", () => ring.classList.remove("cursor-ring--hover"));
    });
    window.addEventListener("pointerdown", () => ring.classList.add("cursor-ring--down"));
    window.addEventListener("pointerup", () => ring.classList.remove("cursor-ring--down"));
  } else {
    window.addEventListener("pointermove", (e) => {
      glow.style.opacity = "1";
      glow.style.left = `${e.clientX}px`;
      glow.style.top = `${e.clientY}px`;
    });
  }

  /* ============================================================
     CARD SPOTLIGHT + TILT + MAGNETIC
     ============================================================ */
  document.querySelectorAll(".card-spot").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });

  document.querySelectorAll("[data-tilt]").forEach((el) => {
    const max = parseFloat(el.dataset.tiltMax || "8");
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(800px) rotateY(${x * max}deg) rotateX(${-y * max}deg) translateY(-3px)`;
    });
    el.addEventListener("pointerleave", () => {
      el.style.transform = "";
    });
  });

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
})();
