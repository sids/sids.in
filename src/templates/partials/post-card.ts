import type { Post } from "../../types.ts";
import { escapeHtml } from "../../markdown.ts";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function extractFirstParagraphs(html: string, maxParagraphs: number = 2): string {
  const paragraphs = html.match(/<p>.*?<\/p>/gs) || [];
  return paragraphs.slice(0, maxParagraphs).join('\n');
}

export function postCard(post: Post): string {
  const contentPreview = extractFirstParagraphs(post.html);
  const isTruncated = post.excerpt.endsWith("...");

  return `<article class="py-8 first:pt-0">
  <time class="date-mono block mb-2">${formatDate(post.date)}</time>
  <a href="/posts/${post.slug}" class="group">
    <h2 class="font-mono text-xl font-medium transition-colors mb-2 text-primary group-hover:text-accent">${escapeHtml(post.title)}</h2>
  </a>
  <div class="leading-relaxed prose-sm text-secondary">${contentPreview}</div>
  ${isTruncated ? `<a href="/posts/${post.slug}" class="link-animated inline-block mt-2">Continue reading →</a>` : ""}
  ${
    post.tags.length > 0
      ? `<div class="mt-4 flex gap-2 flex-wrap">
    ${post.tags.map((tag) => `<a href="/tags/${tag}" class="tag-pill">${escapeHtml(tag)}</a>`).join("")}
  </div>`
      : ""
  }
</article>`;
}
