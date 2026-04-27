import { describe, expect, it } from "bun:test";
import { isPublicHttpUrl, normalizeHttpUrl } from "./urls.ts";

describe("URL helpers", () => {
  it("accepts HTTP and HTTPS URLs", () => {
    expect(normalizeHttpUrl(" https://example.com/article?foo=1&bar=2 ")).toBe("https://example.com/article?foo=1&bar=2");
    expect(normalizeHttpUrl("http://example.com/article")).toBe("http://example.com/article");
  });

  it("rejects unsafe and non-absolute URLs", () => {
    expect(normalizeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeHttpUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(normalizeHttpUrl("/posts/local")).toBeNull();
    expect(normalizeHttpUrl("//example.com/article")).toBeNull();
  });

  it("rejects loopback, private, and link-local URL targets without fetching", async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response(null, { status: 500 });
    }) as typeof fetch;

    try {
      expect(await isPublicHttpUrl("http://127.0.0.1/")).toBe(false);
      expect(await isPublicHttpUrl("http://10.0.0.1/")).toBe(false);
      expect(await isPublicHttpUrl("http://172.16.0.1/")).toBe(false);
      expect(await isPublicHttpUrl("http://192.168.0.1/")).toBe(false);
      expect(await isPublicHttpUrl("http://169.254.169.254/")).toBe(false);
      expect(await isPublicHttpUrl("http://localhost/")).toBe(false);
      expect(await isPublicHttpUrl("http://[::1]/")).toBe(false);
      expect(await isPublicHttpUrl("http://[fe80::1]/")).toBe(false);
      expect(await isPublicHttpUrl("http://[fd00::1]/")).toBe(false);
      expect(fetchCalled).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("accepts hostnames only when DNS resolves to public addresses", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      expect(url.hostname).toBe("cloudflare-dns.com");
      const type = url.searchParams.get("type");
      const answers = type === "A" ? [{ data: "93.184.216.34" }] : [];
      return Response.json({ Answer: answers });
    }) as typeof fetch;

    try {
      expect(await isPublicHttpUrl("https://example.com/")).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects hostnames when DNS resolves to private addresses", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      expect(url.hostname).toBe("cloudflare-dns.com");
      const type = url.searchParams.get("type");
      const answers = type === "A" ? [{ data: "10.0.0.1" }] : [];
      return Response.json({ Answer: answers });
    }) as typeof fetch;

    try {
      expect(await isPublicHttpUrl("https://example.com/")).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
