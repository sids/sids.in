import type { Env, Post } from "../types.ts";
import { parsePage, parsePost } from "../markdown.ts";
import { allTags, pages, postContent, postMetaBySlug, posts, tagIndex } from "../manifest.ts";
import { archivePartial, archiveTemplate } from "../templates/archive.ts";
import { homePartial, homeTemplate } from "../templates/home.ts";
import { pageTemplate } from "../templates/page.ts";
import { postListPartial, postListTemplate } from "../templates/post-list.ts";
import { postRecentPostsPartial, postTemplate } from "../templates/post.ts";
import { tagPartial, tagTemplate } from "../templates/tag.ts";
import { generateRssFeed } from "../rss.ts";
import { filterPosts, getPageNumber, getPostFilter, paginate } from "../lib/pagination.ts";
import { html, htmlPartial, xml } from "../lib/responses.ts";
import { notFoundTemplate } from "../templates/not-found.ts";
import { hasAdminLoginFlag } from "../lib/session.ts";
import { layout, partial } from "../templates/layout.ts";

const POSTS_PER_PAGE = 10;

type RouteContext = {
  path: string;
  params: URLSearchParams;
  origin: string;
  isHtmx: boolean;
  hxTarget: string | null;
  request: Request;
  env: Env;
};

type RouteHandler = (context: RouteContext) => Response | null;

const routes: RouteHandler[] = [
  handleMainFeed,
  handleTagFeed,
  handleHome,
  handlePostsList,
  handlePost,
  handleArchive,
  handleTag,
  handleStaticPage,
];

