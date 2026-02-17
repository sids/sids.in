import { contentVersion } from "../manifest.ts";
import { layout, partial } from "../templates/layout.ts";

const CACHE_CONTROL = "public, max-age=0, s-maxage=86400, must-revalidate";

export function json(payload: Record<string, unknown>, status = 200): Response {
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

export function html(
  content: string,
  title: string,
  description: string | undefined,
  isHtmx: boolean,
  request: Request,
  tag?: string,
  og?: { title: string; description?: string },
): Response {
  const body = isHtmx ? partial(content, title) : layout(content, title, description, tag, og);
  return cachedResponse(body, "text/html; charset=utf-8", request);
}

export function htmlPartial(content: string, request: Request): Response {
  return cachedResponse(content, "text/html; charset=utf-8", request);
}

export function xml(content: string, request: Request): Response {
  return cachedResponse(content, "application/rss+xml; charset=utf-8", request);
}

export function atom(content: string, request: Request): Response {
  return cachedResponse(content, "application/atom+xml; charset=utf-8", request);
}
