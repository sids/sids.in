import type { Env } from "./types.ts";
import { routeAdmin } from "./routes/admin.ts";
import { routePages } from "./routes/pages.ts";

// HTMX partial unless it's a history restore request.
// History restore must receive full HTML so HTMX can rebuild state correctly.
function isPartialHtmxRequest(request: Request): boolean {
  const headers = request.headers;
  if (headers.get("HX-Request") !== "true") {
    return false;
  }

  return headers.get("HX-History-Restore-Request") !== "true";
}

const STATIC_PATHS = ["/css/", "/images/", "/robots.txt", "/sitemap.xml"];
const isStaticAsset = (path: string) => STATIC_PATHS.some((p) => path.startsWith(p));

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const isPartialRequest = isPartialHtmxRequest(request);
    const hxTarget = request.headers.get("HX-Target");

    if (isStaticAsset(path)) {
      return env.ASSETS.fetch(request);
    }

    try {
      const adminResponse = await routeAdmin(path, request, env, url.origin, isPartialRequest);
      if (adminResponse) {
        return adminResponse;
      }

      return routePages(path, url.searchParams, url.origin, isPartialRequest, hxTarget, request, env);
    } catch (e) {
      console.error(e);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};
