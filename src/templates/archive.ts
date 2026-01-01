import type { PostMeta, TagInfo } from "../types.ts";
import { escapeHtml } from "../markdown.ts";
import { postFilter } from "./partials/post-filter.ts";

function formatMonthDay(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}.${day}`;
}

function renderTags(tags: TagInfo[]): string {
  if (tags.length === 0) {
    return "";
  }

  const tagLinks = tags
    .map(
      ({ tag, count }) =>
        `<a href="/tags/${tag}" class="tag-pill inline-flex items-center gap-1">
      <span>${escapeHtml(tag)}</span>
      <span style="opacity: 0.5">${count}</span>
    </a>`
    )
    .join("");

  return `<section class="mb-12">
    <h2 class="font-mono text-2xl font-medium mb-4 text-primary">Tags</h2>
    <div class="flex flex-wrap gap-2">
      ${tagLinks}
    </div>
  </section>`;
}

// Archive filter works on li elements instead of article elements
function archiveFilter(): string {
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

  return `<div class="post-filter flex gap-1 mb-6" role="tablist" aria-label="Filter posts">
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

export function archiveTemplate(posts: PostMeta[], tags: TagInfo[]): string {
  if (posts.length === 0) {
    return `<p class="text-secondary">No posts yet.</p>`;
  }

  const postsByYear: Record<string, PostMeta[]> = {};

  for (const post of posts) {
    const year = new Date(post.date).getFullYear().toString();
    if (!postsByYear[year]) {
      postsByYear[year] = [];
    }
    postsByYear[year].push(post);
  }

  const years = Object.keys(postsByYear).sort((a, b) => Number(b) - Number(a));

  const sections = years.map((year) => {
    const yearPosts = postsByYear[year]!;
    const items = yearPosts
      .map((post) => {
        return `<li class="flex gap-6 py-2 group" data-post-type="${post.postType}">
      <span class="font-mono text-sm w-12 shrink-0 text-secondary">${formatMonthDay(post.date)}</span>
      <a href="/posts/${post.slug}" class="text-primary">${escapeHtml(post.title)}</a>
    </li>`;
      })
      .join("");

    return `<section class="mb-12">
    <h2 class="font-mono text-2xl font-medium mb-4 text-primary">${year}</h2>
    <ul>
      ${items}
    </ul>
  </section>`;
  });

  return `<div>
  <h1 class="font-mono text-3xl font-medium mb-8 text-secondary">Archive</h1>
  ${archiveFilter()}
  ${renderTags(tags)}
  ${sections.join("")}
</div>`;
}
