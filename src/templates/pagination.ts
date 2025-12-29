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
      `<a href="${url}" class="${isCurrent ? "bg-slate-900 text-white" : "bg-slate-100 hover:bg-slate-200"} px-3 py-1 rounded text-sm">${i}</a>`
    );
  }

  return `<nav class="flex items-center justify-center gap-2 mt-8">
  ${info.hasPrev ? `<a href="${info.currentPage === 2 ? basePath : `${basePath}?page=${info.currentPage - 1}`}" class="text-sm text-slate-600 hover:text-slate-900">&larr; Prev</a>` : ""}
  <div class="flex gap-1">
    ${pages.join("")}
  </div>
  ${info.hasNext ? `<a href="${basePath}?page=${info.currentPage + 1}" class="text-sm text-slate-600 hover:text-slate-900">Next &rarr;</a>` : ""}
</nav>`;
}
