/*
 * Blog publish endpoint.
 *
 * This is the only place the studio passkey is ever checked, and it runs on
 * Vercel, not in the browser. Neither STUDIO_KEY nor GITHUB_TOKEN is ever sent
 * to a client, so reading the site source tells an attacker nothing useful.
 *
 * Required environment variables (set them in the Vercel dashboard):
 *   STUDIO_KEY    the passkey you type into the studio
 *   GITHUB_TOKEN  fine-grained PAT, Contents: Read and write, this repo only
 * Optional:
 *   GITHUB_REPO   defaults to emmanuelangelo-hyuwa-lang/portfolio_test
 *   GITHUB_BRANCH defaults to main
 *
 * Zero npm dependencies: Node's global fetch and built-in crypto only.
 */
const crypto = require("crypto");

const REPO = process.env.GITHUB_REPO || "emmanuelangelo-hyuwa-lang/portfolio_test";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const POSTS_PATH = "blog/posts.json";
const GH = "https://api.github.com";

/* Constant-time comparison. Both sides are hashed first so the buffers are
   always the same length and the compare cannot leak the key's length. */
function keyMatches(supplied, expected) {
  if (typeof supplied !== "string" || typeof expected !== "string" || !expected) return false;
  const a = crypto.createHash("sha256").update(supplied).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function readingMinutes(markdown) {
  const words = String(markdown).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

async function gh(path, options = {}) {
  const res = await fetch(GH + path, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "hyuwa-studio",
      ...(options.headers || {}),
    },
  });
  return res;
}

async function loadPosts() {
  const res = await gh(`/repos/${REPO}/contents/${POSTS_PATH}?ref=${BRANCH}`);
  if (res.status === 404) return { posts: [], sha: null };
  if (!res.ok) throw new Error(`GitHub read failed (${res.status}): ${await res.text()}`);
  const json = await res.json();
  const decoded = Buffer.from(json.content, "base64").toString("utf8");
  let parsed;
  try {
    parsed = JSON.parse(decoded);
  } catch (e) {
    throw new Error("posts.json in the repo is not valid JSON");
  }
  return { posts: Array.isArray(parsed.posts) ? parsed.posts : [], sha: json.sha };
}

