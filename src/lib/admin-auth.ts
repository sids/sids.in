import type { Env } from "../types.ts";

export function requireAdminAuth(request: Request, env: Env, realm = "Admin"): Response | null {
  const authHeader = request.headers.get("Authorization") || "";
  const [scheme, encoded] = authHeader.split(" ");
  if (scheme !== "Basic" || !encoded) {
    return unauthorizedResponse(realm);
  }

  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch (error) {
    console.warn("Invalid Basic Auth header", error);
    return unauthorizedResponse(realm);
  }
  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex === -1) {
    return unauthorizedResponse(realm);
  }

  const username = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);
  const expectedUser = env.BASIC_AUTH_USER || "sid";

  if (username !== expectedUser || password !== env.BASIC_AUTH_PASSWORD) {
    return unauthorizedResponse(realm);
  }

  return null;
}

function unauthorizedResponse(realm: string): Response {
  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${realm}"`,
    },
  });
}
