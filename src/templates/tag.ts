import type { Post, PaginationInfo } from "../types.ts";
import { escapeHtml } from "../markdown.ts";
import { tagHref } from "../lib/tags.ts";
import { postFilter, type PostFilterType } from "./partials/post-filter.ts";
import { postsListCards } from "./partials/posts-list.ts";

function describeFilter(filter: PostFilterType): string {
  switch (filter) {
    case "article":
      return "articles";
    case "note":
      return "notes";
    case "link":
      return "links";
    default:
      return "posts";
  }
}

export function tagTemplate(
  tags: string[],
  posts: Post[],
  paginationInfo: PaginationInfo,
  currentFilter: PostFilterType = "all"
): string {
  const basePath = tagHref(tags);
  const tagLabel = tags.join(" + ");
  const isMultipleTags = tags.length > 1;
  const emptyMessage = currentFilter === "all"
    ? `No posts with ${isMultipleTags ? "all of these tags" : "this tag"}.`
    : `No ${describeFilter(currentFilter)} with ${isMultipleTags ? "all of these tags" : "this tag"}.`;

  return `<div>
  <div class="flex items-center justify-between mb-8">
    <h1 class="font-heading text-sm tracking-widest uppercase text-secondary">
      Tagged: <span class="text-accent">${escapeHtml(tagLabel)}</span>
    </h1>
    ${isMultipleTags ? "" : `<a href="${tagHref(tags, "/feed")}" class="font-mono text-xs text-secondary">Feed</a>`}
  </div>
  ${postFilter(basePath, currentFilter)}
  ${postsListCards(posts, paginationInfo, basePath, currentFilter, emptyMessage)}
</div>`;
}

// Returns posts list + filter with OOB swap for HTMX partial updates
export function tagPartial(
  tags: string[],
  posts: Post[],
  paginationInfo: PaginationInfo,
  currentFilter: PostFilterType = "all"
): string {
  const basePath = tagHref(tags);
  const isMultipleTags = tags.length > 1;
  const emptyMessage = currentFilter === "all"
    ? `No posts with ${isMultipleTags ? "all of these tags" : "this tag"}.`
    : `No ${describeFilter(currentFilter)} with ${isMultipleTags ? "all of these tags" : "this tag"}.`;

  return postsListCards(posts, paginationInfo, basePath, currentFilter, emptyMessage) +
    postFilter(basePath, currentFilter, true);
}
