import type { Post } from "./types.ts";
import { escapeHtml } from "./markdown.ts";

interface FeedOptions {
  title: string;
  description: string;
  feedUrl: string;
  siteUrl: string;
}

export function generateAtomFeed(posts: Post[], options: FeedOptions): string {
  const { title, description, feedUrl, siteUrl } = options;
  const updated = posts.length > 0 ? formatAtomDate(posts[0]!.date) : formatAtomDate(new Date().toISOString());

  const entries = posts
    .map((post) => {
      const permalinkUrl = `${siteUrl}/posts/${post.slug}`;
      const alternateUrl = post.link || permalinkUrl;
      const published = formatAtomDate(post.date);

      // Add indicators for link and aside posts
      const titleWithIndicator = post.link
        ? `↗ ${escapeHtml(post.title)}`
        : post.postType === "aside"
        ? `💬 ${escapeHtml(post.title)}`
        : escapeHtml(post.title);

      // For link posts, prepend the external link at the top of content
      const content = post.link
        ? `<p><a href="${escapeHtml(post.link)}" target="_blank" rel="noopener noreferrer">Link ↗</a></p>${post.html}`
        : post.html;

      const relatedLink = post.link
        ? `\n    <link rel="related" type="text/html" href="${escapeHtml(permalinkUrl)}" />`
        : "";

      const summary = post.description
        ? `\n    <summary type="text">${escapeHtml(post.description)}</summary>`
        : "";

      return `  <entry>
    <title>${titleWithIndicator}</title>
    <id>${escapeHtml(permalinkUrl)}</id>
    <link rel="alternate" type="text/html" href="${escapeHtml(alternateUrl)}" />${relatedLink}
    <published>${published}</published>
    <updated>${published}</updated>${summary}
    <content type="html"><![CDATA[${content}]]></content>
  </entry>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeHtml(title)}</title>
  <subtitle>${escapeHtml(description)}</subtitle>
  <link rel="alternate" type="text/html" href="${escapeHtml(siteUrl)}" />
  <link rel="self" type="application/atom+xml" href="${escapeHtml(feedUrl)}" />
  <id>${escapeHtml(feedUrl)}</id>
  <updated>${updated}</updated>
${entries}
</feed>`;
}

function formatAtomDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}
