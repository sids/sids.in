import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { Env } from "../types.ts";
import { fetchStaticAsset, StaticAssetFetchError } from "./static-assets.ts";

function envWithAssetFetch(fetch: (request: Request) => Promise<Response>): Env {
  return { ASSETS: { fetch } } as unknown as Env;
}

describe("fetchStaticAsset", () => {
  it("does not fetch until the Effect is run", async () => {
    let fetchCount = 0;
    const request = new Request("https://sids.in/fonts/geist.woff2");
    const env = envWithAssetFetch(async () => {
      fetchCount += 1;
      return new Response("font");
    });

    const program = fetchStaticAsset(request, env, new URL(request.url));

    expect(fetchCount).toBe(0);
    const response = await Effect.runPromise(program);
    expect(fetchCount).toBe(1);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
  });

  it("maps a rejected asset fetch to a typed error", async () => {
    const cause = new Error("asset binding unavailable");
    const request = new Request("https://sids.in/images/photo.jpg?v=1");
    const env = envWithAssetFetch(() => Promise.reject(cause));

    const error = await Effect.runPromise(
      fetchStaticAsset(request, env, new URL(request.url)).pipe(Effect.flip),
    );

    expect(error).toBeInstanceOf(StaticAssetFetchError);
    expect(error.cause).toBe(cause);
  });
});
