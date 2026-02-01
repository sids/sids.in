import type { Post, PostMeta } from "../types.ts";
import { escapeHtml } from "../markdown.ts";
import { formatPostDate } from "./format-date.ts";
import { asideIcon, externalLinkIcon } from "./icons.ts";
import { postsListCompact } from "./partials/posts-list.ts";
import { tagFilter, type TagFilterType } from "./partials/tag-filter.ts";
import { recentPostsPartial, recentPostsSection } from "./partials/recent-posts-section.ts";

export function postTemplate(
  post: Post,
  recentPosts: PostMeta[],
  currentTagFilter: TagFilterType = "all"
): string {
  // Title: links to external URL with icon if link exists, otherwise just plain text
  const titlePrefix = post.postType === "aside" ? asideIcon : "";
  const titleHtml = post.link
    ? `<a href="${escapeHtml(post.link)}" class="text-primary" target="_blank" rel="noopener noreferrer">
      <h1 class="font-mono text-3xl md:text-4xl font-medium tracking-tight mb-4 text-primary">${externalLinkIcon}${escapeHtml(post.title)}</h1>
    </a>`
    : `<h1 class="font-mono text-3xl md:text-4xl font-medium tracking-tight mb-4 text-primary">${titlePrefix}${escapeHtml(post.title)}</h1>`;

  const tagFilterMarkup = tagFilter(
    `/posts/${post.slug}`,
    post.tags,
    currentTagFilter
  );
  const emptyMessage = currentTagFilter === "all"
    ? "No recent posts yet."
    : `No recent posts tagged "${escapeHtml(currentTagFilter)}".`;
  const recentPostsSectionMarkup = recentPostsSection({
    filterMarkup: tagFilterMarkup,
    listMarkup: postsListCompact(recentPosts, "all", emptyMessage),
  });

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
</article>
${recentPostsSectionMarkup}`;
}

export function postRecentPostsPartial(
  recentPosts: PostMeta[],
  tags: string[],
  currentTagFilter: TagFilterType = "all",
  basePath: string
): string {
  const emptyMessage = currentTagFilter === "all"
    ? "No recent posts yet."
    : `No recent posts tagged "${escapeHtml(currentTagFilter)}".`;
  return recentPostsPartial(
    postsListCompact(recentPosts, "all", emptyMessage),
    tagFilter(basePath, tags, currentTagFilter, true)
  );
}
