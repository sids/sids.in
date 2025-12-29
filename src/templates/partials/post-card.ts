import type { PostMeta } from "../../types.ts";
import { escapeHtml } from "../../markdown.ts";

export function postCard(post: PostMeta, excerpt: string): string {
  const date = new Date(post.date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `<article class="border-b border-slate-100 pb-6 mb-6 last:border-0">
  <a href="/posts/${post.slug}" class="block group">
    <h2 class="text-xl font-semibold group-hover:text-blue-600 mb-1">${escapeHtml(post.title)}</h2>
    <time class="text-sm text-slate-500">${date}</time>
    <p class="mt-2 text-slate-600">${escapeHtml(post.description)}</p>
    <p class="mt-2 text-slate-500 text-sm">${escapeHtml(excerpt)}</p>
  </a>
  ${
    post.tags.length > 0
      ? `<div class="mt-3 flex gap-2 flex-wrap">
    ${post.tags.map((tag) => `<a href="/tags/${tag}" class="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded">${escapeHtml(tag)}</a>`).join("")}
  </div>`
      : ""
  }
</article>`;
}
