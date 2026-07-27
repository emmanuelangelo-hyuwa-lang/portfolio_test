/*
 * Sitemap for blog.hyuwa.dev.
 *
 * Posts come from Substack, so the list changes without a deploy. A static
 * sitemap.xml would go stale; this one is generated per request and cached
 * at the edge alongside the feed itself.
 */
const FEED = process.env.SUBSTACK_FEED || "https://emmanuelangelohyuwa.substack.com/feed";
const HOST = "https://blog.hyuwa.dev";

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));

function slugFrom(link) {
  return String(link || "").split("?")[0].replace(/\/+$/, "").split("/").pop() || "";
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");

  const urls = [{ loc: `${HOST}/`, priority: "1.0" }];

  try {
    const r = await fetch(FEED, {
      headers: { "User-Agent": "hyuwa.dev sitemap" },
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const xml = await r.text();
      const items = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];
      for (const item of items) {
        const link = (/<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/i.exec(item) || [])[1] || "";
        const pub = (/<pubDate(?:\s[^>]*)?>([\s\S]*?)<\/pubDate>/i.exec(item) || [])[1] || "";
        const slug = slugFrom(link.replace(/<!\[CDATA\[|\]\]>/g, "").trim());
        if (!slug) continue;
        const d = new Date(pub);
        urls.push({
          loc: `${HOST}/${slug}`,
          lastmod: Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10),
          priority: "0.8",
        });
      }
    }
  } catch (e) {
    // a feed hiccup should still leave a valid sitemap with the index in it
  }

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
