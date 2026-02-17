import { describe, expect, it } from "bun:test";
import { routePages } from "./pages.ts";

describe("routePages legacy filter redirects", () => {
  it("redirects /posts?type=brief to type=aside with 301", () => {
    const request = new Request("https://sids.in/posts?type=brief&page=2");
    const response = routePages(
      "/posts",
      new URLSearchParams("type=brief&page=2"),
      "https://sids.in",
      false,
      null,
      request,
      {} as never,
    );

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://sids.in/posts?type=aside&page=2");
  });

  it("redirects /posts?type=essay to type=note with 301", () => {
    const request = new Request("https://sids.in/posts?type=essay&page=3");
    const response = routePages(
      "/posts",
      new URLSearchParams("type=essay&page=3"),
      "https://sids.in",
      false,
      null,
      request,
      {} as never,
    );

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://sids.in/posts?type=note&page=3");
  });

  it("does not redirect non-filter routes", () => {
    const request = new Request("https://sids.in/not-a-route?type=essay");
    const response = routePages(
      "/not-a-route",
      new URLSearchParams("type=essay"),
      "https://sids.in",
      false,
      null,
      request,
      {} as never,
    );

    expect(response.status).not.toBe(301);
  });
});

describe("routePages feed routes", () => {
  it("serves feed page for /posts/feed", async () => {
    const request = new Request("https://sids.in/posts/feed");
    const response = routePages(
      "/posts/feed",
      new URLSearchParams(),
      "https://sids.in",
      false,
      null,
      request,
      {} as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    const body = await response.text();
    expect(body).toContain("/posts/feed.atom");
    expect(body).toContain("/posts/feed.xml");
  });

  it("serves tag feed page for /tags/{tag}/feed", async () => {
    const request = new Request("https://sids.in/tags/ai/feed");
    const response = routePages(
      "/tags/ai/feed",
      new URLSearchParams(),
      "https://sids.in",
      false,
      null,
      request,
      {} as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    const body = await response.text();
    expect(body).toContain("/tags/ai/feed.atom");
    expect(body).toContain("/tags/ai/feed.xml");
    expect(body).toContain("/posts/feed");
  });

  it("serves Atom feed for /posts/feed.atom", async () => {
    const request = new Request("https://sids.in/posts/feed.atom");
    const response = routePages(
      "/posts/feed.atom",
      new URLSearchParams(),
      "https://sids.in",
      false,
      null,
      request,
      {} as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/atom+xml; charset=utf-8");
    const body = await response.text();
    expect(body).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
  });

  it("serves Atom feed for /tags/{tag}/feed.atom", async () => {
    const request = new Request("https://sids.in/tags/ai/feed.atom");
    const response = routePages(
      "/tags/ai/feed.atom",
      new URLSearchParams(),
      "https://sids.in",
      false,
      null,
      request,
      {} as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/atom+xml; charset=utf-8");
    const body = await response.text();
    expect(body).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
  });
});
