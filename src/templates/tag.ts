import type { Post, PaginationInfo } from "../types.ts";
import { escapeHtml } from "../markdown.ts";
import { postCard } from "./partials/post-card.ts";
import { postFilter } from "./partials/post-filter.ts";
import { pagination } from "./pagination.ts";

type PostFilterType = "all" | "essay" | "link-log";

export function tagTemplate(
  tag: string,
  posts: Post[],
  paginationInfo: PaginationInfo,
  currentFilter: PostFilterType = "all"
): string {
  const cards = posts.map((post) => postCard(post)).join("");
  const basePath = `/tags/${tag}`;
  const noPostsMessage = currentFilter === "all"
    ? "No posts with this tag."
    : `No ${currentFilter === "essay" ? "essays" : "link log posts"} with this tag.`;

  return `<div>
  <div class="flex items-center justify-between mb-8">
    <h1 class="font-mono text-sm tracking-widest uppercase" style="color: var(--text-secondary)">
      Tagged: <span style="color: var(--accent)">${escapeHtml(tag)}</span>
    </h1>
    <a href="/tags/${tag}/feed.xml" hx-boost="false" class="font-mono text-xs text-secondary">RSS</a>
  </div>
  ${postFilter(basePath, currentFilter)}
  ${posts.length === 0
    ? `<p class="text-secondary">${noPostsMessage}</p>`
    : `<div class="divide-y" style="border-color: var(--border)">
    ${cards}
  </div>
  ${pagination(paginationInfo, basePath, currentFilter)}`}
</div>`;
}
