import { describe, expect, it } from "bun:test";
import fm from "front-matter";
import { publishDraftMarkdown, routeAdmin } from "./admin.ts";
import { createSessionCookie, createStateCookie, generateStateToken, readStateCookie } from "../lib/session.ts";
import type { Env } from "../types.ts";

const TEST_SECRET = "test-secret-key-32-chars-long!!!";

const TEST_ENV: Env = {
  ASSETS: {} as Fetcher,
  GITHUB_TOKEN: "token",
  GITHUB_OWNER: "owner",
  GITHUB_REPO: "repo",
  APPLE_CLIENT_ID: "client-id",
  APPLE_TEAM_ID: "team-id",
  APPLE_KEY_ID: "key-id",
  APPLE_PRIVATE_KEY: "private-key",
  SESSION_SECRET: TEST_SECRET,
  ADMIN_EMAIL: "admin@example.com",
};

function base64DecodeUtf8(value: string): string {
  const binary = atob(value.replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

describe("admin authoring dates", () => {
  it("creates note posts with a timestamped frontmatter date", async () => {
    const originalFetch = globalThis.fetch;
    const sessionCookie = await createSessionCookie(TEST_ENV.ADMIN_EMAIL, TEST_SECRET);
    let githubRequestBody: { content: string } | null = null;

    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      githubRequestBody = JSON.parse(String(init?.body)) as { content: string };
      return new Response(JSON.stringify({ content: { path: "content/posts/2026/04-25-timestamped-note.md" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const request = new Request("https://example.com/admin/api/note", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: sessionCookie.split(";")[0]!,
        },
        body: JSON.stringify({ title: "Timestamped Note", tags: 'AI, x" onmouseover="alert(1), ai', content: "Body" }),
      });

      const response = await routeAdmin("/admin/api/note", request, TEST_ENV, "https://example.com", false);

      expect(response).not.toBeNull();
      expect(response!.status).toBe(200);
      const payload = await response!.json<{ date: string }>();
      expect(payload.date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(githubRequestBody).not.toBeNull();
      const markdown = atob(githubRequestBody!.content);
      expect(markdown).toContain(`date: "${payload.date}"`);
      expect(markdown).toContain('tags: ["ai", "x-onmouseover-alert-1"]');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("writes frontmatter values as YAML-safe quoted scalars", async () => {
    const originalFetch = globalThis.fetch;
    const sessionCookie = await createSessionCookie(TEST_ENV.ADMIN_EMAIL, TEST_SECRET);
    let githubRequestBody: { content: string } | null = null;
    const title = "Quote \" Backslash \\ Colon: # Hash\nInjected: true";
    const description = "Summary with \"quote\"\nsecond line \\ slash # not comment";

    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      githubRequestBody = JSON.parse(String(init?.body)) as { content: string };
      return new Response(JSON.stringify({ content: { path: "content/posts/2026/04-25-quote-backslash-colon-hash-injected-true.md" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const request = new Request("https://example.com/admin/api/note", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: sessionCookie.split(";")[0]!,
        },
        body: JSON.stringify({ title, description, tags: ["ai"], content: "Body" }),
      });

      const response = await routeAdmin("/admin/api/note", request, TEST_ENV, "https://example.com", false);

      expect(response).not.toBeNull();
      expect(response!.status).toBe(200);
      expect(githubRequestBody).not.toBeNull();
      const markdown = base64DecodeUtf8(githubRequestBody!.content);
      const parsed = fm<{
        title: string;
        slug: string;
        description: string;
        tags: string[];
        draft: boolean;
      }>(markdown);
      expect(parsed.attributes.title).toBe(title);
      expect(parsed.attributes.slug).toBe("quote-backslash-colon-hash-injected-true");
      expect(parsed.attributes.description).toBe(description);
      expect(parsed.attributes.tags).toEqual(["ai"]);
      expect(parsed.attributes.draft).toBe(false);
      expect(markdown).not.toContain("\nInjected: true\n");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects titles that cannot produce a slug", async () => {
    const originalFetch = globalThis.fetch;
    const sessionCookie = await createSessionCookie(TEST_ENV.ADMIN_EMAIL, TEST_SECRET);
    let fetchCalled = false;

    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response(null, { status: 500 });
    }) as unknown as typeof fetch;

    try {
      const request = new Request("https://example.com/admin/api/note", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: sessionCookie.split(";")[0]!,
        },
        body: JSON.stringify({ title: "💬✨", content: "Body" }),
      });

      const response = await routeAdmin("/admin/api/note", request, TEST_ENV, "https://example.com", false);

      expect(response).not.toBeNull();
      expect(response!.status).toBe(400);
      expect(await response!.json() as unknown).toEqual({ error: "Title must contain letters or numbers" });
      expect(fetchCalled).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects metadata redirects to private targets", async () => {
    const originalFetch = globalThis.fetch;
    const sessionCookie = await createSessionCookie(TEST_ENV.ADMIN_EMAIL, TEST_SECRET);
    const fetchedTargets: string[] = [];

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.hostname === "cloudflare-dns.com") {
        const type = url.searchParams.get("type");
        const answers = type === "A" ? [{ data: "93.184.216.34" }] : [];
        return Response.json({ Answer: answers });
      }

      fetchedTargets.push(url.toString());
      return new Response(null, {
        status: 302,
        headers: {
          Location: "http://127.0.0.1/admin",
        },
      });
    }) as typeof fetch;

    try {
      const request = new Request("https://example.com/admin/api/link-log/metadata?url=https%3A%2F%2Fexample.com%2F", {
        method: "GET",
        headers: {
          Cookie: sessionCookie.split(";")[0]!,
        },
      });

      const response = await routeAdmin("/admin/api/link-log/metadata", request, TEST_ENV, "https://example.com", false);

      expect(response).not.toBeNull();
      expect(response!.status).toBe(400);
      expect(await response!.json() as unknown).toEqual({ error: "Invalid URL" });
      expect(fetchedTargets).toEqual(["https://example.com/"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects metadata responses that are not HTML", async () => {
    const originalFetch = globalThis.fetch;
    const sessionCookie = await createSessionCookie(TEST_ENV.ADMIN_EMAIL, TEST_SECRET);

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.hostname === "cloudflare-dns.com") {
        const type = url.searchParams.get("type");
        const answers = type === "A" ? [{ data: "93.184.216.34" }] : [];
        return Response.json({ Answer: answers });
      }

      return new Response("not html", {
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const request = new Request("https://example.com/admin/api/link-log/metadata?url=https%3A%2F%2Fexample.com%2F", {
        method: "GET",
        headers: {
          Cookie: sessionCookie.split(";")[0]!,
        },
      });

      const response = await routeAdmin("/admin/api/link-log/metadata", request, TEST_ENV, "https://example.com", false);

      expect(response).not.toBeNull();
      expect(response!.status).toBe(415);
      expect(await response!.json() as unknown).toEqual({ error: "URL did not return HTML" });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects metadata responses that are too large", async () => {
    const originalFetch = globalThis.fetch;
    const sessionCookie = await createSessionCookie(TEST_ENV.ADMIN_EMAIL, TEST_SECRET);

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.hostname === "cloudflare-dns.com") {
        const type = url.searchParams.get("type");
        const answers = type === "A" ? [{ data: "93.184.216.34" }] : [];
        return Response.json({ Answer: answers });
      }

      return new Response(`<html>${"x".repeat(300 * 1024)}</html>`, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }) as typeof fetch;

    try {
      const request = new Request("https://example.com/admin/api/link-log/metadata?url=https%3A%2F%2Fexample.com%2F", {
        method: "GET",
        headers: {
          Cookie: sessionCookie.split(";")[0]!,
        },
      });

      const response = await routeAdmin("/admin/api/link-log/metadata", request, TEST_ENV, "https://example.com", false);

      expect(response).not.toBeNull();
      expect(response!.status).toBe(413);
      expect(await response!.json() as unknown).toEqual({ error: "Response too large" });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("cancels stalled metadata response bodies when the timeout expires", async () => {
    const originalFetch = globalThis.fetch;
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    const sessionCookie = await createSessionCookie(TEST_ENV.ADMIN_EMAIL, TEST_SECRET);
    let timeoutCallback: (() => void) | null = null;
    let timeoutDelay: number | undefined;
    let streamCancelled = false;
    let streamPulled = false;

    globalThis.setTimeout = ((handler: string | ((...args: unknown[]) => void), delay?: number, ...args: unknown[]) => {
      timeoutDelay = delay;
      timeoutCallback = () => {
        if (typeof handler === "function") {
          handler(...args);
        }
      };
      return 1;
    }) as typeof setTimeout;
    globalThis.clearTimeout = (() => {}) as typeof clearTimeout;

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.hostname === "cloudflare-dns.com") {
        const type = url.searchParams.get("type");
        const answers = type === "A" ? [{ data: "93.184.216.34" }] : [];
        return Response.json({ Answer: answers });
      }

      return new Response(new ReadableStream<Uint8Array>({
        pull() {
          streamPulled = true;
          timeoutCallback?.();
          return new Promise(() => {});
        },
        cancel() {
          streamCancelled = true;
        },
      }), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }) as typeof fetch;

    try {
      const request = new Request("https://example.com/admin/api/link-log/metadata?url=https%3A%2F%2Fexample.com%2F", {
        method: "GET",
        headers: {
          Cookie: sessionCookie.split(";")[0]!,
        },
      });

      const response = await routeAdmin("/admin/api/link-log/metadata", request, TEST_ENV, "https://example.com", false);

      expect(response).not.toBeNull();
      expect(response!.status).toBe(504);
      expect(await response!.json() as unknown).toEqual({ error: "URL fetch timed out" });
      expect(timeoutDelay).toBe(5000);
      expect(streamPulled).toBe(true);
      expect(streamCancelled).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
    }
  });

  it("rejects link-log submissions with unsafe URL schemes", async () => {
    const originalFetch = globalThis.fetch;
    const sessionCookie = await createSessionCookie(TEST_ENV.ADMIN_EMAIL, TEST_SECRET);
    let fetchCalled = false;

    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response(null, { status: 500 });
    }) as unknown as typeof fetch;

    try {
      const request = new Request("https://example.com/admin/api/link-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: sessionCookie.split(";")[0]!,
        },
        body: JSON.stringify({ title: "Unsafe", url: "javascript:alert(1)", content: "Body" }),
      });

      const response = await routeAdmin("/admin/api/link-log", request, TEST_ENV, "https://example.com", false);

      expect(response).not.toBeNull();
      expect(response!.status).toBe(400);
      expect(await response!.json() as unknown).toEqual({ error: "Invalid URL" });
      expect(fetchCalled).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("sets draft false and replaces the frontmatter date with the publish timestamp", () => {
    const markdown = `---\ntitle: "Draft"\nslug: "draft"\ndate: "2026-03-09"\ndraft: true\n---\n\nBody\n`;

    const result = publishDraftMarkdown(markdown, "2026-04-25T09:03:29.000Z");

    expect(result).not.toBeNull();
    expect(result).toContain('date: "2026-04-25T09:03:29.000Z"');
    expect(result).toContain("draft: false");
    expect(result).not.toContain("draft: true");
  });
});

describe("routeAdmin routing", () => {
  it("does not treat non-admin path prefixes as admin routes", async () => {
    const request = new Request("https://example.com/administrator");
    const env = { ...TEST_ENV, SESSION_SECRET: undefined as unknown as string };

    const response = await routeAdmin("/administrator", request, env, "https://example.com", false);

    expect(response).toBeNull();
  });
});

describe("routeAdmin cache headers", () => {
  it("does not allow shared caching for the login page", async () => {
    const request = new Request("https://example.com/admin/login");

    const response = await routeAdmin("/admin/login", request, TEST_ENV, "https://example.com", false);

    expect(response).not.toBeNull();
    expect(response!.status).toBe(200);
    expect(response!.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response!.headers.get("ETag")).toBeNull();
  });

  it("does not allow shared caching for authenticated admin pages", async () => {
    const sessionCookie = await createSessionCookie(TEST_ENV.ADMIN_EMAIL, TEST_SECRET);
    const request = new Request("https://example.com/admin", {
      headers: {
        Cookie: sessionCookie.split(";")[0]!,
      },
    });

    const response = await routeAdmin("/admin", request, TEST_ENV, "https://example.com", false);

    expect(response).not.toBeNull();
    expect(response!.status).toBe(200);
    expect(response!.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response!.headers.get("ETag")).toBeNull();
  });
});

describe("routeAdmin session secret configuration", () => {
  it("fails closed when SESSION_SECRET is missing", async () => {
    const request = new Request("https://example.com/admin");
    const env = { ...TEST_ENV, SESSION_SECRET: undefined as unknown as string };

    const response = await routeAdmin("/admin", request, env, "https://example.com", false);

    expect(response).not.toBeNull();
    expect(response!.status).toBe(500);
    expect(await response!.text()).toBe("Admin is not configured correctly.");
    expect(response!.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("fails closed when SESSION_SECRET is too short", async () => {
    const request = new Request("https://example.com/admin/login", {
      method: "POST",
      body: new FormData(),
    });
    const env = { ...TEST_ENV, SESSION_SECRET: "short" };

    const response = await routeAdmin("/admin/login", request, env, "https://example.com", false);

    expect(response).not.toBeNull();
    expect(response!.status).toBe(500);
    expect(response!.headers.get("Location")).toBeNull();
  });
});

describe("routeAdmin login", () => {
  it("sends a nonce to Apple and stores it in the signed state cookie", async () => {
    const formData = new FormData();
    formData.set("returnTo", "/admin");
    const request = new Request("https://example.com/admin/login", {
      method: "POST",
      body: formData,
    });

    const response = await routeAdmin("/admin/login", request, TEST_ENV, "https://example.com", false);

    expect(response).not.toBeNull();
    expect(response!.status).toBe(302);

    const location = response!.headers.get("Location");
    expect(location).not.toBeNull();
    const authUrl = new URL(location!);
    const nonce = authUrl.searchParams.get("nonce");
    expect(nonce).toBeTruthy();

    const setCookie = response!.headers.get("Set-Cookie");
    expect(setCookie).not.toBeNull();
    const cookieValue = setCookie!.match(/__oauth_state=([^;]+)/)![1]!;
    const stateRequest = new Request("https://example.com/admin/callback", {
      headers: { Cookie: `__oauth_state=${cookieValue}` },
    });
    const statePayload = await readStateCookie(stateRequest, TEST_SECRET);
    expect(statePayload?.nonce).toBe(nonce);
  });
});

describe("routeAdmin callback errors", () => {
  it("preserves returnTo when Apple posts back an OAuth error", async () => {
    const state = generateStateToken();
    const cookie = await createStateCookie(state, TEST_SECRET, "/posts/draft-post");
    const match = cookie.match(/__oauth_state=([^;]+)/);
    const formData = new FormData();
    formData.set("error", "access_denied");
    formData.set("error_description", "User canceled");

    const request = new Request("https://example.com/admin/callback", {
      method: "POST",
      body: formData,
      headers: {
        Cookie: `__oauth_state=${match![1]}`,
      },
    });

    const response = await routeAdmin("/admin/callback", request, TEST_ENV, "https://example.com", false);

    expect(response).not.toBeNull();
    expect(response!.status).toBe(302);
    expect(response!.headers.get("Location")).toBe("/admin/login?error=User+canceled&returnTo=%2Fposts%2Fdraft-post");
  });

  it("preserves returnTo when the callback is missing code or state", async () => {
    const state = generateStateToken();
    const cookie = await createStateCookie(state, TEST_SECRET, "/posts/draft-post?tag=ai");
    const match = cookie.match(/__oauth_state=([^;]+)/);
    const formData = new FormData();

    const request = new Request("https://example.com/admin/callback", {
      method: "POST",
      body: formData,
      headers: {
        Cookie: `__oauth_state=${match![1]}`,
      },
    });

    const response = await routeAdmin("/admin/callback", request, TEST_ENV, "https://example.com", false);

    expect(response).not.toBeNull();
    expect(response!.status).toBe(302);
    expect(response!.headers.get("Location")).toBe(
      "/admin/login?error=Missing+code+or+state&returnTo=%2Fposts%2Fdraft-post%3Ftag%3Dai",
    );
  });
});
