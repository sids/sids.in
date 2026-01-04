export interface PageMeta {
  title: string;
  description?: string;
}

export interface Page extends PageMeta {
  slug: string;
  html: string;
}

export type PostType = "essay" | "link-log";

export interface PostMeta {
  title: string;
  slug: string;
  date: string;
  description?: string;
  tags: string[];
  draft?: boolean;
  link?: string;
  postType: PostType;
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
  LINK_SUBMIT_PASSWORD?: string;
  GITHUB_TOKEN?: string;
}
