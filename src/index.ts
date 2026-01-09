import type { Env } from "./types.ts";
import { routeLinkLog } from "./routes/link-log.ts";
import { routePages } from "./routes/pages.ts";

// HTMX partial unless it's a full navigation (back/forward, direct URL)
function isPartialHtmxRequest(request: Request): boolean {
  const headers = request.headers;
  if (headers.get("HX-Request") !== "true") return false;
  return headers.get("Sec-Fetch-Dest") !== "document" && headers.get("Sec-Fetch-Mode") !== "navigate";
}

const STATIC_PATHS = ["/css/", "/images/", "/favicon.ico", "/robots.txt", "/sitemap.xml"];
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
      const linkLogResponse = await routeLinkLog(path, request, env, url.origin, isPartialRequest);
      if (linkLogResponse) {
        return linkLogResponse;
      }

      return routePages(path, url.searchParams, url.origin, isPartialRequest, hxTarget, request);
    } catch (e) {
      console.error(e);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};
