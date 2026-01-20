import type { Env } from "../types.ts";
import { verifySession } from "./session.ts";

export type AuthResult =
  | { authenticated: true; email: string }
  | { authenticated: false; redirect: Response };

export async function requireAdminAuth(request: Request, env: Env): Promise<AuthResult> {
  const session = await verifySession(request, env.SESSION_SECRET);

  if (!session) {
    return {
      authenticated: false,
      redirect: redirectToLogin(),
    };
  }

  if (session.email !== env.ADMIN_EMAIL) {
    return {
      authenticated: false,
      redirect: forbiddenResponse(),
    };
  }

  return { authenticated: true, email: session.email };
}

function redirectToLogin(): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/admin/login",
    },
  });
}

function forbiddenResponse(): Response {
  return new Response("Forbidden: You are not authorized to access the admin area.", {
    status: 403,
    headers: {
      "Content-Type": "text/plain",
    },
  });
}
