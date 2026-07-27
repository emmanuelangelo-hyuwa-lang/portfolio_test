/*
 * Substack bridge.
 *
 * Fetches the RSS feed server-side, parses it, sanitises the post HTML and
 * returns normalised JSON. Running on the server means no CORS problem and no
 * Substack markup or tracking reaching the browser directly.
 *
 * Cached at Vercel's edge (see Cache-Control below) so we are not hitting
 * Substack on every page view, and the feed is never fetched at build time,
 * which matters because this site has no build step.
 *
 * Zero npm dependencies: a deliberately small RSS 2.0 reader lives below.
 */

const FEED = process.env.SUBSTACK_FEED || "https://emmanuelangelohyuwa.substack.com/feed";

/* ---------------------------------------------------------------- parsing */

const stripCdata = (s) =>
  String(s || "")
    .replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1")
    .trim();

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’",
  hellip: "…", mdash: "—", ndash: "–",
};

function decodeEntities(s) {
  return String(s || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

/* Pulls the first <tag>…</tag> out of a chunk. Tolerates attributes and
   namespaced names, and returns null rather than throwing when absent. */
function tag(xml, name) {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i");
  const m = re.exec(xml);
  return m ? m[1] : null;
}

function items(xml) {
  const out = [];
  const re = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

/* ------------------------------------------------------------ sanitising */

// dropped along with everything inside them
const NUKE = ["script", "style", "form", "button", "svg", "iframe", "object", "embed", "noscript", "input", "select", "textarea"];
// everything else is unwrapped to its text unless it is in here
const KEEP = new Set([
  "p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6", "a", "strong", "b", "em", "i",
  "u", "s", "code", "pre", "blockquote", "ul", "ol", "li", "img", "figure", "figcaption",
  "table", "thead", "tbody", "tr", "td", "th", "sup", "sub",
]);

function sanitize(html) {
  let s = String(html || "");

  for (const el of NUKE) {
    s = s.replace(new RegExp(`<${el}[\\s\\S]*?<\\/${el}>`, "gi"), "");
    s = s.replace(new RegExp(`<${el}(?:\\s[^>]*)?\\/?>`, "gi"), "");
  }

  // Substack's inline subscribe / share widgets
  s = s.replace(/<div[^>]*class="[^"]*(?:subscription-widget|subscribe-widget|button-wrapper|captioned-button-wrap|poll-embed|share-dialog)[^"]*"[\s\S]*?<\/div>/gi, "");
  s = s.replace(/<p[^>]*class="[^"]*button-wrapper[^"]*"[\s\S]*?<\/p>/gi, "");
  s = s.replace(/<!--[\s\S]*?-->/g, "");

  // Rebuild every remaining tag with only the attributes we allow, which also
  // drops Substack's classes so the post inherits this site's styling.
  s = s.replace(/<(\/)?([a-z0-9]+)((?:\s[^>]*)?)\/?>/gi, (whole, closing, rawName, attrs) => {
    const name = rawName.toLowerCase();
    if (!KEEP.has(name)) return "";
    if (closing) return `</${name}>`;

    if (name === "a") {
      const href = /href\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] || "";
      if (!/^(https?:|mailto:|#|\/)/i.test(href)) return "<a>";
      return `<a href="${href.replace(/"/g, "&quot;")}" target="_blank" rel="noopener nofollow ugc">`;
    }
    if (name === "img") {
      const src = /src\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] || "";
      if (!/^https?:/i.test(src)) return "";
      const alt = (/alt\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] || "").replace(/"/g, "&quot;");
      return `<img src="${src.replace(/"/g, "&quot;")}" alt="${alt}" loading="lazy" />`;
    }
    if (name === "br" || name === "hr") return `<${name} />`;
    return `<${name}>`;
  });

  return s.replace(/(?:\s*<p>\s*<\/p>\s*)+/gi, "").trim();
}

const textOf = (html) => decodeEntities(String(html || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

/* -------------------------------------------------------------- shaping */

function slugFrom(link, title) {
  const fromLink = String(link || "").split("?")[0].replace(/\/+$/, "").split("/").pop();
  const base = fromLink && /[a-z0-9]/i.test(fromLink) ? fromLink : title;
  return String(base || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function toISODate(pubDate) {
  const d = new Date(pubDate);
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

function shape(raw) {
  const title = decodeEntities(stripCdata(tag(raw, "title"))) || "Untitled";
  const link = stripCdata(tag(raw, "link")) || "";
  const summaryHtml = stripCdata(tag(raw, "description")) || "";
  const fullHtml = stripCdata(tag(raw, "content:encoded")) || "";

  const cleanFull = sanitize(fullHtml);
  const cleanSummary = sanitize(summaryHtml);
  const summaryText = textOf(summaryHtml);

  // Substack sends the whole post in content:encoded for public posts. Paywalled
  // or truncated ones come back barely longer than the blurb, so treat those as
  // teasers and send readers to Substack for the rest.
  const bodyHtml = cleanFull.length > Math.max(cleanSummary.length + 200, 600) ? cleanFull : cleanSummary;
  const hasFullContent = bodyHtml === cleanFull && cleanFull.length > 0;

  const words = textOf(bodyHtml).split(/\s+/).filter(Boolean).length;

  return {
    source: "substack",
    slug: slugFrom(link, title),
    title,
    date: toISODate(stripCdata(tag(raw, "pubDate"))),
    summary: summaryText.slice(0, 300),
    author: decodeEntities(stripCdata(tag(raw, "dc:creator"))) || "Emmanuel Angelo-Hyuwa",
    link,
    html: bodyHtml,
    hasFullContent,
    readingMinutes: Math.max(1, Math.round(words / 200)),
  };
}

/* -------------------------------------------------------------- handler */

/* Node's fetch reports every transport problem as a bare "fetch failed", so
   unwrap the cause chain to get something we can actually act on. */
function describe(err) {
  const parts = [err.message];
  let c = err.cause;
  let depth = 0;
  while (c && depth++ < 4) {
    parts.push(c.code || c.name || String(c.message || "").slice(0, 80));
    c = c.cause;
  }
  return parts.filter(Boolean).join(" <- ");
}

async function fetchFeed(attempt = 1) {
  const MAX = 3;
  try {
    const upstream = await fetch(FEED, {
      headers: {
        "User-Agent": "hyuwa.dev blog bridge",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
      // never let a hung upstream hold the function open to its own timeout
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    if (!upstream.ok) throw new Error(`Substack returned ${upstream.status}`);
    return await upstream.text();
  } catch (err) {
    if (attempt < MAX) {
      await new Promise((r) => setTimeout(r, 250 * attempt));
      return fetchFeed(attempt + 1);
    }
    throw new Error(`${describe(err)} (after ${MAX} attempts)`);
  }
}

module.exports = async (req, res) => {
  // Cached by Vercel's edge for 30 minutes, and served stale for a day while
  // revalidating, so a Substack outage never takes the blog down.
  res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");

  try {
    const xml = await fetchFeed();
    const channel = tag(xml, "channel") || xml;

    const posts = items(channel)
      .map((raw) => {
        try {
          return shape(raw);
        } catch (e) {
          return null; // one malformed item should not take out the feed
        }
      })
      .filter((p) => p && p.slug && p.title)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));

    return res.status(200).json({
      ok: true,
      feed: FEED,
      fetchedAt: new Date().toISOString(),
      count: posts.length,
      posts,
    });
  } catch (err) {
    // Fail soft: the blog falls back to natively written posts.
    res.setHeader("Cache-Control", "public, s-maxage=60");
    return res.status(200).json({ ok: false, error: err.message, posts: [] });
  }
};