async function savePosts(posts, sha, message) {
  const body = {
    message,
    content: Buffer.from(JSON.stringify({ posts }, null, 2) + "\n", "utf8").toString("base64"),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;
  const res = await gh(`/repos/${REPO}/contents/${POSTS_PATH}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 403 || res.status === 404) {
      // GitHub tells us exactly which permission it wanted; pass that on
      const needed = res.headers.get("x-accepted-github-permissions") || "contents=write";
      throw new Error(
        `GitHub refused the write (${res.status}). The token needs "${needed}" on ${REPO}. ` +
          `Run Check token in the studio for a precise diagnosis. Raw: ${text}`
      );
    }
    throw new Error(`GitHub write failed (${res.status}): ${text}`);
  }
  return res.json();
}

/* Reports what the configured token can actually do, without ever revealing it. */
async function diagnose() {
  const out = { repo: REPO, branch: BRANCH };

  const who = await gh("/user");
  out.tokenValid = who.ok;
  if (who.ok) {
    const u = await who.json();
    out.tokenOwner = u.login;
  } else {
    out.tokenError = `GET /user returned ${who.status}. The token is invalid, expired, or revoked.`;
    return out;
  }

  const repo = await gh(`/repos/${REPO}`);
  out.repoVisible = repo.ok;
  if (!repo.ok) {
    out.repoError =
      `GET /repos/${REPO} returned ${repo.status}. The token is not scoped to this repository. ` +
      `In the token settings choose "Only select repositories" and add ${REPO}.`;
    return out;
  }
  const r = await repo.json();
  out.permissions = r.permissions || null;
  out.canPush = Boolean(r.permissions && r.permissions.push);

  // the definitive test: ask GitHub what a write would require
  const probe = await gh(`/repos/${REPO}/contents/${POSTS_PATH}`, {
    method: "PUT",
    body: JSON.stringify({ message: "permission probe", content: "", branch: BRANCH }),
  });
  out.writeProbeStatus = probe.status;
  out.acceptedPermissions = probe.headers.get("x-accepted-github-permissions") || null;
  // 422 means we got past authorisation and it only disliked our payload: write is allowed
  out.canWriteContents = probe.status === 422 || probe.status === 200 || probe.status === 201;
  if (!out.canWriteContents) {
    out.fix =
      'Open the token, set Repository permissions → Contents to "Read and write", ' +
      `confirm ${REPO} is in the selected repositories, and save. No redeploy needed.`;
  }
  return out;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST." });
  }

  if (!process.env.STUDIO_KEY) {
    return res.status(503).json({
      error:
        "STUDIO_KEY is not set on this deployment. Add it in Vercel → Settings → Environment Variables, then redeploy.",
    });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ error: "Body must be JSON." });
    }
  }
  body = body || {};

  if (!keyMatches(body.key, process.env.STUDIO_KEY)) {
    // deliberately vague, and slow enough to make guessing unattractive
    await new Promise((r) => setTimeout(r, 600));
    return res.status(401).json({ error: "Wrong passkey." });
  }

  // key-only check, so the studio can unlock before it has anything to publish
  if (body.action === "verify") {
    return res.status(200).json({
      ok: true,
      canPublish: Boolean(process.env.GITHUB_TOKEN),
      repo: REPO,
      branch: BRANCH,
    });
  }

  if (!process.env.GITHUB_TOKEN) {
    return res.status(503).json({
      error:
        "GITHUB_TOKEN is not set, so the studio cannot commit. Add it in Vercel, or use Export instead.",
    });
  }

  if (body.action === "diagnose") {
    try {
      return res.status(200).json(await diagnose());
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  try {
    if (body.action === "delete") {
      const slug = slugify(body.slug || "");
      if (!slug) return res.status(400).json({ error: "A slug is required to delete." });
      const { posts, sha } = await loadPosts();
      const next = posts.filter((p) => p.slug !== slug);
      if (next.length === posts.length) return res.status(404).json({ error: "No post with that slug." });
      await savePosts(next, sha, `blog: remove ${slug}`);
      return res.status(200).json({ ok: true, slug, removed: true });
    }

    // default action: upsert
    const post = body.post || {};
    const title = String(post.title || "").trim();
    const markdown = String(post.markdown || "").trim();
    if (!title) return res.status(400).json({ error: "A title is required." });
    if (!markdown) return res.status(400).json({ error: "The post body is empty." });

    const slug = slugify(post.slug || title);
    if (!slug) return res.status(400).json({ error: "Could not build a URL slug from that title." });

    const entry = {
      slug,
      title,
      date: /^\d{4}-\d{2}-\d{2}$/.test(post.date || "") ? post.date : new Date().toISOString().slice(0, 10),
      summary: String(post.summary || "").trim(),
      tags: Array.isArray(post.tags) ? post.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 8) : [],
      readingMinutes: readingMinutes(markdown),
      markdown,
      updated: new Date().toISOString(),
    };

    const { posts, sha } = await loadPosts();
    const i = posts.findIndex((p) => p.slug === slug);
    const replacing = i !== -1;
    if (replacing) posts[i] = { ...posts[i], ...entry };
    else posts.unshift(entry);

    posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));

    await savePosts(posts, sha, `blog: ${replacing ? "update" : "publish"} ${slug}`);

    return res.status(200).json({
      ok: true,
      slug,
      replacing,
      url: `/post.html?slug=${encodeURIComponent(slug)}`,
      note: "Vercel is rebuilding. The post is usually live within a minute.",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Publish failed." });
  }
};
