import type { Post } from "../types.ts";
import { escapeHtml } from "../markdown.ts";
import { formatPostDate } from "./format-date.ts";
import { asideIcon, externalLinkIcon } from "./icons.ts";

export function postTemplate(post: Post): string {
  // Title: links to external URL with icon if link exists, otherwise just plain text
  const titlePrefix = post.postType === "aside" ? asideIcon : "";
  const titleHtml = post.link
    ? `<a href="${escapeHtml(post.link)}" class="text-primary" target="_blank" rel="noopener noreferrer">
      <h1 class="font-mono text-3xl md:text-4xl font-medium tracking-tight mb-4" style="color: var(--text-primary)">${externalLinkIcon}${escapeHtml(post.title)}</h1>
    </a>`
    : `<h1 class="font-mono text-3xl md:text-4xl font-medium tracking-tight mb-4" style="color: var(--text-primary)">${titlePrefix}${escapeHtml(post.title)}</h1>`;

  return `<article>
  <header class="mb-12">
    <time class="date-mono block mb-3">${formatPostDate(post.date)}</time>
    ${titleHtml}
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
