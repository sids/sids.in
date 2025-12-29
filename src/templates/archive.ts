import type { PostMeta } from "../types.ts";
import { escapeHtml } from "../markdown.ts";

export function archiveTemplate(posts: PostMeta[]): string {
  if (posts.length === 0) {
    return `<p class="text-slate-500">No posts yet.</p>`;
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
        const date = new Date(post.date);
        const monthDay = date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });

        return `<li class="flex gap-4 py-1">
      <span class="text-slate-400 text-sm w-16 shrink-0">${monthDay}</span>
      <a href="/posts/${post.slug}" class="hover:text-blue-600">${escapeHtml(post.title)}</a>
    </li>`;
      })
      .join("");

    return `<section class="mb-8">
    <h2 class="text-xl font-semibold mb-3">${year}</h2>
    <ul class="space-y-1">
      ${items}
    </ul>
  </section>`;
  });

  return `<div>
  <h1 class="text-2xl font-bold mb-6">Archive</h1>
  ${sections.join("")}
</div>`;
}
