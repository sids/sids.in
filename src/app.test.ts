import { describe, expect, it } from "vitest";
import { blogHandler } from "./app.ts";
import type { Env } from "./types.ts";

describe("blogHandler static learning assets", () => {
  it("delegates /learning paths to the static assets binding", async () => {
    const request = new Request("https://sids.in/learning/effect/");
    const env = {
      ASSETS: {
        fetch: async (assetRequest: Request) => new Response(new URL(assetRequest.url).pathname),
      },
    } as unknown as Env;

    const response = await blogHandler.fetch(
      request as Request<unknown, IncomingRequestCfProperties>,
      env,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("/learning/effect/");
  });

  it("turns static asset binding failures into secure 500 responses", async () => {
    const cause = new Error("asset binding unavailable");
    const request = new Request("https://sids.in/learning/effect/");
    const env = {
      ASSETS: {
        fetch: () => Promise.reject(cause),
      },
    } as unknown as Env;

    const response = await blogHandler.fetch(
      request as Request<unknown, IncomingRequestCfProperties>,
      env,
    );

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Internal Server Error");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
