import { describe, expect, it } from "bun:test";
import { routeNewsletter } from "./newsletter.ts";

describe("routeNewsletter", () => {
  it("ignores non-newsletter routes", () => {
    const request = new Request("https://sids.in/");

    expect(routeNewsletter("/", request)).toBeNull();
  });

  it("redirects non-POST subscribe requests back to the newsletter page", () => {
    const request = new Request("https://sids.in/newsletter/subscribe");
    const response = routeNewsletter("/newsletter/subscribe", request);

    expect(response?.status).toBe(303);
    expect(response?.headers.get("location")).toBe("https://sids.in/newsletter");
  });

  it("hands newsletter signups to Substack without email in the URL", () => {
    const request = new Request("https://sids.in/newsletter/subscribe", {
      method: "POST",
      body: new URLSearchParams({ email: "sid@example.com" }),
    });
    const response = routeNewsletter("/newsletter/subscribe", request);
    const location = response?.headers.get("location") ?? "";

    expect(response?.status).toBe(303);
    expect(location).toBe("https://siddhartha.substack.com/subscribe?utm_source=sids.in");
    expect(location).not.toContain("sid%40example.com");
    expect(location).not.toContain("sid@example.com");
  });
});
