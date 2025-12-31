import type { PaginationInfo } from "../types.ts";

export function pagination(info: PaginationInfo, basePath: string): string {
  if (info.totalPages <= 1) {
    return "";
  }

  const pages: string[] = [];

  for (let i = 1; i <= info.totalPages; i++) {
    const url = i === 1 ? basePath : `${basePath}?page=${i}`;
    const isCurrent = i === info.currentPage;

    pages.push(
      `<a href="${url}" class="font-mono text-sm transition-colors" style="color: var(${isCurrent ? "--accent" : "--text-secondary"})">${i}</a>`
    );
  }

  return `<nav class="flex items-center justify-center gap-6 mt-12 pt-8 border-t" style="border-color: var(--border)">
  ${info.hasPrev ? `<a href="${info.currentPage === 2 ? basePath : `${basePath}?page=${info.currentPage - 1}`}" class="font-mono text-sm transition-colors" style="color: var(--text-secondary)">&larr; Prev</a>` : `<span class="font-mono text-sm" style="color: var(--text-secondary); opacity: 0.3">&larr; Prev</span>`}
  <div class="flex gap-4">
    ${pages.join("")}
  </div>
  ${info.hasNext ? `<a href="${basePath}?page=${info.currentPage + 1}" class="font-mono text-sm transition-colors" style="color: var(--text-secondary)">Next &rarr;</a>` : `<span class="font-mono text-sm" style="color: var(--text-secondary); opacity: 0.3">Next &rarr;</span>`}
</nav>`;
}
