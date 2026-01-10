import type { Post } from "../../types.ts";
import { escapeHtml } from "../../markdown.ts";
import { marked } from "marked";
import { formatPostDate } from "../format-date.ts";
import { asideIcon, externalLinkIcon } from "../icons.ts";

export function postCard(post: Post): string {
  const hasExternalLink = !!post.link;
  const hasDescription = !!post.description;
  const isAside = post.postType === "aside";

  // Date link: accent when external link, no underline when no external link
  const dateLinkClass = hasExternalLink ? "link-accent" : "no-underline";
  const dateLink = `<a href="/posts/${post.slug}" class="${dateLinkClass} date-mono block mb-2">${formatPostDate(post.date)}</a>`;

  // Title: links to external URL with icon if link exists, otherwise links to post
  let titleHtml: string;
  if (hasExternalLink) {
    titleHtml = `<a href="${escapeHtml(post.link!)}" class="text-primary" target="_blank" rel="noopener noreferrer">
    <h2 class="font-mono text-xl font-medium mb-2">${externalLinkIcon}${escapeHtml(post.title)}</h2>
  </a>`;
  } else {
    titleHtml = `<a href="/posts/${post.slug}" class="text-primary">
    <h2 class="font-mono text-xl font-medium mb-2">${isAside ? `${asideIcon}` : ""}${escapeHtml(post.title)}</h2>
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
