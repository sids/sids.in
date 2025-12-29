import type { Post } from "../types.ts";
import { escapeHtml } from "../markdown.ts";

export function postTemplate(post: Post): string {
  const date = new Date(post.date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `<article>
  <header class="mb-8">
    <h1 class="text-3xl font-bold mb-2">${escapeHtml(post.title)}</h1>
    <time class="text-slate-500">${date}</time>
    ${
      post.tags.length > 0
        ? `<div class="mt-3 flex gap-2 flex-wrap">
      ${post.tags.map((tag) => `<a href="/tags/${tag}" class="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded">${escapeHtml(tag)}</a>`).join("")}
    </div>`
        : ""
    }
  </header>
  <div class="post-content">
    ${post.html}
  </div>
</article>`;
}