export function routePages(
  path: string,
  params: URLSearchParams,
  origin: string,
  isHtmx: boolean,
  hxTarget: string | null,
  request: Request,
  env: Env,
): Response {
  const legacyFilterRedirect = redirectLegacyFilterTypes(path, params, request.url);
  if (legacyFilterRedirect) {
    return legacyFilterRedirect;
  }

  const context: RouteContext = {
    path,
    params,
    origin,
    isHtmx,
    hxTarget,
    request,
    env,
  };

  for (const handler of routes) {
    const response = handler(context);
    if (response) {
      return response;
    }
  }

  const content = notFoundTemplate();
  const body = isHtmx ? partial(content, "404") : layout(content, "404");
  return new Response(body, {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function redirectLegacyFilterTypes(path: string, params: URLSearchParams, requestUrl: string): Response | null {
  const currentType = params.get("type");
  if (currentType !== "brief" && currentType !== "essay" && currentType !== "aside") {
    return null;
  }

  const isFilterablePath = path === "/" || path === "/posts" || path === "/archive" || /^\/tags\/[a-z0-9-]+$/i.test(path);
  if (!isFilterablePath) {
    return null;
  }

  const url = new URL(requestUrl);
  if (currentType === "essay") {
    url.searchParams.set("type", "article");
  } else {
    url.searchParams.set("type", "note");
  }

  return Response.redirect(url.toString(), 301);
}

function handleMainFeed({ path, origin, request }: RouteContext): Response | null {
  if (path !== "/posts/feed.xml") {
    return null;
  }

  const fullPosts = posts
    .map((meta) => {
      const raw = postContent[meta.slug];
      return raw ? parsePost(raw, meta.postType) : null;
    })
    .filter((p): p is Post => p !== null);

  const feed = generateRssFeed(fullPosts, {
    title: "Sid's Blog",
    description: "Posts from Sid's blog",
    feedUrl: `${origin}/posts/feed.xml`,
    siteUrl: origin,
  });
  return xml(feed, request);
}

function handleTagFeed({ path, origin, request }: RouteContext): Response | null {
  const tagFeedMatch = path.match(/^\/tags\/([a-z0-9-]+)\/feed\.xml$/i);
  if (!tagFeedMatch) {
    return null;
  }

  const tag = tagFeedMatch[1]!;
  const slugs = tagIndex[tag];
  if (!slugs || slugs.length === 0) {
    return null;
  }

  const tagPosts = slugs
    .map((slug) => posts.find((p) => p.slug === slug))
    .filter((p) => p !== undefined);

  const fullPosts = tagPosts
    .map((meta) => {
      const raw = postContent[meta.slug];
      return raw ? parsePost(raw, meta.postType) : null;
    })
    .filter((p): p is Post => p !== null);

  const feed = generateRssFeed(fullPosts, {
    title: `Sid's Blog - ${tag}`,
    description: `Posts tagged ${tag}`,
    feedUrl: `${origin}/tags/${tag}/feed.xml`,
    siteUrl: origin,
  });
  return xml(feed, request);
}

function handleHome({ path, params, isHtmx, hxTarget, request }: RouteContext): Response | null {
  if (path !== "/") {
    return null;
  }

  const pageData = pages["home"];
  if (!pageData) {
    return null;
  }

  const page = parsePage(pageData.content, "home");
  const filter = getPostFilter(params);
  const filteredPosts = filterPosts(posts, filter);
  const recentPosts = filteredPosts.slice(0, 10);

  if (hxTarget === "posts-list") {
    return htmlPartial(homePartial(recentPosts, filter), request);
  }

  const content = homeTemplate(page, recentPosts, filter);
  return html(content, page.title, page.description, isHtmx, request);
}

function handlePostsList({ path, params, isHtmx, hxTarget, request }: RouteContext): Response | null {
  if (path !== "/posts") {
    return null;
  }

  const filter = getPostFilter(params);
  const filteredPosts = filterPosts(posts, filter);
  const page = getPageNumber(params);
  const { items, pagination } = paginate(filteredPosts, page, POSTS_PER_PAGE);
  const fullPosts = items
    .map((meta) => {
      const raw = postContent[meta.slug];
      return raw ? parsePost(raw, meta.postType) : null;
    })
    .filter((p): p is Post => p !== null);

  if (hxTarget === "posts-list") {
    return htmlPartial(postListPartial(fullPosts, pagination, filter), request);
  }

  const content = postListTemplate(fullPosts, pagination, filter);
  return html(content, "Posts", "All blog posts", isHtmx, request);
}

function handlePost({ path, params, isHtmx, hxTarget, request }: RouteContext): Response | null {
  const postMatch = path.match(/^\/posts\/([a-z0-9-]+)$/);
  if (!postMatch) {
    return null;
  }

  const slug = postMatch[1]!;
  const raw = postContent[slug];
  if (!raw) {
    return null;
  }

  const postMeta = postMetaBySlug[slug];
  const post = parsePost(raw, postMeta?.postType);
  const tagParam = params.get("tag");
  const currentTag = tagParam && post.tags.includes(tagParam) ? tagParam : "all";
  const recentPostsPool = currentTag === "all"
    ? posts
    : posts.filter((meta) => meta.tags.includes(currentTag));
  const recentPosts = recentPostsPool
    .filter((meta) => meta.slug !== post.slug)
    .slice(0, 5);

  if (hxTarget === "posts-list") {
    return htmlPartial(
      postRecentPostsPartial(recentPosts, post.tags, currentTag, `/posts/${post.slug}`),
      request
    );
  }

  const canPublishDraft = post.draft ? hasAdminLoginFlag(request) : false;
  const content = postTemplate(post, recentPosts, currentTag, canPublishDraft);
  const og = { title: post.title, description: post.description };
  return html(content, post.title, post.description, isHtmx, request, undefined, og);
}

function handleArchive({ path, params, isHtmx, hxTarget, request }: RouteContext): Response | null {
  if (path !== "/archive") {
    return null;
  }

  const filter = getPostFilter(params);
  const filteredPosts = filterPosts(posts, filter);

  if (hxTarget === "posts-list") {
    return htmlPartial(archivePartial(filteredPosts, filter), request);
  }

  const content = archiveTemplate(filteredPosts, allTags, filter);
  return html(content, "Archive", "All posts by date", isHtmx, request);
}

function handleTag({ path, params, origin, isHtmx, hxTarget, request }: RouteContext): Response | null {
  const tagMatch = path.match(/^\/tags\/([a-z0-9-]+)$/i);
  if (!tagMatch) {
    return null;
  }

  const tag = tagMatch[1]!;
  const slugs = tagIndex[tag];
  if (!slugs || slugs.length === 0) {
    return null;
  }

  const tagPosts = slugs
    .map((slug) => posts.find((p) => p.slug === slug))
    .filter((p) => p !== undefined);

  const filter = getPostFilter(params);
  const filteredTagPosts = filterPosts(tagPosts, filter);
  const page = getPageNumber(params);
  const { items, pagination } = paginate(filteredTagPosts, page, POSTS_PER_PAGE);

  const fullPosts = items
    .map((meta) => {
      const raw = postContent[meta.slug];
      return raw ? parsePost(raw, meta.postType) : null;
    })
    .filter((p): p is Post => p !== null);

  if (hxTarget === "posts-list") {
    return htmlPartial(tagPartial(tag, fullPosts, pagination, filter), request);
  }

  const content = tagTemplate(tag, fullPosts, pagination, filter);
  return html(content, `Tag: ${tag}`, `Posts tagged ${tag}`, isHtmx, request, tag);
}

function handleStaticPage({ path, isHtmx, request }: RouteContext): Response | null {
  const pageSlug = path.slice(1);
  if (!pageSlug || !pages[pageSlug]) {
    return null;
  }

  const pageData = pages[pageSlug]!;
  const page = parsePage(pageData.content, pageSlug);
  const content = pageTemplate(page);
  return html(content, page.title, page.description, isHtmx, request);
}
