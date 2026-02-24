import type { Post } from "./types.ts";
import { escapeHtml } from "./markdown.ts";

interface FeedOptions {
  title: string;
  description: string;
  feedUrl: string;
  siteUrl: string;
}

export function generateRssFeed(posts: Post[], options: FeedOptions): string {
  const { title, description, feedUrl, siteUrl } = options;
  const lastBuildDate = posts.length > 0 ? formatRssDate(posts[0]!.date) : formatRssDate(new Date().toISOString());

  const items = posts
    .map((post) => {
      const permalinkUrl = `${siteUrl}/posts/${post.slug}`;
      const pubDate = formatRssDate(post.date);

      // Add indicators for link and note posts
      const titleWithIndicator = post.link
        ? `↗ ${escapeHtml(post.title)}`
        : post.postType === "note"
        ? `💬 ${escapeHtml(post.title)}`
        : escapeHtml(post.title);

      // For link posts, prepend the external link at the top of content
      const content = post.link
        ? `<p><a href="${escapeHtml(post.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(post.title)} ↗</a></p>${post.html}`
        : post.html;

      return `    <item>
      <title>${titleWithIndicator}</title>
      <link>${escapeHtml(permalinkUrl)}</link>
      <guid isPermaLink="true">${escapeHtml(permalinkUrl)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeHtml(post.description || "")}</description>
      <content:encoded><![CDATA[${content}]]></content:encoded>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeHtml(title)}</title>
    <link>${siteUrl}</link>
    <description>${escapeHtml(description)}</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;
}

function formatRssDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toUTCString();
}
