import { describe, expect, it } from "bun:test";
import { routePages } from "./pages.ts";

describe("routePages legacy brief filter redirects", () => {
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

  it("does not redirect non-filter routes", () => {
    const request = new Request("https://sids.in/not-a-route?type=brief");
    const response = routePages(
      "/not-a-route",
      new URLSearchParams("type=brief"),
      "https://sids.in",
      false,
      null,
      request,
      {} as never,
    );

    expect(response.status).not.toBe(301);
  });
});
