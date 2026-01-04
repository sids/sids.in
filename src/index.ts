import type { Env, Post, PostMeta, PaginationInfo, PostType } from "./types.ts";
import { parsePage, parsePost } from "./markdown.ts";
import { pages, posts, postContent, tagIndex, allTags, contentVersion } from "./manifest.ts";
import { layout, partial } from "./templates/layout.ts";
import { pageTemplate } from "./templates/page.ts";
import { homeTemplate, homePartial } from "./templates/home.ts";
import { postTemplate } from "./templates/post.ts";
import { postListTemplate, postListPartial } from "./templates/post-list.ts";
import { archiveTemplate, archivePartial } from "./templates/archive.ts";
import { tagTemplate, tagPartial } from "./templates/tag.ts";
import { linkSubmitPage } from "./templates/link-submit.ts";
import { generateRssFeed } from "./rss.ts";

const POSTS_PER_PAGE = 10;
const CACHE_CONTROL = "public, max-age=0, s-maxage=86400, must-revalidate";

type PostFilter = "all" | PostType;

function getPostFilter(params: URLSearchParams): PostFilter {
  const type = params.get("type");
  if (type === "essay" || type === "link-log") {
    return type;
  }
  return "all";
}

function filterPosts<T extends PostMeta>(items: T[], filter: PostFilter): T[] {
  if (filter === "all") {
    return items;
  }
  return items.filter((post) => post.postType === filter);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const isHtmx = request.headers.get("HX-Request") === "true";
    const hxTarget = request.headers.get("HX-Target");

    // Static assets
    if (path.startsWith("/css/") || path.startsWith("/images/") || path === "/favicon.ico") {
      return env.ASSETS.fetch(request);
    }

    try {
      const response = route(path, url.searchParams, url.origin, isHtmx, hxTarget, request);
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

function route(path: string, params: URLSearchParams, origin: string, isHtmx: boolean, hxTarget: string | null, request: Request): Response | null {
  const isPostsListTarget = hxTarget === "posts-list";

  // Main RSS feed
  if (path === "/posts/feed.xml") {
    const fullPosts = posts.map((meta) => {
      const raw = postContent[meta.slug];
      return raw ? parsePost(raw) : null;
    }).filter((p): p is Post => p !== null);

    const feed = generateRssFeed(fullPosts, {
      title: "Sid's Blog",
      description: "Posts from Sid's blog",
      feedUrl: `${origin}/posts/feed.xml`,
      siteUrl: origin,
    });
    return xml(feed, request);
  }

  // Tag RSS feed
  const tagFeedMatch = path.match(/^\/tags\/([a-z0-9-]+)\/feed\.xml$/i);
  if (tagFeedMatch) {
    const tag = tagFeedMatch[1]!;
    const slugs = tagIndex[tag];
    if (slugs && slugs.length > 0) {
      const tagPosts = slugs
        .map((slug) => posts.find((p) => p.slug === slug))
        .filter((p) => p !== undefined);

      const fullPosts = tagPosts.map((meta) => {
        const raw = postContent[meta.slug];
        return raw ? parsePost(raw) : null;
      }).filter((p): p is Post => p !== null);

      const feed = generateRssFeed(fullPosts, {
        title: `Sid's Blog - ${tag}`,
        description: `Posts tagged ${tag}`,
        feedUrl: `${origin}/tags/${tag}/feed.xml`,
        siteUrl: origin,
      });
      return xml(feed, request);
    }
    return null;
  }

  // Home page
  if (path === "/") {
    const pageData = pages["home"];
    if (pageData) {
      const page = parsePage(pageData.content, "home");
      const filter = getPostFilter(params);
      const filteredPosts = filterPosts(posts, filter);
      const recentPosts = filteredPosts.slice(0, 10);

      if (isPostsListTarget) {
        return htmlPartial(homePartial(recentPosts, filter), request);
      }

      const content = homeTemplate(page, recentPosts, filter);
      return html(content, page.title, page.description, isHtmx, request);
    }
    return null;
  }

  // Posts list
  if (path === "/posts") {
    const filter = getPostFilter(params);
    const filteredPosts = filterPosts(posts, filter);
    const page = getPageNumber(params);
    const { items, pagination } = paginate(filteredPosts, page, POSTS_PER_PAGE);
    const fullPosts = items.map((meta) => {
      const raw = postContent[meta.slug];
      return raw ? parsePost(raw) : null;
    }).filter((p): p is Post => p !== null);

    if (isPostsListTarget) {
      return htmlPartial(postListPartial(fullPosts, pagination, filter), request);
    }

    const content = postListTemplate(fullPosts, pagination, filter);
    return html(content, "Posts", "All blog posts", isHtmx, request);
  }

  // Individual post
  const postMatch = path.match(/^\/posts\/([a-z0-9-]+)$/);
  if (postMatch) {
    const slug = postMatch[1]!;
    const raw = postContent[slug];
    if (raw) {
      const post = parsePost(raw);
      const content = postTemplate(post);
      return html(content, post.title, post.description, isHtmx, request);
    }
    return null;
  }

  // Archive
  if (path === "/archive") {
    const filter = getPostFilter(params);
    const filteredPosts = filterPosts(posts, filter);

    if (isPostsListTarget) {
      return htmlPartial(archivePartial(filteredPosts, filter), request);
    }

    const content = archiveTemplate(filteredPosts, allTags, filter);
    return html(content, "Archive", "All posts by date", isHtmx, request);
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

      const filter = getPostFilter(params);
      const filteredTagPosts = filterPosts(tagPosts, filter);
      const page = getPageNumber(params);
      const { items, pagination } = paginate(filteredTagPosts, page, POSTS_PER_PAGE);

      const fullPosts = items.map((meta) => {
        const raw = postContent[meta.slug];
        return raw ? parsePost(raw) : null;
      }).filter((p): p is Post => p !== null);

      if (isPostsListTarget) {
        return htmlPartial(tagPartial(tag, fullPosts, pagination, filter), request);
      }

      const content = tagTemplate(tag, fullPosts, pagination, filter);
      return html(content, `Tag: ${tag}`, `Posts tagged ${tag}`, isHtmx, request, tag);
    }
    return null;
  }

  // Link submit page
  if (path === "/link-submit") {
    const content = linkSubmitPage();
    return html(content, "New Link Log", "Create a new link log post", isHtmx, request);
  }

  // Static pages (e.g., /about)
  const pageSlug = path.slice(1);
  if (pageSlug && pages[pageSlug]) {
    const pageData = pages[pageSlug]!;
    const page = parsePage(pageData.content, pageSlug);
    const content = pageTemplate(page);
    return html(content, page.title, page.description, isHtmx, request);
  }

  return null;
}

function cachedResponse(body: string, contentType: string, request: Request): Response {
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": CACHE_CONTROL,
  };

  if (contentVersion) {
    const etag = `"${contentVersion}"`;
    headers["ETag"] = etag;

    const ifNoneMatch = request.headers.get("If-None-Match");
    if (ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          "ETag": etag,
          "Cache-Control": CACHE_CONTROL,
        },
      });
    }
  }

  return new Response(body, { headers });
}

function html(content: string, title: string, description: string | undefined, isHtmx: boolean, request: Request, tag?: string): Response {
  const body = isHtmx ? partial(content, title) : layout(content, title, description, tag);
  return cachedResponse(body, "text/html; charset=utf-8", request);
}

function htmlPartial(content: string, request: Request): Response {
  return cachedResponse(content, "text/html; charset=utf-8", request);
}

function xml(content: string, request: Request): Response {
  return cachedResponse(content, "application/rss+xml; charset=utf-8", request);
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
