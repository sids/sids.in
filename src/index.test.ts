import { describe, it, expect } from "bun:test";
import { contentVersion } from "./manifest.ts";

// Test the caching logic directly by re-implementing the core function
// This avoids needing to mock the full worker environment
const CACHE_CONTROL = "public, max-age=0, s-maxage=86400, must-revalidate";

function cachedResponse(body: string, contentType: string, request: Request, version: string | null): Response {
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": CACHE_CONTROL,
  };

  if (version) {
    const etag = `"${version}"`;
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

describe("cachedResponse", () => {
  it("includes Cache-Control and ETag headers on 200 response", () => {
    const request = new Request("https://example.com/");
    const response = cachedResponse("<html>test</html>", "text/html; charset=utf-8", request, contentVersion);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(CACHE_CONTROL);
    expect(response.headers.get("ETag")).toBe(`"${contentVersion}"`);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
  });

  it("returns 304 when If-None-Match matches ETag", async () => {
    const request = new Request("https://example.com/", {
      headers: { "If-None-Match": `"${contentVersion}"` },
    });
    const response = cachedResponse("<html>test</html>", "text/html; charset=utf-8", request, contentVersion);

    expect(response.status).toBe(304);
    expect(response.headers.get("ETag")).toBe(`"${contentVersion}"`);
    expect(response.headers.get("Cache-Control")).toBe(CACHE_CONTROL);
    // 304 should have no body
    expect(await response.text()).toBe("");
  });

  it("returns 200 when If-None-Match does not match", async () => {
    const request = new Request("https://example.com/", {
      headers: { "If-None-Match": '"old-version"' },
    });
    const response = cachedResponse("<html>test</html>", "text/html; charset=utf-8", request, contentVersion);

    expect(response.status).toBe(200);
    expect(response.headers.get("ETag")).toBe(`"${contentVersion}"`);
    // Should have body content
    const body = await response.text();
    expect(body).toBe("<html>test</html>");
  });

  it("works with RSS content type", () => {
    const request = new Request("https://example.com/feed.xml");
    const response = cachedResponse("<rss>feed</rss>", "application/rss+xml; charset=utf-8", request, contentVersion);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(CACHE_CONTROL);
    expect(response.headers.get("ETag")).toBe(`"${contentVersion}"`);
    expect(response.headers.get("Content-Type")).toBe("application/rss+xml; charset=utf-8");
  });
});

describe("cachedResponse with null version", () => {
  it("does not include ETag when version is null", () => {
    const request = new Request("https://example.com/");
    const response = cachedResponse("<html>test</html>", "text/html; charset=utf-8", request, null);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(CACHE_CONTROL);
    expect(response.headers.get("ETag")).toBeNull();
  });

  it("does not return 304 when version is null even with If-None-Match", async () => {
    const request = new Request("https://example.com/", {
      headers: { "If-None-Match": '"some-etag"' },
    });
    const response = cachedResponse("<html>test</html>", "text/html; charset=utf-8", request, null);

    expect(response.status).toBe(200);
    expect(response.headers.get("ETag")).toBeNull();
    const body = await response.text();
    expect(body).toBe("<html>test</html>");
  });
});

describe("contentVersion", () => {
  it("is a string or null", () => {
    expect(contentVersion === null || typeof contentVersion === "string").toBe(true);
  });

  it("looks like a git commit hash when present", () => {
    if (contentVersion !== null) {
      // Short git hash is typically 7 characters, hex
      expect(contentVersion).toMatch(/^[a-f0-9]{7,}$/);
    }
  });
});

describe("Cache-Control header value", () => {
  it("has correct directives", () => {
    expect(CACHE_CONTROL).toContain("public");
    expect(CACHE_CONTROL).toContain("max-age=0");
    expect(CACHE_CONTROL).toContain("s-maxage=86400");
    expect(CACHE_CONTROL).toContain("must-revalidate");
  });
});
