import type { PostMeta } from "../../types.ts";
import { escapeHtml } from "../../markdown.ts";
import { marked } from "marked";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

export function postCard(post: PostMeta, excerpt: string): string {
  const descriptionHtml = post.description
    ? marked.parse(post.description, { async: false, breaks: true }) as string
    : "";
  const isTruncated = excerpt.endsWith("...");

  return `<article class="py-8 first:pt-0">
  <time class="date-mono block mb-2">${formatDate(post.date)}</time>
  <a href="/posts/${post.slug}" class="text-primary">
    <h2 class="font-mono text-xl font-medium mb-2">${escapeHtml(post.title)}</h2>
  </a>
  <div class="leading-relaxed prose-sm text-secondary">${descriptionHtml}</div>
  ${isTruncated ? `<a href="/posts/${post.slug}" class="link-accent inline-block mt-2">Continue reading →</a>` : ""}
  ${
    post.tags.length > 0
      ? `<div class="mt-4 flex gap-2 flex-wrap">
    ${post.tags.map((tag) => `<a href="/tags/${tag}" class="tag-pill">${escapeHtml(tag)}</a>`).join("")}
  </div>`
      : ""
  }
</article>`;
}
