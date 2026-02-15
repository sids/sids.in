import type { Page, PostMeta } from "../types.ts";
import { postFilter, type PostFilterType } from "./partials/post-filter.ts";
import { postsListCompact } from "./partials/posts-list.ts";
import { recentPostsSection, recentPostsPartial } from "./partials/recent-posts-section.ts";
import { newsletterEmbed } from "./partials/subscribe.ts";

export function homeTemplate(
  page: Page,
  recentPosts: PostMeta[],
  currentFilter: PostFilterType = "all"
): string {
  const recentPostsSectionMarkup = recentPostsSection({
    filterMarkup: postFilter("/", currentFilter),
    listMarkup: postsListCompact(recentPosts, currentFilter),
    footerMarkup: `<p class="mt-6 text-primary">
      Browse the <a href="/archive" class="link-accent">archive</a> or subscribe to the <a href="/posts/feed.xml" hx-boost="false" class="link-accent">RSS feed</a>.
    </p>`,
  });

  return `<article class="post-content">
  ${page.html}
</article>
${recentPostsSectionMarkup}
${newsletterEmbed()}`;
}

// Returns posts list + filter with OOB swap for HTMX partial updates
export function homePartial(
  recentPosts: PostMeta[],
  currentFilter: PostFilterType = "all"
): string {
  return recentPostsPartial(
    postsListCompact(recentPosts, currentFilter),
    postFilter("/", currentFilter, true)
  );
}
