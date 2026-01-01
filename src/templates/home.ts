import type { Page, PostMeta } from "../types.ts";
import { escapeHtml } from "../markdown.ts";

function formatMonthDay(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}.${day}`;
}

// Home filter works on li elements
function homeFilter(): string {
  const filters = [
    { id: "all", label: "All Posts" },
    { id: "essay", label: "Essays" },
    { id: "link-log", label: "Link Log" },
  ];

  const buttons = filters
    .map(
      (f) =>
        `<button type="button" data-filter="${f.id}" class="post-filter-btn px-3 py-1 font-mono text-sm transition-colors ${
          f.id === "all"
            ? "text-accent"
            : "text-secondary hover:text-primary"
        }">${f.label}</button>`
    )
    .join("");

  return `<div class="post-filter flex gap-1 mb-4" role="tablist" aria-label="Filter posts">
  ${buttons}
</div>
<script>
(function() {
  const container = document.currentScript.parentElement;
  const buttons = container.querySelectorAll('.post-filter-btn');
  const items = document.querySelectorAll('li[data-post-type]');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;

      buttons.forEach(b => {
        b.classList.remove('text-accent');
        b.classList.add('text-secondary');
      });
      btn.classList.remove('text-secondary');
      btn.classList.add('text-accent');

      items.forEach(item => {
        const postType = item.dataset.postType;
        if (filter === 'all' || postType === filter) {
          item.style.display = '';
        } else {
          item.style.display = 'none';
        }
      });
    });
  });
})();
</script>`;
}

export function homeTemplate(page: Page, recentPosts: PostMeta[]): string {
  const postItems = recentPosts
    .map((post) => {
      return `<li class="flex gap-6 py-2 group" data-post-type="${post.postType}">
      <span class="font-mono text-sm w-12 shrink-0 text-secondary">${formatMonthDay(post.date)}</span>
      <a href="/posts/${post.slug}" class="text-primary">${escapeHtml(post.title)}</a>
    </li>`;
    })
    .join("");

  const recentPostsSection = recentPosts.length > 0 ? `
  <section class="mt-12">
    <h2 class="font-mono text-2xl font-medium mb-4">
      <a href="/posts" class="link-accent">Recent Posts</a>
    </h2>
    ${homeFilter()}
    <ul>
      ${postItems}
    </ul>
    <p class="mt-6 text-primary">
      Browse the <a href="/archive" class="link-accent">archive</a> or subscribe to the <a href="/posts/feed.xml" class="link-accent">RSS feed</a>.
    </p>
  </section>` : "";

  return `<article class="post-content">
  ${page.html}
</article>
${recentPostsSection}`;
}
