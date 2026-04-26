const SUBSTACK_SUBSCRIBE_URL = "https://siddhartha.substack.com/subscribe?utm_source=sids.in";

export function routeNewsletter(path: string, request: Request): Response | null {
  if (path !== "/newsletter/subscribe") {
    return null;
  }

  if (request.method !== "POST") {
    const url = new URL("/newsletter", request.url);
    return Response.redirect(url.toString(), 303);
  }

  return Response.redirect(SUBSTACK_SUBSCRIBE_URL, 303);
}
