export const MCP_ROUTE = "/admin/mcp";
export const OAUTH_AUTHORIZE_ROUTE = "/admin/oauth/authorize";
export const OAUTH_TOKEN_ROUTE = "/admin/oauth/token";
export const OAUTH_REGISTER_ROUTE = "/admin/oauth/register";

export const BLOG_SCOPES = ["blog:read", "blog:write"] as const;
export type BlogScope = typeof BLOG_SCOPES[number];

export function isBlogScope(scope: string): scope is BlogScope {
  return BLOG_SCOPES.some((allowed) => allowed === scope);
}
