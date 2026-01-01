import type { Page, PostMeta } from "../types.ts";
import { postFilter, type PostFilterType } from "./partials/post-filter.ts";
import { postsListCompact } from "./partials/posts-list.ts";

export function homeTemplate(
  page: Page,
  recentPosts: PostMeta[],
  currentFilter: PostFilterType = "all"
): string {
  const recentPostsSection = `
  <section class="mt-12">
    <h2 class="font-mono text-2xl font-medium mb-4">
      <a href="/posts" class="link-accent">Recent Posts</a>
    </h2>
    ${postFilter("/", currentFilter)}
    ${postsListCompact(recentPosts, currentFilter)}
    <p class="mt-6 text-primary">
      Browse the <a href="/archive" class="link-accent">archive</a> or subscribe to the <a href="/posts/feed.xml" class="link-accent">RSS feed</a>.
    </p>
  </section>`;

  return `<article class="post-content">
  ${page.html}
</article>
${recentPostsSection}`;
}

// Returns posts list + filter with OOB swap for HTMX partial updates
export function homePartial(
  recentPosts: PostMeta[],
  currentFilter: PostFilterType = "all"
): string {
  return postsListCompact(recentPosts, currentFilter) +
    postFilter("/", currentFilter, true);
}
