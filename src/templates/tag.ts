import type { Post, PaginationInfo } from "../types.ts";
import { escapeHtml } from "../markdown.ts";
import { postCard } from "./partials/post-card.ts";
import { postFilter } from "./partials/post-filter.ts";
import { pagination } from "./pagination.ts";

export function tagTemplate(
  tag: string,
  posts: Post[],
  paginationInfo: PaginationInfo
): string {
  if (posts.length === 0) {
    return `<p style="color: var(--text-secondary)">No posts with this tag.</p>`;
  }

  const cards = posts.map((post) => postCard(post)).join("");

  return `<div>
  <div class="flex items-center justify-between mb-8">
    <h1 class="font-mono text-sm tracking-widest uppercase" style="color: var(--text-secondary)">
      Tagged: <span style="color: var(--accent)">${escapeHtml(tag)}</span>
    </h1>
    <a href="/tags/${tag}/feed.xml" hx-boost="false" class="font-mono text-xs text-secondary">RSS</a>
  </div>
  ${postFilter()}
  <div class="divide-y" style="border-color: var(--border)">
    ${cards}
  </div>
  ${pagination(paginationInfo, `/tags/${tag}`)}
</div>`;
}
