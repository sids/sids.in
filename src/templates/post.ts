import type { Post } from "../types.ts";
import { escapeHtml } from "../markdown.ts";
import { formatPostDate } from "./format-date.ts";

export function postTemplate(post: Post): string {
  return `<article>
  <header class="mb-12">
    <time class="date-mono block mb-3">${formatPostDate(post.date)}</time>
    <h1 class="font-mono text-3xl md:text-4xl font-medium tracking-tight mb-4" style="color: var(--text-primary)">${escapeHtml(post.title)}</h1>
    ${
      post.tags.length > 0
        ? `<div class="flex gap-2 flex-wrap">
      ${post.tags.map((tag) => `<a href="/tags/${tag}" class="tag-pill">${escapeHtml(tag)}</a>`).join("")}
    </div>`
        : ""
    }
  </header>
  <div class="post-content">
    ${post.html}
  </div>
</article>`;
}
