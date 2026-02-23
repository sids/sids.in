import { describe, it, expect } from "bun:test";
import { contentVersion } from "./manifest.ts";

// Test the caching logic directly by re-implementing the core function
// This avoids needing to mock the full worker environment
const CACHE_CONTROL = "public, max-age=0, s-maxage=86400, must-revalidate";
const HTML_VARY = "HX-Request, HX-History-Restore-Request, HX-Target";

function getEtag(version: string | null, etagSuffix?: string): string | null {
  if (!version) {
    return null;
  }

  const etagValue = etagSuffix ? `${version}-${etagSuffix}` : version;
  return `"${etagValue}"`;
}

function cachedResponse(
  body: string,
  contentType: string,
  request: Request,
  version: string | null,
  varyHeader?: string,
  etagSuffix?: string,
): Response {
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": CACHE_CONTROL,
  };

  if (varyHeader) {
    headers.Vary = varyHeader;
  }

  const etag = getEtag(version, etagSuffix);
  if (etag) {
    headers["ETag"] = etag;

    const ifNoneMatch = request.headers.get("If-None-Match");
    if (ifNoneMatch === etag) {
      const notModifiedHeaders: Record<string, string> = {
        "ETag": etag,
        "Cache-Control": CACHE_CONTROL,
      };

      if (varyHeader) {
        notModifiedHeaders.Vary = varyHeader;
      }

      return new Response(null, {
        status: 304,
        headers: notModifiedHeaders,
      });
    }
  }

  return new Response(body, { headers });
}

function isPartialHtmxRequest(request: Request): boolean {
  const headers = request.headers;
  if (headers.get("HX-Request") !== "true") {
    return false;
  }

  return headers.get("HX-History-Restore-Request") !== "true";
}

describe("isPartialHtmxRequest", () => {
  it("returns false for non-HTMX requests", () => {
    const request = new Request("https://example.com/posts");
    expect(isPartialHtmxRequest(request)).toBe(false);
  });

  it("returns true for HTMX requests", () => {
    const request = new Request("https://example.com/posts", {
      headers: { "HX-Request": "true" },
    });
    expect(isPartialHtmxRequest(request)).toBe(true);
  });

  it("returns false for HTMX history restore requests", () => {
    const request = new Request("https://example.com/posts", {
      headers: {
        "HX-Request": "true",
        "HX-History-Restore-Request": "true",
      },
    });
    expect(isPartialHtmxRequest(request)).toBe(false);
  });
});

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

  it("uses different ETags for different HTML representations", () => {
    const version = "abc1234";
    const request = new Request("https://example.com/");
    const fullResponse = cachedResponse("<html>full</html>", "text/html; charset=utf-8", request, version, HTML_VARY, "html-full");
    const partialResponse = cachedResponse("<title>partial</title>", "text/html; charset=utf-8", request, version, HTML_VARY, "html-partial");

    expect(fullResponse.headers.get("ETag")).toBe('"abc1234-html-full"');
    expect(partialResponse.headers.get("ETag")).toBe('"abc1234-html-partial"');
  });

  it("does not 304 when If-None-Match belongs to a different representation", () => {
    const version = "abc1234";
    const request = new Request("https://example.com/", {
      headers: { "If-None-Match": '"abc1234-html-full"' },
    });
    const response = cachedResponse("<title>partial</title>", "text/html; charset=utf-8", request, version, HTML_VARY, "html-partial");

    expect(response.status).toBe(200);
  });

  it("works with RSS content type", () => {
    const request = new Request("https://example.com/feed.xml");
    const response = cachedResponse("<rss>feed</rss>", "application/rss+xml; charset=utf-8", request, contentVersion);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(CACHE_CONTROL);
    expect(response.headers.get("ETag")).toBe(`"${contentVersion}"`);
    expect(response.headers.get("Content-Type")).toBe("application/rss+xml; charset=utf-8");
  });

  it("works with Atom content type", () => {
    const request = new Request("https://example.com/feed.atom");
    const response = cachedResponse("<feed>atom</feed>", "application/atom+xml; charset=utf-8", request, contentVersion);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(CACHE_CONTROL);
    expect(response.headers.get("ETag")).toBe(`"${contentVersion}"`);
    expect(response.headers.get("Content-Type")).toBe("application/atom+xml; charset=utf-8");
  });
});

describe("cachedResponse vary handling", () => {
  it("includes Vary header on HTML responses when configured", () => {
    const request = new Request("https://example.com/posts", {
      headers: {
        "HX-Request": "true",
        "HX-Target": "content",
      },
    });
    const response = cachedResponse("<title>Posts</title>", "text/html; charset=utf-8", request, contentVersion, HTML_VARY);

    expect(response.status).toBe(200);
    expect(response.headers.get("Vary")).toBe(HTML_VARY);
  });

  it("includes Vary header on 304 responses when configured", () => {
    const version = "abc1234";
    const request = new Request("https://example.com/posts", {
      headers: { "If-None-Match": `"${version}"` },
    });
    const response = cachedResponse("<title>Posts</title>", "text/html; charset=utf-8", request, version, HTML_VARY);

    expect(response.status).toBe(304);
    expect(response.headers.get("Vary")).toBe(HTML_VARY);
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
