import type { Env } from "./types.ts";
import { routeAdmin } from "./routes/admin.ts";
import { routePages } from "./routes/pages.ts";
import { withSecurityHeaders } from "./lib/security-headers.ts";

// HTMX partial unless it's a history restore request.
// History restore must receive full HTML so HTMX can rebuild state correctly.
function isPartialHtmxRequest(request: Request): boolean {
  const headers = request.headers;
  if (headers.get("HX-Request") !== "true") {
    return false;
  }

  return headers.get("HX-History-Restore-Request") !== "true";
}

const STATIC_PATHS = ["/css/", "/fonts/", "/images/", "/js/", "/robots.txt", "/sitemap.xml"];
const IMMUTABLE_STATIC_PATHS = ["/fonts/", "/js/"];
const VERSIONED_STATIC_PATHS = ["/css/", "/images/"];
const STATIC_ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable";

const isStaticAsset = (path: string) => STATIC_PATHS.some((p) => path.startsWith(p));

function isImmutableStaticAsset(url: URL): boolean {
  const path = url.pathname;
  if (IMMUTABLE_STATIC_PATHS.some((p) => path.startsWith(p))) {
    return true;
  }

  return url.searchParams.has("v") && VERSIONED_STATIC_PATHS.some((p) => path.startsWith(p));
}

async function fetchStaticAsset(request: Request, env: Env, url: URL): Promise<Response> {
  const response = await env.ASSETS.fetch(request);
  if (response.status !== 200 || !isImmutableStaticAsset(url)) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", STATIC_ASSET_CACHE_CONTROL);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const isPartialRequest = isPartialHtmxRequest(request);
    const hxTarget = request.headers.get("HX-Target");

    if (isStaticAsset(path)) {
      return withSecurityHeaders(await fetchStaticAsset(request, env, url));
    }

    try {
      const adminResponse = await routeAdmin(path, request, env, url.origin, isPartialRequest);
      if (adminResponse) {
        return withSecurityHeaders(adminResponse);
      }

      const pageResponse = routePages(path, url.searchParams, url.origin, isPartialRequest, hxTarget, request, env);
      return withSecurityHeaders(pageResponse);
    } catch (e) {
      console.error(e);
      return withSecurityHeaders(new Response("Internal Server Error", { status: 500 }));
    }
  },
};
