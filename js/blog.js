/* Blog: loads blog/posts.json, renders the index or a single post.
   Markdown is rendered by the small parser below so the site keeps its
   no-dependency, no-build-step rule. Everything is escaped before any
   markup is added. */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);

  /* ---------------- markdown ---------------- */
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  const inline = (s) =>
    s
      .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => `<img src="${src}" alt="${alt}" loading="lazy" />`)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, h) => {
        const external = /^https?:/i.test(h);
        return `<a href="${h}"${external ? ' target="_blank" rel="noopener"' : ""}>${t}</a>`;
      })
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");

  const BLOCK_START = /^(```|#{1,4}\s|>|\s*[-*+]\s|\s*\d+[.)]\s|-{3,}\s*$)/;

  function renderMarkdown(md) {
    const lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (/^```/.test(line)) {
        const buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
        i++;
        out.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`);
        continue;
      }

      const h = /^(#{1,4})\s+(.*)$/.exec(line);
      if (h) {
        const level = Math.min(h[1].length + 1, 4);
        out.push(`<h${level}>${inline(esc(h[2]))}</h${level}>`);
        i++;
        continue;
      }

      if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
        out.push("<hr />");
        i++;
        continue;
      }

      if (/^>\s?/.test(line)) {
        const buf = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
        out.push(`<blockquote>${inline(esc(buf.join(" ")))}</blockquote>`);
        continue;
      }

      if (/^\s*[-*+]\s+/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) buf.push(lines[i++].replace(/^\s*[-*+]\s+/, ""));
        out.push(`<ul>${buf.map((b) => `<li>${inline(esc(b))}</li>`).join("")}</ul>`);
        continue;
      }

      if (/^\s*\d+[.)]\s+/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) buf.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ""));
        out.push(`<ol>${buf.map((b) => `<li>${inline(esc(b))}</li>`).join("")}</ol>`);
        continue;
      }

      if (!line.trim()) {
        i++;
        continue;
      }

      const buf = [];
      while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i])) buf.push(lines[i++]);
      out.push(`<p>${inline(esc(buf.join(" ")))}</p>`);
    }

    return out.join("\n");
  }

  window.renderMarkdown = renderMarkdown;

  /* ---------------- helpers ---------------- */
  const fmtDate = (iso) => {
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  };

  let toastTimer;
  function toast(message) {
    let el = $(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = message;
    requestAnimationFrame(() => el.classList.add("toast--on"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("toast--on"), 2400);
  }
  window.blogToast = toast;

  function download(name, text, type) {
    const blob = new Blob([text], { type: type || "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function toMarkdownFile(post) {
    const fm = [
      "---",
      `title: ${post.title}`,
      `date: ${post.date}`,
      post.summary ? `summary: ${post.summary}` : null,
      post.tags && post.tags.length ? `tags: [${post.tags.join(", ")}]` : null,
      `source: ${location.origin}/post.html?slug=${post.slug}`,
      "---",
      "",
    ]
      .filter(Boolean)
      .join("\n");
    return fm + post.markdown.trim() + "\n";
  }

  async function loadPosts() {
    const res = await fetch("blog/posts.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`Could not load posts (${res.status})`);
    const data = await res.json();
    const posts = Array.isArray(data.posts) ? data.posts : [];
    return posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  /* ---------------- index ---------------- */
  async function renderIndex(mount) {
    let posts;
    try {
      posts = await loadPosts();
    } catch (e) {
      mount.innerHTML = `<div class="blog-empty glass">Could not load posts. ${esc(e.message)}</div>`;
      return;
    }

    if (!posts.length) {
      mount.innerHTML = `<div class="blog-empty glass">Nothing written yet. Come back soon.</div>`;
      return;
    }

    mount.innerHTML = posts
      .map(
        (p) => `
      <a class="post-card glass card-spot reveal" href="post.html?slug=${encodeURIComponent(p.slug)}">
        <span class="post-card__meta mono">
          <span>${esc(fmtDate(p.date))}</span>
          <span aria-hidden="true">·</span>
          <span>${esc(String(p.readingMinutes || 1))} min read</span>
          ${(p.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}
        </span>
        <h2>${esc(p.title)}</h2>
        <p>${esc(p.summary || "")}</p>
        <span class="post-card__go">Read it <i aria-hidden="true">→</i></span>
      </a>`
      )
      .join("");

    // let the shared reveal observer pick these up
    document.dispatchEvent(new CustomEvent("content:added"));
  }

  /* ---------------- single post ---------------- */
  async function renderPost(mount) {
    const slug = new URLSearchParams(location.search).get("slug");
    if (!slug) {
      mount.innerHTML = `<div class="blog-empty glass">No post specified. <a href="blog.html" style="color:inherit">Back to the blog</a>.</div>`;
      return;
    }

    let posts;
    try {
      posts = await loadPosts();
    } catch (e) {
      mount.innerHTML = `<div class="blog-empty glass">Could not load this post. ${esc(e.message)}</div>`;
      return;
    }

    const post = posts.find((p) => p.slug === slug);
    if (!post) {
      mount.innerHTML = `<div class="blog-empty glass">That post does not exist. <a href="blog.html" style="color:inherit">Back to the blog</a>.</div>`;
      return;
    }

    /* Point every bit of page metadata at this specific post. Search crawlers
       run JS and will pick this up; the social scrapers do not, so shared links
       still fall back to the site-wide card. */
    const canonicalUrl = `https://www.hyuwa.dev/post.html?slug=${encodeURIComponent(post.slug)}`;
    document.title = `${post.title} · Emmanuel Angelo-Hyuwa`;

    const setMeta = (selector, value) => {
      const el = document.querySelector(selector);
      if (el && value) el.setAttribute("content", value);
    };
    setMeta('meta[name="description"]', post.summary);
    setMeta('meta[property="og:title"]', `${post.title} · Emmanuel Angelo-Hyuwa`);
    setMeta('meta[property="og:description"]', post.summary);
    setMeta('meta[name="twitter:title"]', `${post.title} · Emmanuel Angelo-Hyuwa`);
    setMeta('meta[name="twitter:description"]', post.summary);

    let ogUrl = document.querySelector('meta[property="og:url"]');
    if (!ogUrl) {
      ogUrl = document.createElement("meta");
      ogUrl.setAttribute("property", "og:url");
      document.head.appendChild(ogUrl);
    }
    ogUrl.setAttribute("content", canonicalUrl);

    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute("href", canonicalUrl);

    // article-level structured data for this post
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.summary || "",
      datePublished: post.date,
      dateModified: (post.updated || "").slice(0, 10) || post.date,
      keywords: (post.tags || []).join(", "),
      inLanguage: "en",
      mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
      url: canonicalUrl,
      author: {
        "@type": "Person",
        "@id": "https://www.hyuwa.dev/#person",
        name: "Emmanuel Kunat Angelo-Hyuwa",
        url: "https://www.hyuwa.dev/",
      },
    });
    document.head.appendChild(ld);

    mount.innerHTML = `
      <article class="article">
        <p class="article__meta mono">
          <span>${esc(fmtDate(post.date))}</span>
          <span aria-hidden="true">·</span>
          <span>${esc(String(post.readingMinutes || 1))} min read</span>
          ${(post.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}
        </p>
        <h1 class="article__title">${esc(post.title)}</h1>
        ${post.summary ? `<p class="article__summary">${esc(post.summary)}</p>` : ""}
        <div class="article__tools">
          <button class="btn btn--ghost btn--small" id="dl" type="button">Download as Markdown</button>
          <button class="btn btn--ghost btn--small" id="share" type="button">Share this post</button>
        </div>
        <div class="article__body">${renderMarkdown(post.markdown)}</div>
      </article>`;

    $("#dl").addEventListener("click", () => {
      download(`${post.slug}.md`, toMarkdownFile(post));
      toast("Markdown downloaded");
    });

    $("#share").addEventListener("click", async () => {
      const url = `${location.origin}${location.pathname}?slug=${encodeURIComponent(post.slug)}`;
      const payload = { title: post.title, text: post.summary || post.title, url };
      if (navigator.share) {
        try {
          await navigator.share(payload);
          return;
        } catch (e) {
          if (e && e.name === "AbortError") return;
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        toast("Link copied to clipboard");
      } catch (e) {
        toast(url);
      }
    });

    document.dispatchEvent(new CustomEvent("content:added"));
  }

  /* ---------------- boot ---------------- */
  const index = $("#blog-index");
  const single = $("#blog-post");
  if (index) renderIndex(index);
  if (single) renderPost(single);
})();
