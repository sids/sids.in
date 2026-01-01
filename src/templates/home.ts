import type { Page, PostMeta } from "../types.ts";
import { escapeHtml } from "../markdown.ts";
import { postFilter } from "./partials/post-filter.ts";

type PostFilterType = "all" | "essay" | "link-log";

function formatMonthDay(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}.${day}`;
}

export function homeTemplate(
  page: Page,
  recentPosts: PostMeta[],
  currentFilter: PostFilterType = "all"
): string {
  const postItems = recentPosts
    .map((post) => {
      return `<li class="flex gap-6 py-2 group">
      <span class="font-mono text-sm w-12 shrink-0 text-secondary">${formatMonthDay(post.date)}</span>
      <a href="/posts/${post.slug}" class="text-primary">${escapeHtml(post.title)}</a>
    </li>`;
    })
    .join("");

  const noPostsMessage = currentFilter === "all"
    ? ""
    : `<p class="text-secondary">No ${currentFilter === "essay" ? "essays" : "link log posts"} found.</p>`;

  const recentPostsSection = `
  <section class="mt-12">
    <h2 class="font-mono text-2xl font-medium mb-4">
      <a href="/posts" class="link-accent">Recent Posts</a>
    </h2>
    ${postFilter("/", currentFilter)}
    ${recentPosts.length > 0
      ? `<ul>${postItems}</ul>`
      : noPostsMessage}
    <p class="mt-6 text-primary">
      Browse the <a href="/archive" class="link-accent">archive</a> or subscribe to the <a href="/posts/feed.xml" class="link-accent">RSS feed</a>.
    </p>
  </section>`;

  return `<article class="post-content">
  ${page.html}
</article>
${recentPostsSection}`;
}
