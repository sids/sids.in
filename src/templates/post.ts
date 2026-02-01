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

  // Post footer with tags and license
  const tagsMarkup =
    post.tags.length > 0
      ? `<p class="text-secondary">Tagged as ${post.tags.map((tag) => `<a href="/tags/${tag}" class="tag-pill">${escapeHtml(tag)}</a>`).join(" ")}</p>`
      : "";

  const licenseMarkup = `<p class="text-secondary text-sm">
    <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer license">CC BY-SA 4.0</a>
  </p>`;

  const endMark = `<div class="text-center text-secondary text-lg tracking-widest mt-12">· · ·</div>`;

  return `<article>
  <header class="mb-12">
    <time class="date-mono block mb-3">${formatPostDate(post.date)}</time>
    ${titleHtml}
  </header>
  <div class="post-content">
    ${post.html}
  </div>
  <footer class="mt-12 flex flex-col gap-3">
    ${tagsMarkup}
    ${licenseMarkup}
  </footer>
  ${endMark}
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
