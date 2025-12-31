import type { Post, PaginationInfo } from "../types.ts";
import { postCard } from "./partials/post-card.ts";
import { pagination } from "./pagination.ts";

export function postListTemplate(
  posts: Post[],
  paginationInfo: PaginationInfo
): string {
  if (posts.length === 0) {
    return `<p style="color: var(--text-secondary)">No posts yet.</p>`;
  }

  const cards = posts.map((post) => postCard(post)).join("");

  return `<h1 class="font-mono text-3xl font-medium mb-8 text-secondary">Posts</h1>
<div class="divide-y" style="border-color: var(--border)">
  ${cards}
</div>
${pagination(paginationInfo, "/posts")}`;
}
