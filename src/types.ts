export interface PageMeta {
  title: string;
  description?: string;
}

export interface Page extends PageMeta {
  slug: string;
  html: string;
}

export type PostType = "note" | "aside" | "link";

export interface PostMeta {
  title: string;
  slug: string;
  date: string;
  description?: string;
  tags: string[];
  draft?: boolean;
  link?: string;
  sourcePath?: string;
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
  GITHUB_TOKEN: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH?: string;
  // Apple OAuth
  APPLE_CLIENT_ID: string;
  APPLE_TEAM_ID: string;
  APPLE_KEY_ID: string;
  APPLE_PRIVATE_KEY: string;
  // Session
  SESSION_SECRET: string;
  // Authorization
  ADMIN_EMAIL: string;
}
