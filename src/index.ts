import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { blogHandler } from "./app.ts";
import { oauthAuthorizationHandler } from "./mcp/oauth.ts";
import { mcpHandler } from "./mcp/server.ts";
import type { Env } from "./types.ts";

const oauthProvider = new OAuthProvider<Env>({
  apiRoute: "/admin/mcp",
  apiHandler: mcpHandler,
  defaultHandler: oauthAuthorizationHandler(blogHandler),
  authorizeEndpoint: "/admin/oauth/authorize",
  tokenEndpoint: "/admin/oauth/token",
  clientRegistrationEndpoint: "/admin/oauth/register",
  scopesSupported: ["blog:read", "blog:write"],
  allowPlainPKCE: false,
  clientIdMetadataDocumentEnabled: true,
  resourceMetadata: {
    resource: "https://sids.in/admin/mcp",
    authorization_servers: ["https://sids.in"],
    scopes_supported: ["blog:read", "blog:write"],
    bearer_methods_supported: ["header"],
    resource_name: "sids.in Blog Admin",
  },
});

export default oauthProvider;
