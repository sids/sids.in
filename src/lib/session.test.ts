import { describe, it, expect } from "bun:test";
import {
  createSessionCookie,
  verifySession,
  clearSessionCookie,
  generateStateToken,
  createStateCookie,
  readStateCookie,
  verifyStateToken,
  clearStateCookie,
} from "./session.ts";

const TEST_SECRET = "test-secret-key-32-chars-long!!!";

function decodeBase64UrlJson<T>(value: string): T {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + padding;
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

describe("session", () => {
  describe("createSessionCookie", () => {
    it("creates a cookie with correct format", async () => {
      const cookie = await createSessionCookie("test@example.com", TEST_SECRET);

      expect(cookie).toContain("__session=");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("SameSite=Lax");
      expect(cookie).toContain("Path=/admin");
      expect(cookie).toContain("Max-Age=604800");
    });

    it("creates cookie value with payload and signature", async () => {
      const cookie = await createSessionCookie("test@example.com", TEST_SECRET);
      const match = cookie.match(/__session=([^;]+)/);
      expect(match).not.toBeNull();

      const value = match![1]!;
      const parts = value.split(".");
      expect(parts.length).toBe(2);
    });
  });

  describe("verifySession", () => {
    it("returns email for valid session", async () => {
      const cookie = await createSessionCookie("test@example.com", TEST_SECRET);
      const match = cookie.match(/__session=([^;]+)/);
      const request = new Request("https://example.com", {
        headers: { Cookie: `__session=${match![1]}` },
      });

      const result = await verifySession(request, TEST_SECRET);
      expect(result).toEqual({ email: "test@example.com" });
    });

    it("returns null for missing session cookie", async () => {
      const request = new Request("https://example.com");
      const result = await verifySession(request, TEST_SECRET);
      expect(result).toBeNull();
    });

    it("returns null for invalid signature", async () => {
      const cookie = await createSessionCookie("test@example.com", TEST_SECRET);
      const match = cookie.match(/__session=([^;]+)/);
      const [payload] = match![1]!.split(".");
      const tamperedValue = `${payload}.invalid-signature`;

      const request = new Request("https://example.com", {
        headers: { Cookie: `__session=${tamperedValue}` },
      });

      const result = await verifySession(request, TEST_SECRET);
      expect(result).toBeNull();
    });

    it("returns null for tampered payload", async () => {
      const cookie = await createSessionCookie("test@example.com", TEST_SECRET);
      const match = cookie.match(/__session=([^;]+)/);
      const [, signature] = match![1]!.split(".");
      const tamperedPayload = btoa(JSON.stringify({ email: "attacker@example.com", exp: Date.now() + 1000000 }));

      const request = new Request("https://example.com", {
        headers: { Cookie: `__session=${tamperedPayload}.${signature}` },
      });

      const result = await verifySession(request, TEST_SECRET);
      expect(result).toBeNull();
    });

    it("returns null for wrong secret", async () => {
      const cookie = await createSessionCookie("test@example.com", TEST_SECRET);
      const match = cookie.match(/__session=([^;]+)/);

      const request = new Request("https://example.com", {
        headers: { Cookie: `__session=${match![1]}` },
      });

      const result = await verifySession(request, "wrong-secret-key-32-chars!!!!!!");
      expect(result).toBeNull();
    });

    it("returns null for malformed cookie value", async () => {
      const request = new Request("https://example.com", {
        headers: { Cookie: "__session=not-a-valid-format" },
      });

      const result = await verifySession(request, TEST_SECRET);
      expect(result).toBeNull();
    });

    it("returns null for invalid JSON payload", async () => {
      const request = new Request("https://example.com", {
        headers: { Cookie: "__session=bm90LWpzb24.signature" },
      });

      const result = await verifySession(request, TEST_SECRET);
      expect(result).toBeNull();
    });
  });

  describe("clearSessionCookie", () => {
    it("returns cookie with Max-Age=0", () => {
      const cookie = clearSessionCookie();

      expect(cookie).toContain("__session=");
      expect(cookie).toContain("Max-Age=0");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("Path=/admin");
    });
  });
});

describe("state token", () => {
  describe("generateStateToken", () => {
    it("generates a non-empty string", () => {
      const state = generateStateToken();
      expect(state).toBeTruthy();
      expect(typeof state).toBe("string");
    });

    it("generates unique tokens", () => {
      const state1 = generateStateToken();
      const state2 = generateStateToken();
      expect(state1).not.toBe(state2);
    });

    it("generates URL-safe tokens", () => {
      const state = generateStateToken();
      expect(state).not.toContain("+");
      expect(state).not.toContain("/");
      expect(state).not.toContain("=");
    });
  });

  describe("createStateCookie", () => {
    it("creates a cookie with correct format", async () => {
      const state = generateStateToken();
      const cookie = await createStateCookie(state, TEST_SECRET);

      expect(cookie).toContain("__oauth_state=");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("SameSite=None");
      expect(cookie).toContain("Path=/admin");
      expect(cookie).toContain("Max-Age=600");
    });

    it("stores an optional return path", async () => {
      const state = generateStateToken();
      const cookie = await createStateCookie(state, TEST_SECRET, "/posts/draft-post?tag=ai");
      const match = cookie.match(/__oauth_state=([^;]+)/);

      expect(match).not.toBeNull();

      const [encodedPayload] = match![1]!.split(".");
      const payload = decodeBase64UrlJson<{ state: string; returnTo: string }>(encodedPayload!);

      expect(payload).toEqual({
        state,
        returnTo: "/posts/draft-post?tag=ai",
      });
    });

    it("stores an optional nonce", async () => {
      const state = generateStateToken();
      const nonce = generateStateToken();
      const cookie = await createStateCookie(state, TEST_SECRET, undefined, nonce);
      const match = cookie.match(/__oauth_state=([^;]+)/);

      expect(match).not.toBeNull();

      const [encodedPayload] = match![1]!.split(".");
      const payload = decodeBase64UrlJson<{ state: string; nonce: string }>(encodedPayload!);

      expect(payload).toEqual({ state, nonce });
    });
  });

  describe("verifyStateToken", () => {
    it("returns true for valid state", async () => {
      const state = generateStateToken();
      const cookie = await createStateCookie(state, TEST_SECRET);
      const match = cookie.match(/__oauth_state=([^;]+)/);

      const request = new Request("https://example.com", {
        headers: { Cookie: `__oauth_state=${match![1]}` },
      });

      const result = await verifyStateToken(request, state, TEST_SECRET);
      expect(result).toEqual({ valid: true, returnTo: null, nonce: null });
    });

    it("returns false for missing state cookie", async () => {
      const state = generateStateToken();
      const request = new Request("https://example.com");

      const result = await verifyStateToken(request, state, TEST_SECRET);
      expect(result).toEqual({ valid: false, returnTo: null, nonce: null });
    });

    it("returns false for mismatched state", async () => {
      const state = generateStateToken();
      const cookie = await createStateCookie(state, TEST_SECRET);
      const match = cookie.match(/__oauth_state=([^;]+)/);

      const request = new Request("https://example.com", {
        headers: { Cookie: `__oauth_state=${match![1]}` },
      });

      const result = await verifyStateToken(request, "different-state", TEST_SECRET);
      expect(result).toEqual({ valid: false, returnTo: null, nonce: null });
    });

    it("returns false for invalid signature", async () => {
      const state = generateStateToken();
      const request = new Request("https://example.com", {
        headers: { Cookie: `__oauth_state=${state}.invalid-signature` },
      });

      const result = await verifyStateToken(request, state, TEST_SECRET);
      expect(result).toEqual({ valid: false, returnTo: null, nonce: null });
    });

    it("returns a stored return path for valid state", async () => {
      const state = generateStateToken();
      const cookie = await createStateCookie(state, TEST_SECRET, "/posts/draft-post");
      const match = cookie.match(/__oauth_state=([^;]+)/);

      const request = new Request("https://example.com", {
        headers: { Cookie: `__oauth_state=${match![1]}` },
      });

      const result = await verifyStateToken(request, state, TEST_SECRET);
      expect(result).toEqual({ valid: true, returnTo: "/posts/draft-post", nonce: null });
    });
  });

  describe("readStateCookie", () => {
    it("returns the stored state payload without needing the callback state", async () => {
      const state = generateStateToken();
      const cookie = await createStateCookie(state, TEST_SECRET, "/posts/draft-post");
      const match = cookie.match(/__oauth_state=([^;]+)/);

      const request = new Request("https://example.com", {
        headers: { Cookie: `__oauth_state=${match![1]}` },
      });

      const result = await readStateCookie(request, TEST_SECRET);
      expect(result).toEqual({ state, returnTo: "/posts/draft-post", nonce: null });
    });

    it("returns null for an invalid state cookie", async () => {
      const request = new Request("https://example.com", {
        headers: { Cookie: "__oauth_state=invalid.signature" },
      });

      const result = await readStateCookie(request, TEST_SECRET);
      expect(result).toBeNull();
    });
  });

  describe("clearStateCookie", () => {
    it("returns cookie with Max-Age=0", () => {
      const cookie = clearStateCookie();

      expect(cookie).toContain("__oauth_state=");
      expect(cookie).toContain("Max-Age=0");
      expect(cookie).toContain("Path=/admin");
    });
  });
});
