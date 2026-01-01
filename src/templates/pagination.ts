import type { PaginationInfo } from "../types.ts";

export function pagination(info: PaginationInfo, basePath: string): string {
  if (info.totalPages <= 1) {
    return "";
  }

  const pages: string[] = [];

  for (let i = 1; i <= info.totalPages; i++) {
    const url = i === 1 ? basePath : `${basePath}?page=${i}`;
    const isCurrent = i === info.currentPage;

    if (isCurrent) {
      // Current page: show with underline (active state)
      pages.push(
        `<span class="font-mono text-sm text-accent" style="text-decoration: underline; text-underline-offset: 2px;">${i}</span>`
      );
    } else {
      // Other pages: accented link style
      pages.push(
        `<a href="${url}" class="link-accent font-mono text-sm">${i}</a>`
      );
    }
  }

  return `<nav class="flex items-center justify-center gap-6 mt-12 pt-8 border-t border-border">
  ${info.hasPrev ? `<a href="${info.currentPage === 2 ? basePath : `${basePath}?page=${info.currentPage - 1}`}" class="font-mono text-sm text-secondary">&larr; Prev</a>` : `<span class="font-mono text-sm text-secondary" style="opacity: 0.3">&larr; Prev</span>`}
  <div class="flex gap-4">
    ${pages.join("")}
  </div>
  ${info.hasNext ? `<a href="${basePath}?page=${info.currentPage + 1}" class="font-mono text-sm text-secondary">Next &rarr;</a>` : `<span class="font-mono text-sm text-secondary" style="opacity: 0.3">Next &rarr;</span>`}
</nav>`;
}
