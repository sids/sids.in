import type { Post, PaginationInfo } from "../types.ts";
import { postCard } from "./partials/post-card.ts";
import { postFilter } from "./partials/post-filter.ts";
import { pagination } from "./pagination.ts";

type PostFilterType = "all" | "essay" | "link-log";

export function postListTemplate(
  posts: Post[],
  paginationInfo: PaginationInfo,
  currentFilter: PostFilterType = "all"
): string {
  const cards = posts.map((post) => postCard(post)).join("");
  const noPostsMessage = currentFilter === "all"
    ? "No posts yet."
    : `No ${currentFilter === "essay" ? "essays" : "link log posts"} found.`;

  return `<h1 class="font-mono text-3xl font-medium mb-8 text-secondary">Posts</h1>
${postFilter("/posts", currentFilter)}
${posts.length === 0
  ? `<p class="text-secondary">${noPostsMessage}</p>`
  : `<div class="divide-y" style="border-color: var(--border)">
  ${cards}
</div>
${pagination(paginationInfo, "/posts", currentFilter)}`}`;
}
