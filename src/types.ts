export interface PageMeta {
  title: string;
  description?: string;
}

export interface Page extends PageMeta {
  slug: string;
  html: string;
}

export interface PostMeta {
  title: string;
  slug: string;
  date: string;
  description?: string;
  tags: string[];
  draft?: boolean;
}

export interface Post extends PostMeta {
  html: string;
  excerpt: string;
}

export interface TagInfo {
  tag: string;
  count: number;
}

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface Env {
  ASSETS: Fetcher;
}
