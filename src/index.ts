import type { Env } from "./types.ts";
import { routeLinkLog } from "./routes/link-log.ts";
import { routePages } from "./routes/pages.ts";

type RouteHandler = (request: Request, env: Env, url: URL, isPartialRequest: boolean, hxTarget: string | null) => Promise<Response | null>;

const routeHandlers: RouteHandler[] = [
  (request, env, url, isPartialRequest) => routeLinkLog(url.pathname, request, env, url.origin, isPartialRequest),
  (request, _env, url, isPartialRequest, hxTarget) =>
    Promise.resolve(routePages(url.pathname, url.searchParams, url.origin, isPartialRequest, hxTarget, request)),
];

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
      for (const handler of routeHandlers) {
        const response = await handler(request, env, url, isPartialRequest, hxTarget);
        if (response) {
          return response;
        }
      }
    } catch (e) {
      console.error(e);
      return new Response("Internal Server Error", { status: 500 });
    }

    return new Response("Not Found", { status: 404 });
  },
};
