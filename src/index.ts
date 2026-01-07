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
import { generateRssFeed } from "./rss.ts";
import { linkLogTemplate } from "./templates/link-log.ts";

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
    const fetchDest = request.headers.get("Sec-Fetch-Dest");
    const fetchMode = request.headers.get("Sec-Fetch-Mode");
    const isDocumentRequest = fetchDest === "document" || fetchMode === "navigate";
    const isPartialRequest = isHtmx && !isDocumentRequest;
    const hxTarget = request.headers.get("HX-Target");

    // Static assets
    if (path.startsWith("/css/") || path.startsWith("/images/") || path === "/favicon.ico") {
      return env.ASSETS.fetch(request);
    }

    try {
      if (path === "/api/link-log" && request.method === "POST") {
        return handleLinkLogSubmission(request, env);
      }

      if (path === "/api/link-log/metadata" && request.method === "GET") {
        return handleLinkLogMetadata(request, env);
      }

      if (path === "/link-log") {
        const authResponse = requireBasicAuth(request, env);
        if (authResponse) {
          return authResponse;
        }
        const content = linkLogTemplate(url.origin, allTags);
        return html(content, "New Link Log", "Create a link log entry", isPartialRequest, request);
      }

      const response = route(path, url.searchParams, url.origin, isPartialRequest, hxTarget, request);
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

function requireBasicAuth(request: Request, env: Env): Response | null {
  const authHeader = request.headers.get("Authorization") || "";
  const [scheme, encoded] = authHeader.split(" ");
  if (scheme !== "Basic" || !encoded) {
    return unauthorizedResponse();
  }

  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch (error) {
    console.warn("Invalid Basic Auth header", error);
    return unauthorizedResponse();
  }
  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) {
    return unauthorizedResponse();
  }

  const username = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);
  const expectedUser = env.BASIC_AUTH_USER || "sid";

  if (username !== expectedUser || password !== env.BASIC_AUTH_PASSWORD) {
    return unauthorizedResponse();
  }

  return null;
}

function unauthorizedResponse(): Response {
  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": "Basic realm=\"Link Log\"",
    },
  });
}

async function handleLinkLogMetadata(request: Request, env: Env): Promise<Response> {
  const authResponse = requireBasicAuth(request, env);
  if (authResponse) {
    return authResponse;
  }

  const url = new URL(request.url);
  const target = url.searchParams.get("url");
  if (!target) {
    return json({ error: "Missing url parameter" }, 400);
  }

  let response: Response;
  try {
    response = await fetch(target, {
      headers: {
        "User-Agent": "sids.in link log bot",
      },
    });
  } catch (error) {
    console.error(error);
    return json({ error: "Failed to fetch URL" }, 502);
  }

  if (!response.ok) {
    return json({ error: "Failed to fetch URL" }, 502);
  }

  const htmlText = await response.text();
  const title = extractTitle(htmlText);

  return json({ title });
}

function extractTitle(htmlText: string): string | null {
  const ogTitleMatch = htmlText.match(/<meta[^>]+property=[\"']og:title[\"'][^>]+content=[\"']([^\"']+)[\"'][^>]*>/i);
  if (ogTitleMatch?.[1]) {
    return decodeHtmlEntities(ogTitleMatch[1].trim());
  }

  const titleMatch = htmlText.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch?.[1]) {
    return decodeHtmlEntities(titleMatch[1].trim());
  }

  return null;
}

function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: "\"",
    apos: "'",
    nbsp: "\u00a0",
  };

  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity[0] === "#") {
      const isHex = entity[1]?.toLowerCase() === "x";
      const codePoint = parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (!Number.isNaN(codePoint)) {
        return String.fromCodePoint(codePoint);
      }
      return match;
    }

    return namedEntities[entity] ?? match;
  });
}

async function handleLinkLogSubmission(request: Request, env: Env): Promise<Response> {
  const authResponse = requireBasicAuth(request, env);
  if (authResponse) {
    return authResponse;
  }

  if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO) {
    return json({ error: "Missing GitHub configuration" }, 500);
  }

  const payload = await request.json<{
    url?: string;
    title?: string;
    description?: string;
    tags?: string | string[];
    content?: string;
  }>();

  if (!payload.url || !payload.title) {
    return json({ error: "Missing url or title" }, 400);
  }

  const tags = normalizeTags(payload.tags);
  const date = new Date().toISOString().slice(0, 10);
  const slug = slugify(payload.title);
  const filePath = buildPostPath(date, slug);
  const markdown = buildLinkLogMarkdown({
    title: payload.title,
    slug,
    date,
    description: payload.description,
    tags,
    link: payload.url,
    content: payload.content || "",
  });

  const branch = env.GITHUB_BRANCH || "main";

  const createResponse = await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${filePath}`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "sids.in link log bot",
    },
    body: JSON.stringify({
      message: `Add link log: ${payload.title}`,
      content: base64EncodeUtf8(markdown),
      branch,
      committer: {
        name: "Link Log Bot",
        email: "link-log@users.noreply.github.com",
      },
    }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    console.error(errorText);
    return json({ error: "Failed to create post" }, 502);
  }

  const result = await createResponse.json<{ content?: { path?: string } }>();

  return json({
    path: result.content?.path || filePath,
    slug,
    date,
  });
}

function normalizeTags(input?: string | string[]): string[] {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return input.map((tag) => tag.trim()).filter(Boolean);
  }

  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildPostPath(date: string, slug: string): string {
  const [year, month, day] = date.split("-");
  return `content/posts/${year}/${month}-${day}-${slug}.md`;
}

function buildLinkLogMarkdown(input: {
  title: string;
  slug: string;
  date: string;
  description?: string;
  tags: string[];
  link: string;
  content: string;
}): string {
  const descriptionLine = input.description ? `description: "${escapeYaml(input.description)}"\n` : "";
  const tagsLine = input.tags.length ? `tags: [${input.tags.map((tag) => `"${escapeYaml(tag)}"`).join(", ")}]\n` : "tags: []\n";

  return `---\n` +
    `title: "${escapeYaml(input.title)}"\n` +
    `slug: "${escapeYaml(input.slug)}"\n` +
    `date: "${input.date}"\n` +
    descriptionLine +
    tagsLine +
    `link: "${escapeYaml(input.link)}"\n` +
    `draft: false\n` +
    `---\n\n` +
    `${input.content.trim()}\n`;
}

function escapeYaml(value: string): string {
  return value.replace(/"/g, "\\\"");
}

function base64EncodeUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function json(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
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
