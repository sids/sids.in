import type { Env } from "./types.ts";
import { routeAdmin } from "./routes/admin.ts";
import { routePages } from "./routes/pages.ts";
import { withSecurityHeaders } from "./lib/security-headers.ts";

function isPartialHtmxRequest(request: Request): boolean {
  if (request.headers.get("HX-Request") !== "true") return false;
  return request.headers.get("HX-History-Restore-Request") !== "true";
}

const STATIC_PATHS = ["/css/", "/fonts/", "/games/", "/images/", "/js/", "/robots.txt", "/sitemap.xml"];
const IMMUTABLE_STATIC_PATHS = ["/fonts/", "/js/"];
const VERSIONED_STATIC_PATHS = ["/css/", "/images/"];

function isStaticAsset(path: string): boolean {
  return STATIC_PATHS.some((prefix) => path.startsWith(prefix));
}

function isImmutableStaticAsset(url: URL): boolean {
  return IMMUTABLE_STATIC_PATHS.some((prefix) => url.pathname.startsWith(prefix)) ||
    (url.searchParams.has("v") && VERSIONED_STATIC_PATHS.some((prefix) => url.pathname.startsWith(prefix)));
}

async function fetchStaticAsset(request: Request, env: Env, url: URL): Promise<Response> {
  const response = await env.ASSETS.fetch(request);
  if (response.status !== 200 || !isImmutableStaticAsset(url)) return response;
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export const blogHandler = {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (isStaticAsset(url.pathname)) {
      return withSecurityHeaders(await fetchStaticAsset(request, env, url));
    }

    try {
      const partial = isPartialHtmxRequest(request);
      const adminResponse = await routeAdmin(url.pathname, request, env, url.origin, partial);
      if (adminResponse) return withSecurityHeaders(adminResponse);
      return withSecurityHeaders(routePages(
        url.pathname,
        url.searchParams,
        url.origin,
        partial,
        request.headers.get("HX-Target"),
        request,
        env,
      ));
    } catch (error) {
      console.error(error);
      return withSecurityHeaders(new Response("Internal Server Error", { status: 500 }));
    }
  },
} satisfies Pick<Required<ExportedHandler<Env>>, "fetch">;
