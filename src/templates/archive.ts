import type { PostMeta, TagInfo } from "../types.ts";
import { escapeHtml } from "../markdown.ts";

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
        `<a href="/tags/${tag}" class="nav-link inline-flex items-center gap-2 font-mono text-sm py-2">
      <span>${escapeHtml(tag)}</span>
      <span style="opacity: 0.5">${count}</span>
    </a>`
    )
    .join("");

  return `<section class="mb-12">
    <h2 class="font-mono text-2xl font-medium mb-4" style="color: var(--text-primary)">Tags</h2>
    <div class="flex flex-wrap gap-x-6 gap-y-1">
      ${tagLinks}
    </div>
  </section>`;
}

export function archiveTemplate(posts: PostMeta[], tags: TagInfo[]): string {
  if (posts.length === 0) {
    return `<p style="color: var(--text-secondary)">No posts yet.</p>`;
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
        return `<li class="flex gap-6 py-2 group">
      <span class="font-mono text-sm w-12 shrink-0" style="color: var(--text-secondary)">${formatMonthDay(post.date)}</span>
      <a href="/posts/${post.slug}" style="color: var(--text-primary); text-decoration: none;">${escapeHtml(post.title)}</a>
    </li>`;
      })
      .join("");

    return `<section class="mb-12">
    <h2 class="font-mono text-2xl font-medium mb-4" style="color: var(--text-primary)">${year}</h2>
    <ul>
      ${items}
    </ul>
  </section>`;
  });

  return `<div>
  ${renderTags(tags)}
  ${sections.join("")}
</div>`;
}
