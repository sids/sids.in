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
    return `<p class="text-slate-500">No posts with this tag.</p>`;
  }

  const cards = posts.map((post) => postCard(post, post.excerpt)).join("");

  return `<div>
  <h1 class="text-2xl font-bold mb-6">
    Posts tagged <span class="text-blue-600">${escapeHtml(tag)}</span>
  </h1>
  ${cards}
  ${pagination(paginationInfo, `/tags/${tag}`)}
</div>`;
}
