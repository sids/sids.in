import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { blogHandler } from "./app.ts";
import { oauthAuthorizationHandler } from "./mcp/oauth.ts";
import { mcpHandler } from "./mcp/server.ts";
import {
  BLOG_SCOPES,
  MCP_ROUTE,
  OAUTH_AUTHORIZE_ROUTE,
  OAUTH_REGISTER_ROUTE,
  OAUTH_TOKEN_ROUTE,
} from "./mcp/config.ts";
import type { Env } from "./types.ts";

const oauthProvider = new OAuthProvider<Env>({
  apiRoute: MCP_ROUTE,
  apiHandler: mcpHandler,
  defaultHandler: oauthAuthorizationHandler(blogHandler),
  authorizeEndpoint: OAUTH_AUTHORIZE_ROUTE,
  tokenEndpoint: OAUTH_TOKEN_ROUTE,
  clientRegistrationEndpoint: OAUTH_REGISTER_ROUTE,
  scopesSupported: [...BLOG_SCOPES],
  allowPlainPKCE: false,
  clientIdMetadataDocumentEnabled: true,
  resourceMetadata: {
    resource: `https://sids.in${MCP_ROUTE}`,
    authorization_servers: ["https://sids.in"],
    scopes_supported: [...BLOG_SCOPES],
    bearer_methods_supported: ["header"],
    resource_name: "sids.in Blog Admin",
  },
});

export default oauthProvider;
