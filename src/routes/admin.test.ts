import { describe, expect, it } from "bun:test";
import { publishDraftMarkdown, routeAdmin } from "./admin.ts";
import { createSessionCookie, createStateCookie, generateStateToken } from "../lib/session.ts";
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
      expect(await response!.json()).toEqual({ error: "Invalid URL" });
      expect(fetchedTargets).toEqual(["https://example.com/"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects link-log submissions with unsafe URL schemes", async () => {
    const originalFetch = globalThis.fetch;
    const sessionCookie = await createSessionCookie(TEST_ENV.ADMIN_EMAIL, TEST_SECRET);
    let fetchCalled = false;

    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response(null, { status: 500 });
    }) as typeof fetch;

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
      expect(await response!.json()).toEqual({ error: "Invalid URL" });
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
