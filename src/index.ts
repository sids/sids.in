import type { Env, Post, PaginationInfo } from "./types.ts";
import { parsePage, parsePost } from "./markdown.ts";
import { pages, posts, postContent, tagIndex, allTags } from "./manifest.ts";
import { layout, partial } from "./templates/layout.ts";
import { pageTemplate } from "./templates/page.ts";
import { postTemplate } from "./templates/post.ts";
import { postListTemplate } from "./templates/post-list.ts";
import { archiveTemplate } from "./templates/archive.ts";
import { tagsTemplate } from "./templates/tags.ts";
import { tagTemplate } from "./templates/tag.ts";

const POSTS_PER_PAGE = 10;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const isHtmx = request.headers.get("HX-Request") === "true";

    // Static assets
    if (path.startsWith("/css/") || path.startsWith("/images/") || path === "/favicon.ico") {
      return env.ASSETS.fetch(request);
    }

    try {
      const response = route(path, url.searchParams, isHtmx);
      if (response) {
        return response;
      }
    } catch (e) {
      console.error(e);
      return new Response("Internal Server Error", { status: 500 });
    }

    return new Response("Not Found", { status: 404 });
  },
};

function route(path: string, params: URLSearchParams, isHtmx: boolean): Response | null {
  // Home page
  if (path === "/") {
    const pageData = pages["home"];
    if (pageData) {
      const page = parsePage(pageData.content, "home");
      const content = pageTemplate(page);
      return html(content, page.title, page.description, isHtmx);
    }
    return null;
  }

  // Posts list
  if (path === "/posts") {
    const page = getPageNumber(params);
    const { items, pagination } = paginate(posts, page, POSTS_PER_PAGE);
    const fullPosts = items.map((meta) => {
      const raw = postContent[meta.slug];
      return raw ? parsePost(raw) : null;
    }).filter((p): p is Post => p !== null);

    const content = postListTemplate(fullPosts, pagination);
    return html(content, "Posts", "All blog posts", isHtmx);
  }

  // Individual post
  const postMatch = path.match(/^\/posts\/([a-z0-9-]+)$/);
  if (postMatch) {
    const slug = postMatch[1]!;
    const raw = postContent[slug];
    if (raw) {
      const post = parsePost(raw);
      const content = postTemplate(post);
      return html(content, post.title, post.description, isHtmx);
    }
    return null;
  }

  // Archive
  if (path === "/archive") {
    const content = archiveTemplate(posts);
    return html(content, "Archive", "All posts by date", isHtmx);
  }

  // Tags list
  if (path === "/tags") {
    const content = tagsTemplate(allTags);
    return html(content, "Tags", "All tags", isHtmx);
  }

  // Individual tag
  const tagMatch = path.match(/^\/tags\/([a-z0-9-]+)$/i);
  if (tagMatch) {
    const tag = tagMatch[1]!;
    const slugs = tagIndex[tag];
    if (slugs && slugs.length > 0) {
      const tagPosts = slugs
        .map((slug) => posts.find((p) => p.slug === slug))
        .filter((p) => p !== undefined);

      const page = getPageNumber(params);
      const { items, pagination } = paginate(tagPosts, page, POSTS_PER_PAGE);

      const fullPosts = items.map((meta) => {
        const raw = postContent[meta.slug];
        return raw ? parsePost(raw) : null;
      }).filter((p): p is Post => p !== null);

      const content = tagTemplate(tag, fullPosts, pagination);
      return html(content, `Tag: ${tag}`, `Posts tagged ${tag}`, isHtmx);
    }
    return null;
  }

  // Static pages (e.g., /about)
  const pageSlug = path.slice(1);
  if (pageSlug && pages[pageSlug]) {
    const pageData = pages[pageSlug]!;
    const page = parsePage(pageData.content, pageSlug);
    const content = pageTemplate(page);
    return html(content, page.title, page.description, isHtmx);
  }

  return null;
}

function html(content: string, title: string, description: string | undefined, isHtmx: boolean): Response {
  const body = isHtmx ? partial(content, title) : layout(content, title, description);
  return new Response(body, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function getPageNumber(params: URLSearchParams): number {
  const page = parseInt(params.get("page") || "1", 10);
  return isNaN(page) || page < 1 ? 1 : page;
}

function paginate<T>(items: T[], page: number, perPage: number): { items: T[]; pagination: PaginationInfo } {
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
