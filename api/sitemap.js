/*
 * Sitemap for both hosts.
 *
 * This is a function rather than a static file for two reasons: blog posts
 * come from Substack and change without a deploy, and Vercel resolves static
 * files before rewrites, so a real /sitemap.xml on disk would always win and
 * the blog host could never get its own.
 */
const FEED = process.env.SUBSTACK_FEED || "https://emmanuelangelohyuwa.substack.com/feed";
const WWW = "https://www.hyuwa.dev";
const BLOG = "https://blog.hyuwa.dev";

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));

const SITE_PAGES = [
  ["/", "1.0"],
  ["/projects.html", "0.9"],
  ["/experience.html", "0.8"],
  ["/about.html", "0.8"],
  ["/honours.html", "0.6"],
  ["/contact.html", "0.7"],
];

function slugFrom(link) {
  return String(link || "").split("?")[0].replace(/\/+$/, "").split("/").pop() || "";
}

async function blogUrls() {
  const urls = [{ loc: `${BLOG}/`, priority: "1.0" }];
  try {
    const r = await fetch(FEED, {
      headers: { "User-Agent": "hyuwa.dev sitemap" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return urls;
    const xml = await r.text();
    for (const item of xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || []) {
      const link = ((/<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/i.exec(item) || [])[1] || "")
        .replace(/<!\[CDATA\[|\]\]>/g, "")
        .trim();
      const slug = slugFrom(link);
      if (!slug) continue;
      const d = new Date(((/<pubDate(?:\s[^>]*)?>([\s\S]*?)<\/pubDate>/i.exec(item) || [])[1] || "").trim());
      urls.push({
        loc: `${BLOG}/${slug}`,
        lastmod: Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10),
        priority: "0.8",
      });
    }
  } catch (e) {
    // a feed hiccup should still leave a valid sitemap containing the index
  }
  return urls;
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");

  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  const today = new Date().toISOString().slice(0, 10);

  const urls = host.startsWith("blog.")
    ? await blogUrls()
    : SITE_PAGES.map(([path, priority]) => ({ loc: `${WWW}${path}`, lastmod: today, priority }));

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls
      .map(
        (u) =>
          "  <url>\n" +
          `    <loc>${esc(u.loc)}</loc>\n` +
          (u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : "") +
          `    <priority>${u.priority}</priority>\n` +
          "  </url>"
      )
      .join("\n") +
    "\n</urlset>\n";

  return res.status(200).send(body);
};
