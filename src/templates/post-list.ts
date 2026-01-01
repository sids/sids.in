import type { Post, PaginationInfo } from "../types.ts";
import { postFilter } from "./partials/post-filter.ts";
import { postsListCards } from "./partials/posts-list.ts";

type PostFilterType = "all" | "essay" | "link-log";

export function postListTemplate(
  posts: Post[],
  paginationInfo: PaginationInfo,
  currentFilter: PostFilterType = "all"
): string {
  return `<h1 class="font-mono text-3xl font-medium mb-8 text-secondary">Posts</h1>
${postFilter("/posts", currentFilter)}
${postsListCards(posts, paginationInfo, "/posts", currentFilter)}`;
}

// Returns just the posts list for HTMX partial updates
export function postListPartial(
  posts: Post[],
  paginationInfo: PaginationInfo,
  currentFilter: PostFilterType = "all"
): string {
  return postsListCards(posts, paginationInfo, "/posts", currentFilter);
}
