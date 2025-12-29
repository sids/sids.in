import type { TagInfo } from "../types.ts";
import { escapeHtml } from "../markdown.ts";

export function tagsTemplate(tags: TagInfo[]): string {
  if (tags.length === 0) {
    return `<p class="text-slate-500">No tags yet.</p>`;
  }

  const tagLinks = tags
    .map(
      ({ tag, count }) =>
        `<a href="/tags/${tag}" class="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded text-sm">
      ${escapeHtml(tag)}
      <span class="text-slate-400">${count}</span>
    </a>`
    )
    .join("");

  return `<div>
  <h1 class="text-2xl font-bold mb-6">Tags</h1>
  <div class="flex flex-wrap gap-2">
    ${tagLinks}
  </div>
</div>`;
}
