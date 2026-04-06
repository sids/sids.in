import { describe, expect, it } from "bun:test";
import { routeAdmin } from "./admin.ts";
import { createStateCookie, generateStateToken } from "../lib/session.ts";
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
