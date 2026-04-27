import { describe, expect, it } from "bun:test";
import { withSecurityHeaders } from "./security-headers.ts";

describe("withSecurityHeaders", () => {
  it("adds browser security headers", () => {
    const response = withSecurityHeaders(new Response("ok"));

    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Permissions-Policy")).toContain("camera=()");
  });

  it("adds a content security policy with framing and object restrictions", () => {
    const response = withSecurityHeaders(new Response("ok"));
    const csp = response.headers.get("Content-Security-Policy") || "";

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self' https://appleid.apple.com");
  });

  it("preserves existing response headers", () => {
    const response = withSecurityHeaders(new Response("ok", {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    }));

    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
