import type { Post } from "../../types.ts";
import { escapeHtml } from "../../markdown.ts";
import { marked } from "marked";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

// External link icon SVG
const externalLinkIcon = `<svg class="inline-block w-4 h-4 ml-1 align-baseline" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>`;

export function postCard(post: Post): string {
  const hasExternalLink = !!post.link;
  const hasDescription = !!post.description;

  // Date link: accent when external link, no underline when no external link
  const dateLinkClass = hasExternalLink ? "link-accent" : "no-underline";
  const dateLink = `<a href="/posts/${post.slug}" class="${dateLinkClass} date-mono block mb-2">${formatDate(post.date)}</a>`;

  // Title: links to external URL with icon if link exists, otherwise links to post
  let titleHtml: string;
  if (hasExternalLink) {
    titleHtml = `<a href="${escapeHtml(post.link!)}" class="text-primary" target="_blank" rel="noopener noreferrer">
    <h2 class="font-mono text-xl font-medium mb-2">${escapeHtml(post.title)}${externalLinkIcon}</h2>
  </a>`;
  } else {
    titleHtml = `<a href="/posts/${post.slug}" class="text-primary">
    <h2 class="font-mono text-xl font-medium mb-2">${escapeHtml(post.title)}</h2>
  </a>`;
  }

  // Content: description with "Read Now →" link, or full markdown content
  let contentHtml: string;
  if (hasDescription) {
    const descriptionRendered = marked.parse(post.description!, { async: false, breaks: true }) as string;
    contentHtml = `<div class="leading-relaxed prose-sm text-secondary">${descriptionRendered}</div><a href="/posts/${post.slug}" class="link-accent inline-block">Read Now →</a>`;
  } else {
    // Render full post content as markdown (reusing post-content class)
    contentHtml = `<div class="post-content">${post.html}</div>`;
  }

  return `<article class="py-8 first:pt-0">
  ${dateLink}
  ${titleHtml}
  ${contentHtml}
  ${
    post.tags.length > 0
      ? `<div class="mt-4 flex gap-2 flex-wrap">
    ${post.tags.map((tag) => `<a href="/tags/${tag}" class="tag-pill">${escapeHtml(tag)}</a>`).join("")}
  </div>`
      : ""
  }
</article>`;
}
