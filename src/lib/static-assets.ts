import { Effect } from "effect";
import type { Env } from "../types.ts";

const IMMUTABLE_STATIC_PATHS = ["/fonts/", "/js/"];
const VERSIONED_STATIC_PATHS = ["/css/", "/images/"];

export class StaticAssetFetchError extends Error {
  readonly _tag = "StaticAssetFetchError";

  constructor(readonly cause: unknown) {
    super("Could not fetch a static asset");
    this.name = "StaticAssetFetchError";
  }
}

function isImmutableStaticAsset(url: URL): boolean {
  return IMMUTABLE_STATIC_PATHS.some((prefix) => url.pathname.startsWith(prefix)) ||
    (url.searchParams.has("v") && VERSIONED_STATIC_PATHS.some((prefix) => url.pathname.startsWith(prefix)));
}

export function fetchStaticAsset(
  request: Request,
  env: Env,
  url: URL,
): Effect.Effect<Response, StaticAssetFetchError> {
  return Effect.tryPromise({
    try: () => env.ASSETS.fetch(request),
    catch: (cause) => new StaticAssetFetchError(cause),
  }).pipe(
    Effect.map((response) => {
      if (response.status !== 200 || !isImmutableStaticAsset(url)) return response;

      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }),
  );
}
