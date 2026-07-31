import type { AuthRequest, ClientInfo } from "@cloudflare/workers-oauth-provider";
import type { Env } from "../types.ts";
import { requireAdminAuth } from "../lib/admin-auth.ts";

const AUTHORIZE_PATH = "/admin/oauth/authorize";
const CSRF_COOKIE = "__Host-MCP_CSRF";
const ALLOWED_SCOPES = new Set(["blog:read", "blog:write"]);

type FetchHandler = Pick<Required<ExportedHandler<Env>>, "fetch">;

export function oauthAuthorizationHandler(fallback: FetchHandler): FetchHandler {
  return {
    async fetch(request, env, ctx): Promise<Response> {
      const url = new URL(request.url);
      if (url.pathname !== AUTHORIZE_PATH) return fallback.fetch(request, env, ctx);
      if (request.method !== "GET" && request.method !== "POST") {
        return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, POST" } });
      }

      let oauthRequest: AuthRequest;
      try {
        oauthRequest = await env.OAUTH_PROVIDER.parseAuthRequest(request);
      } catch {
        return privateText("Invalid authorization request", 400);
      }

      const auth = await requireAdminAuth(request, env);
      if (!auth.authenticated) {
        const returnTo = `${url.pathname}${url.search}`;
        return Response.redirect(`${url.origin}/admin/login?returnTo=${encodeURIComponent(returnTo)}`, 302);
      }

      const client = await env.OAUTH_PROVIDER.lookupClient(oauthRequest.clientId);
      if (!client) return privateText("Unknown OAuth client", 400);

      if (request.method === "GET") {
        const csrf = crypto.randomUUID();
        return consentPage(oauthRequest, client, csrf);
      }

      const form = await request.formData();
      if (!validCsrf(request, form)) return privateText("Invalid or expired consent request", 400);
      if (form.get("decision") !== "approve") return oauthDenied(oauthRequest);

      const scope = oauthRequest.scope.filter((item) => ALLOWED_SCOPES.has(item));
      const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
        request: oauthRequest,
        userId: env.ADMIN_EMAIL,
        scope,
        metadata: { clientName: client.clientName ?? "MCP client" },
        props: { userId: env.ADMIN_EMAIL, scopes: scope },
      });
      return new Response(null, {
        status: 302,
        headers: { Location: redirectTo, "Set-Cookie": clearCsrfCookie() },
      });
    },
  };
}

function consentPage(request: AuthRequest, client: ClientInfo, csrf: string): Response {
  const name = escapeHtml(client.clientName || "An MCP client");
  const scopes = request.scope.filter((scope) => ALLOWED_SCOPES.has(scope));
  const scopeItems = scopes.map((scope) => `<li><strong>${escapeHtml(scope)}</strong> — ${scope === "blog:write" ? "Create, publish, and change posts" : "Read posts and tags"}</li>`).join("");
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Authorize blog access</title></head><body><main><h1>Authorize ${name}?</h1><p>This client is requesting access to the sids.in blog admin.</p><ul>${scopeItems}</ul><form method="post"><input type="hidden" name="csrf_token" value="${csrf}"><button name="decision" value="approve">Authorize</button><button name="decision" value="deny">Deny</button></form></main></body></html>`;
  return new Response(body, { headers: {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "private, no-store",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Set-Cookie": `${CSRF_COOKIE}=${csrf}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=600`,
  } });
}

function validCsrf(request: Request, form: FormData): boolean {
  const submitted = form.get("csrf_token");
  const cookie = request.headers.get("Cookie")?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${CSRF_COOKIE}=`))?.slice(CSRF_COOKIE.length + 1);
  return typeof submitted === "string" && Boolean(cookie) && submitted === cookie;
}

function oauthDenied(request: AuthRequest): Response {
  const redirect = new URL(request.redirectUri);
  redirect.searchParams.set("error", "access_denied");
  redirect.searchParams.set("state", request.state);
  return new Response(null, { status: 302, headers: { Location: redirect.toString(), "Set-Cookie": clearCsrfCookie() } });
}

function clearCsrfCookie(): string {
  return `${CSRF_COOKIE}=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`;
}

function privateText(message: string, status: number): Response {
  return new Response(message, { status, headers: { "Cache-Control": "private, no-store" } });
}

function escapeHtml(value: string): string {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/g, (character) => entities[character]!);
}
