import type { Post } from "../types.ts";
import { escapeHtml } from "../markdown.ts";
import { formatPostDate } from "./format-date.ts";

// External link icon SVG
const externalLinkIcon = `<svg class="inline-block w-5 h-5 mr-1 align-middle" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>`;

export function postTemplate(post: Post): string {
  // Title: links to external URL with icon if link exists, otherwise just plain text
  const titleHtml = post.link
    ? `<a href="${escapeHtml(post.link)}" class="text-primary" target="_blank" rel="noopener noreferrer">
      <h1 class="font-mono text-3xl md:text-4xl font-medium tracking-tight mb-4" style="color: var(--text-primary)">${externalLinkIcon}${escapeHtml(post.title)}</h1>
    </a>`
    : `<h1 class="font-mono text-3xl md:text-4xl font-medium tracking-tight mb-4" style="color: var(--text-primary)">${escapeHtml(post.title)}</h1>`;

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
