/* Blog: merges natively written posts (blog/posts.json) with Substack posts
   (/api/substack, fetched and sanitised server-side) and renders both in this
   site's own styling. No iframes, no embeds, no Substack CSS.

   Markdown for native posts is rendered by the small parser below so the site
   keeps its no-dependency, no-build-step rule. */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);

  /* ---------------- markdown (native posts) ---------------- */
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

  /* ------------- html -> markdown (for downloading Substack posts) -------- */
  function htmlToMarkdown(html) {
    let s = String(html || "");
    s = s.replace(/<pre>\s*<code>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_, c) => `\n\n\`\`\`\n${decode(c)}\n\`\`\`\n\n`);
    s = s.replace(/<pre>([\s\S]*?)<\/pre>/gi, (_, c) => `\n\n\`\`\`\n${decode(c)}\n\`\`\`\n\n`);
    s = s.replace(/<code>([\s\S]*?)<\/code>/gi, (_, c) => `\`${decode(c)}\``);
    s = s.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `\n\n${"#".repeat(+n)} ${strip(t)}\n\n`);
    s = s.replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, (_, t) => `\n\n> ${strip(t)}\n\n`);
    s = s.replace(/<li>([\s\S]*?)<\/li>/gi, (_, t) => `- ${strip(t)}\n`);
    s = s.replace(/<\/?(ul|ol)>/gi, "\n");
    s = s.replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*>/gi, (_, a, src) => `\n\n![${a}](${src})\n\n`);
    s = s.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, (_, src) => `\n\n![](${src})\n\n`);
    s = s.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, h, t) => `[${strip(t)}](${h})`);
    s = s.replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, (_, __, t) => `**${strip(t)}**`);
    s = s.replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, (_, __, t) => `*${strip(t)}*`);
    s = s.replace(/<hr\s*\/?>/gi, "\n\n---\n\n");
    s = s.replace(/<br\s*\/?>/gi, "\n");
    s = s.replace(/<\/p>/gi, "\n\n");
    return decode(s.replace(/<[^>]*>/g, "")).replace(/\n{3,}/g, "\n\n").trim();
  }
  const strip = (h) => decode(String(h).replace(/<[^>]*>/g, "")).trim();
  function decode(s) {
    const el = document.createElement("textarea");
    el.innerHTML = String(s);
    return el.value;
  }

  /* ---------------- helpers ---------------- */
  const fmtDate = (iso) => {
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  };

  const normTitle = (t) =>
    String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

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

  function download(name, text) {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* The blog lives on blog.hyuwa.dev, where posts are /:slug. On the main site
     they are /p/:slug, which Vercel 301s to the subdomain. Canonicals always
     point at the subdomain so each post has exactly one indexable URL. */
  const BLOG_HOST = "blog.hyuwa.dev";
  const onBlogHost = () => location.hostname === BLOG_HOST;
  const postUrl = (slug) =>
    onBlogHost() ? `/${encodeURIComponent(slug)}` : `/p/${encodeURIComponent(slug)}`;
  const canonicalFor = (slug) => `https://${BLOG_HOST}/${encodeURIComponent(slug)}`;

  function toMarkdownFile(post) {
    const body = post.source === "substack" ? htmlToMarkdown(post.html) : post.markdown;
    const fm = [
      "---",
      `title: ${post.title}`,
      `date: ${post.date}`,
      post.summary ? `summary: ${post.summary}` : null,
      post.tags && post.tags.length ? `tags: [${post.tags.join(", ")}]` : null,
      `source: ${canonicalFor(post.slug)}`,
      post.link ? `original: ${post.link}` : null,
      "---",
      "",
    ]
      .filter(Boolean)
      .join("\n");
    return fm + String(body || "").trim() + "\n";
  }

  /* ---------------- loading + merging ---------------- */
  let aliases = new Map(); // old native slug -> canonical slug

  async function loadAll() {
    const [nativeRes, subRes] = await Promise.allSettled([
      fetch("/blog/posts.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : { posts: [] })),
      fetch("/api/substack", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : { posts: [] })),
    ]);

    const native = (nativeRes.status === "fulfilled" ? nativeRes.value.posts || [] : []).map((p) => ({
      ...p,
      source: "native",
    }));
    const substack = subRes.status === "fulfilled" ? subRes.value.posts || [] : [];

    // Where the same piece exists in both places, Substack wins: it is the
    // published original. The native slug is kept as an alias so any link
    // shared before the move still resolves.
    aliases = new Map();
    const subByTitle = new Map(substack.map((p) => [normTitle(p.title), p]));
    const kept = native.filter((p) => {
      const match = subByTitle.get(normTitle(p.title));
      if (match) {
        aliases.set(p.slug, match.slug);
        return false;
      }
      return true;
    });

    return [...substack, ...kept].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  /* ---------------- index ---------------- */
  async function renderIndex(mount) {
    let posts;
    try {
      posts = await loadAll();
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
      <a class="post-card glass card-spot reveal" href="${postUrl(p.slug)}">
        <span class="post-card__meta mono">
          <span>${esc(fmtDate(p.date))}</span>
          <span aria-hidden="true">·</span>
          <span>${esc(String(p.readingMinutes || 1))} min read</span>
          ${p.source === "substack" ? '<span class="tag tag--substack">Substack</span>' : ""}
          ${(p.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}
        </span>
        <h2>${esc(p.title)}</h2>
        <p>${esc(p.summary || "")}</p>
        <span class="post-card__go">Read it <i aria-hidden="true">→</i></span>
      </a>`
      )
      .join("");

    document.dispatchEvent(new CustomEvent("content:added"));
  }

  /* ---------------- single post ---------------- */
  function currentSlug() {
    const q = new URLSearchParams(location.search).get("slug");
    if (q) return q;
    // matches /:slug on the blog host and /p/:slug on the main site
    const m = /^\/(?:p\/)?([^/?#]+)\/?$/.exec(location.pathname);
    if (m && !/\.html?$/i.test(m[1])) return decodeURIComponent(m[1]);
    return null;
  }

  async function renderPost(mount) {
    const wanted = currentSlug();
    if (!wanted) {
      mount.innerHTML = `<div class="blog-empty glass">No post specified. <a href="blog.html" style="color:inherit">Back to the blog</a>.</div>`;
      return;
    }

    let posts;
    try {
      posts = await loadAll();
    } catch (e) {
      mount.innerHTML = `<div class="blog-empty glass">Could not load this post. ${esc(e.message)}</div>`;
      return;
    }

    let post = posts.find((p) => p.slug === wanted);
    if (!post && aliases.has(wanted)) {
      const canonical = aliases.get(wanted);
      post = posts.find((p) => p.slug === canonical);
      if (post) history.replaceState(null, "", postUrl(canonical));
    }
    if (!post) {
      mount.innerHTML = `<div class="blog-empty glass">That post does not exist. <a href="blog.html" style="color:inherit">Back to the blog</a>.</div>`;
      return;
    }

    const canonicalUrl = canonicalFor(post.slug);
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

    const bodyHtml =
      post.source === "substack" ? post.html : renderMarkdown(post.markdown);

    const teaserNote =
      post.source === "substack" && !post.hasFullContent
        ? `<div class="readon glass">
             <p>This one is only partly in the feed.</p>
             <a class="btn btn--primary btn--small" href="${post.link}" target="_blank" rel="noopener">Continue reading on Substack ↗</a>
           </div>`
        : "";

    const footerNote =
      post.source === "substack"
        ? `<div class="readon readon--foot">
             <span class="mono">Originally published on Substack</span>
             <a class="btn btn--ghost btn--small" href="${post.link}" target="_blank" rel="noopener">Read on Substack ↗</a>
           </div>`
        : "";

    mount.innerHTML = `
      <article class="article">
        <p class="article__meta mono">
          <span>${esc(fmtDate(post.date))}</span>
          <span aria-hidden="true">·</span>
          <span>${esc(String(post.readingMinutes || 1))} min read</span>
          ${post.source === "substack" ? '<span class="tag tag--substack">Substack</span>' : ""}
          ${(post.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}
        </p>
        <h1 class="article__title">${esc(post.title)}</h1>
        ${post.summary ? `<p class="article__summary">${esc(post.summary)}</p>` : ""}
        <div class="article__tools">
          <button class="btn btn--ghost btn--small" id="dl" type="button">Download as Markdown</button>
          <button class="btn btn--ghost btn--small" id="share" type="button">Share this post</button>
        </div>
        ${teaserNote}
        <div class="article__body">${bodyHtml}</div>
        ${footerNote}
      </article>`;

    $("#dl").addEventListener("click", () => {
      download(`${post.slug}.md`, toMarkdownFile(post));
      toast("Markdown downloaded");
    });

    $("#share").addEventListener("click", async () => {
      const url = canonicalFor(post.slug);
      if (navigator.share) {
        try {
          await navigator.share({ title: post.title, text: post.summary || post.title, url });
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
