import { Effect } from "effect";
import type { Env } from "./types.ts";
import { routeAdmin } from "./routes/admin.ts";
import { routePages } from "./routes/pages.ts";
import { withSecurityHeaders } from "./lib/security-headers.ts";
import { fetchStaticAsset } from "./lib/static-assets.ts";

function isPartialHtmxRequest(request: Request): boolean {
  if (request.headers.get("HX-Request") !== "true") return false;
  return request.headers.get("HX-History-Restore-Request") !== "true";
}

const STATIC_PATHS = [
  "/css/",
  "/fonts/",
  "/games/",
  "/images/",
  "/js/",
  "/learning/",
  "/robots.txt",
  "/sitemap.xml",
];

function isStaticAsset(path: string): boolean {
  return STATIC_PATHS.some((prefix) => path.startsWith(prefix));
}

export const blogHandler = {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (isStaticAsset(url.pathname)) {
      return withSecurityHeaders(await Effect.runPromise(fetchStaticAsset(request, env, url)));
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
