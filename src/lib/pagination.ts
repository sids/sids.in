import type { PaginationInfo, PostMeta, PostType } from "../types.ts";

type PostFilter = "all" | PostType;

export function getPostFilter(params: URLSearchParams): PostFilter {
  const type = params.get("type");
  if (type === "article" || type === "note" || type === "link") {
    return type;
  }
  return "all";
}

export function filterPosts<T extends PostMeta>(items: T[], filter: PostFilter): T[] {
  if (filter === "all") {
    return items;
  }
  return items.filter((post) => post.postType === filter);
}

export function getPageNumber(params: URLSearchParams): number {
  const page = parseInt(params.get("page") || "1", 10);
  return isNaN(page) || page < 1 ? 1 : page;
}

export function paginate<T>(items: T[], page: number, perPage: number): { items: T[]; pagination: PaginationInfo } {
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / perPage);
  const currentPage = Math.min(page, totalPages || 1);
  const start = (currentPage - 1) * perPage;
  const end = start + perPage;

  return {
    items: items.slice(start, end),
    pagination: {
      currentPage,
      totalPages,
      totalItems,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1,
    },
  };
}
