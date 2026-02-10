import type { Post, PostMeta } from "../types.ts";
import { escapeHtml } from "../markdown.ts";
import { formatPostDate } from "./format-date.ts";
import { asideIcon, externalLinkIcon, ccIcon, ccByIcon, ccSaIcon } from "./icons.ts";
import { postsListCompact } from "./partials/posts-list.ts";
import { tagFilter, type TagFilterType } from "./partials/tag-filter.ts";
import { recentPostsPartial, recentPostsSection } from "./partials/recent-posts-section.ts";

export function postTemplate(
  post: Post,
  recentPosts: PostMeta[],
  currentTagFilter: TagFilterType = "all",
  canPublishDraft = false
): string {
  // Title: links to external URL with icon if link exists, otherwise just plain text
  const titlePrefix = post.postType === "aside" ? asideIcon : "";
  const titleHtml = post.link
    ? `<a href="${escapeHtml(post.link)}" class="text-primary" target="_blank" rel="noopener noreferrer">
      <h1 class="font-mono text-3xl md:text-4xl font-medium tracking-tight mb-4 text-primary">${externalLinkIcon}${escapeHtml(post.title)}</h1>
    </a>`
    : `<h1 class="font-mono text-3xl md:text-4xl font-medium tracking-tight mb-4 text-primary">${titlePrefix}${escapeHtml(post.title)}</h1>`;

  const draftBanner = post.draft
    ? `<div class="mb-6 flex items-center justify-between gap-3 rounded border border-border bg-secondary px-4 py-3 text-sm text-primary">
      <span>Draft preview: this post is not published yet and is shared for review.</span>
      ${canPublishDraft
        ? `<form method="POST" action="/admin/api/publish" class="shrink-0">
          <input type="hidden" name="slug" value="${escapeHtml(post.slug)}" />
          <button type="submit" class="rounded border border-border bg-primary px-2 py-1 font-mono text-xs text-primary no-underline hover:text-accent">Publish</button>
        </form>`
        : `<a href="/admin/login" class="shrink-0 rounded border border-border bg-primary px-2 py-1 font-mono text-xs text-primary no-underline hover:text-accent hover:no-underline">Log in</a>`}
    </div>`
    : "";

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
    This post is licensed under <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer license" class="align-middle"><span class="inline-flex items-center gap-1 align-middle">${ccIcon}${ccByIcon}${ccSaIcon}</span> CC BY-SA 4.0</a>
  </p>`;

  const endMark = `<div class="text-center text-secondary text-lg tracking-widest mt-12" aria-hidden="true">· · ·</div>`;

  return `<article>
  <header class="mb-12">
    ${draftBanner}
    <time class="date-mono block mb-3">${formatPostDate(post.date)}</time>
    ${titleHtml}
  </header>
  <div class="post-content">
    ${post.html}
  </div>
  <footer class="mt-12 flex flex-col gap-3">
    ${tagsMarkup}
    ${licenseMarkup}
    ${endMark}
  </footer>
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
