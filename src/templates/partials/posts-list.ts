import type { Post, PostMeta, PaginationInfo } from "../../types.ts";
import { escapeHtml } from "../../markdown.ts";
import { postCard } from "./post-card.ts";
import { pagination } from "../pagination.ts";
import type { PostFilterType } from "./post-filter.ts";
import { formatPostDate } from "../format-date.ts";

function formatMonthDay(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}.${day}`;
}

function describeFilter(filter: PostFilterType): string {
  switch (filter) {
    case "essay":
      return "essays";
    case "brief":
      return "briefs";
    case "link-log":
      return "link log posts";
    default:
      return "posts";
  }
}

// Full post cards with content (for /posts and /tags pages)
export function postsListCards(
  posts: Post[],
  paginationInfo: PaginationInfo,
  basePath: string,
  currentFilter: PostFilterType = "all",
  emptyMessage?: string
): string {
  const noPostsMessage = emptyMessage ?? (currentFilter === "all"
    ? "No posts yet."
    : `No ${describeFilter(currentFilter)} found.`);

  if (posts.length === 0) {
    return `<div id="posts-list">
  <p class="text-secondary">${noPostsMessage}</p>
</div>`;
  }

  const cards = posts.map((post) => postCard(post)).join("");

  return `<div id="posts-list">
  <div class="divide-y" style="border-color: var(--border)">
    ${cards}
  </div>
  ${pagination(paginationInfo, basePath, currentFilter)}
</div>`;
}

// Compact list items (for homepage and archive)
export function postsListCompact(
  posts: PostMeta[],
  currentFilter: PostFilterType = "all"
): string {
  const noPostsMessage = currentFilter === "all"
    ? ""
    : `No ${describeFilter(currentFilter)} found.`;

  if (posts.length === 0) {
    return `<div id="posts-list">
  <p class="text-secondary">${noPostsMessage}</p>
</div>`;
  }

  const items = posts
    .map((post) => {
      const indicator = post.link ? '↗ ' : '';
      return `<li class="flex gap-6 py-2 group">
      <span class="font-mono text-sm w-24 shrink-0 text-secondary">${formatPostDate(post.date)}</span>
      <span>${indicator}<a href="/posts/${post.slug}" class="text-primary">${escapeHtml(post.title)}</a></span>
    </li>`;
    })
    .join("");

  return `<div id="posts-list">
  <ul>${items}</ul>
</div>`;
}

// Archive grouped by year
export function postsListArchive(
  posts: PostMeta[],
  currentFilter: PostFilterType = "all"
): string {
  const noPostsMessage = currentFilter === "all"
    ? "No posts yet."
    : `No ${describeFilter(currentFilter)} found.`;

  if (posts.length === 0) {
    return `<div id="posts-list">
  <p class="text-secondary">${noPostsMessage}</p>
</div>`;
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
        const indicator = post.link ? '↗ ' : '';
        return `<li class="flex gap-6 py-2 group">
      <span class="font-mono text-sm w-12 shrink-0 text-secondary">${formatMonthDay(post.date)}</span>
      <span>${indicator}<a href="/posts/${post.slug}" class="text-primary">${escapeHtml(post.title)}</a></span>
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

  return `<div id="posts-list">
  ${sections.join("")}
</div>`;
}
