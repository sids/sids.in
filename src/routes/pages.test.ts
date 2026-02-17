import { describe, expect, it } from "bun:test";
import { routePages } from "./pages.ts";

describe("routePages legacy filter redirects", () => {
  it("redirects /posts?type=brief to type=note with 301", () => {
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
    expect(response.headers.get("location")).toBe("https://sids.in/posts?type=note&page=2");
  });

  it("redirects /posts?type=essay to type=article with 301", () => {
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
    expect(response.headers.get("location")).toBe("https://sids.in/posts?type=article&page=3");
  });

  it("redirects /posts?type=aside to type=note with 301", () => {
    const request = new Request("https://sids.in/posts?type=aside&page=4");
    const response = routePages(
      "/posts",
      new URLSearchParams("type=aside&page=4"),
      "https://sids.in",
      false,
      null,
      request,
      {} as never,
    );

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://sids.in/posts?type=note&page=4");
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
