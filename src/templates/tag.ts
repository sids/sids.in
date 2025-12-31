import type { Post, PaginationInfo } from "../types.ts";
import { escapeHtml } from "../markdown.ts";
import { postCard } from "./partials/post-card.ts";
import { pagination } from "./pagination.ts";

export function tagTemplate(
  tag: string,
  posts: Post[],
  paginationInfo: PaginationInfo
): string {
  if (posts.length === 0) {
    return `<p style="color: var(--text-secondary)">No posts with this tag.</p>`;
  }

  const cards = posts.map((post) => postCard(post, post.excerpt)).join("");

  return `<div>
  <h1 class="font-mono text-sm tracking-widest uppercase mb-8" style="color: var(--text-secondary)">
    Tagged: <span style="color: var(--accent)">${escapeHtml(tag)}</span>
  </h1>
  <div class="divide-y" style="border-color: var(--border)">
    ${cards}
  </div>
  ${pagination(paginationInfo, `/tags/${tag}`)}
</div>`;
}
