/* Studio: write and publish blog posts.
 *
 * There is deliberately no passkey in this file. The key is verified by
 * /api/publish, which runs on the server and compares against an environment
 * variable. Reading this source tells you nothing that helps you publish.
 *
 * The key is held in sessionStorage only, so it is gone when the tab closes.
 */
(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const KEY_STORE = "studio-key";

  const gate = $("#gate");
  const gateForm = $("#gate-form");
  const gateInput = $("#gate-key");
  const gateMsg = $("#gate-msg");
  const desk = $("#desk");

  const title = $("#f-title");
  const slug = $("#f-slug");
  const date = $("#f-date");
  const summary = $("#f-summary");
  const tags = $("#f-tags");
  const bodyIn = $("#f-body");
  const preview = $("#preview");
  const status = $("#status");

  let canPublish = false;

  const slugify = (s) =>
    String(s)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80);

  const say = (msg, tone) => {
    status.textContent = msg;
    status.dataset.tone = tone || "";
  };

  const collect = () => ({
    title: title.value.trim(),
    slug: slug.value.trim() || slugify(title.value),
    date: date.value || new Date().toISOString().slice(0, 10),
    summary: summary.value.trim(),
    tags: tags.value.split(",").map((t) => t.trim()).filter(Boolean),
    markdown: bodyIn.value,
  });

  const api = async (payload) => {
    const res = await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, key: sessionStorage.getItem(KEY_STORE) || "" }),
    });
    let data = {};
    try {
      data = await res.json();
    } catch (e) {
      throw new Error(`Server returned ${res.status} and not JSON. Is /api deployed?`);
    }
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  };

  /* ---------------- gate ---------------- */
  const unlock = (info) => {
    canPublish = Boolean(info && info.canPublish);
    gate.hidden = true;
    desk.hidden = false;
    date.value = date.value || new Date().toISOString().slice(0, 10);
    const publishBtn = $("#publish");
    if (!canPublish) {
      publishBtn.disabled = true;
      publishBtn.title = "GITHUB_TOKEN is not set on this deployment";
      say("Unlocked. Publishing is off because GITHUB_TOKEN is not set, but Export works.", "warn");
    } else {
      say(`Unlocked. Publishing to ${info.repo} on ${info.branch}.`, "ok");
    }
    title.focus();
    draw();
  };

  gateForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const key = gateInput.value.trim();
    if (!key) return;
    gateMsg.textContent = "Checking…";
    sessionStorage.setItem(KEY_STORE, key);
    try {
      const info = await api({ action: "verify" });
      gateMsg.textContent = "";
      unlock(info);
    } catch (err) {
      sessionStorage.removeItem(KEY_STORE);
      gateMsg.textContent = err.message;
    }
  });

  // already unlocked in this tab?
  if (sessionStorage.getItem(KEY_STORE)) {
    api({ action: "verify" })
      .then(unlock)
      .catch(() => sessionStorage.removeItem(KEY_STORE));
  }

  /* ---------------- live preview ---------------- */
  const draw = () => {
    const p = collect();
    if (!slug.value) slug.placeholder = slugify(p.title) || "auto-from-title";
    preview.innerHTML =
      (p.title ? `<h1 class="article__title">${p.title.replace(/[<>&]/g, "")}</h1>` : "") +
      (typeof window.renderMarkdown === "function"
        ? window.renderMarkdown(p.markdown)
        : "<p>markdown renderer missing</p>");
  };

  [title, slug, date, summary, tags, bodyIn].forEach((el) => el && el.addEventListener("input", draw));

  /* ---------------- actions ---------------- */
  $("#publish").addEventListener("click", async () => {
    const post = collect();
    if (!post.title) return say("Give it a title first.", "warn");
    if (!post.markdown.trim()) return say("The body is empty.", "warn");
    say("Publishing…");
    try {
      const out = await api({ action: "upsert", post });
      say(`${out.replacing ? "Updated" : "Published"} “${post.title}”. ${out.note}`, "ok");
    } catch (err) {
      say(err.message, "err");
    }
  });

  $("#export").addEventListener("click", () => {
    const post = collect();
    if (!post.title) return say("Give it a title first.", "warn");
    const entry = {
      slug: post.slug,
      title: post.title,
      date: post.date,
      summary: post.summary,
      tags: post.tags,
      readingMinutes: Math.max(1, Math.round(post.markdown.trim().split(/\s+/).length / 200)),
      markdown: post.markdown.trim(),
    };
    const text = JSON.stringify(entry, null, 2);
    const blob = new Blob([text], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${post.slug || "post"}.json`;
    a.click();
    navigator.clipboard?.writeText(text).catch(() => {});
    say("Exported and copied. Paste it into the posts array in blog/posts.json.", "ok");
  });

  $("#check").addEventListener("click", async () => {
    say("Asking GitHub what the token can do…");
    try {
      const d = await api({ action: "diagnose" });
      if (!d.tokenValid) return say(d.tokenError, "err");
      if (!d.repoVisible) return say(d.repoError, "err");
      if (!d.canWriteContents) {
        return say(
          `Token belongs to ${d.tokenOwner} and can see ${d.repo}, but cannot write contents ` +
            `(probe returned ${d.writeProbeStatus}` +
            (d.acceptedPermissions ? `, GitHub wants "${d.acceptedPermissions}"` : "") +
            `). ${d.fix}`,
          "err"
        );
      }
      say(`All good. Token ${d.tokenOwner} can write contents on ${d.repo} (${d.branch}).`, "ok");
    } catch (err) {
      say(err.message, "err");
    }
  });

  $("#lock").addEventListener("click", () => {
    sessionStorage.removeItem(KEY_STORE);
    location.reload();
  });

  $("#load").addEventListener("click", async () => {
    const wanted = prompt("Slug of the post to load for editing:");
    if (!wanted) return;
    try {
      const res = await fetch("blog/posts.json", { cache: "no-cache" });
      const data = await res.json();
      const p = (data.posts || []).find((x) => x.slug === wanted.trim());
      if (!p) return say("No post with that slug.", "warn");
      title.value = p.title || "";
      slug.value = p.slug || "";
      date.value = p.date || "";
      summary.value = p.summary || "";
      tags.value = (p.tags || []).join(", ");
      bodyIn.value = p.markdown || "";
      draw();
      say(`Loaded “${p.title}”. Publishing will overwrite it.`, "ok");
    } catch (e) {
      say(e.message, "err");
    }
  });
})();
