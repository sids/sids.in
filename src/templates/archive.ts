import type { PostMeta, TagInfo } from "../types.ts";
import { escapeHtml } from "../markdown.ts";
import { postFilter, type PostFilterType } from "./partials/post-filter.ts";
import { postsListArchive } from "./partials/posts-list.ts";

function renderTags(tags: TagInfo[]): string {
  if (tags.length === 0) {
    return "";
  }

  const tagLinks = tags
    .map(
      ({ tag, count }) =>
        `<a href="/tags/${tag}" class="tag-pill inline-flex items-center gap-1">
      <span>${escapeHtml(tag)}</span>
      <span style="opacity: 0.5">${count}</span>
    </a>`
    )
    .join("");

  return `<section class="mb-12">
    <h2 class="font-mono text-2xl font-medium mb-4 text-primary">Tags</h2>
    <div class="flex flex-wrap gap-2">
      ${tagLinks}
    </div>
  </section>`;
}

export function archiveTemplate(
  posts: PostMeta[],
  tags: TagInfo[],
  currentFilter: PostFilterType = "all"
): string {
  return `<div>
  <h1 class="font-mono text-3xl font-medium mb-8 text-secondary">Archive</h1>
  ${renderTags(tags)}
  ${postFilter("/archive", currentFilter)}
  ${postsListArchive(posts, currentFilter)}
</div>`;
}

// Returns posts list + filter with OOB swap for HTMX partial updates
export function archivePartial(
  posts: PostMeta[],
  currentFilter: PostFilterType = "all"
): string {
  return postsListArchive(posts, currentFilter) +
    postFilter("/archive", currentFilter, true);
}
