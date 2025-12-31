import type { Page, PostMeta } from "../types.ts";
import { escapeHtml } from "../markdown.ts";

function formatMonthDay(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}.${day}`;
}

export function homeTemplate(page: Page, recentPosts: PostMeta[]): string {
  const postItems = recentPosts
    .map((post) => {
      return `<li class="flex gap-6 py-2 group">
      <span class="font-mono text-sm w-12 shrink-0" style="color: var(--text-secondary)">${formatMonthDay(post.date)}</span>
      <a href="/posts/${post.slug}" style="color: var(--text-primary); text-decoration: none;">${escapeHtml(post.title)}</a>
    </li>`;
    })
    .join("");

  const recentPostsSection = recentPosts.length > 0 ? `
  <section class="mt-12">
    <h2 class="font-mono text-2xl font-medium mb-4">
      <a href="/posts" style="color: var(--accent); text-decoration: none;">Recent Posts</a>
    </h2>
    <ul>
      ${postItems}
    </ul>
    <p class="mt-6" style="color: var(--text-primary)">
      Browse the <a href="/archive" style="color: var(--accent); text-decoration: none;">archive</a> or subscribe to the <a href="/posts/feed.xml" style="color: var(--accent); text-decoration: none;">RSS feed</a>.
    </p>
  </section>` : "";

  return `<article class="post-content">
  ${page.html}
</article>
${recentPostsSection}`;
}
