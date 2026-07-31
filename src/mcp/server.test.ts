import { describe, expect, it } from "bun:test";
import type { Env } from "../types.ts";
import { mcpHandler } from "./server.ts";

function context(scopes: string[] = []): ExecutionContext {
  return {
    props: { userId: "sid", scopes },
    waitUntil() {},
    passThroughOnException() {},
  } as unknown as ExecutionContext;
}

function toolRequest(path = "/admin/mcp"): Parameters<typeof mcpHandler.fetch>[0] {
  return new Request(`https://sids.in${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-06-18",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_tags", arguments: {} } }),
  }) as unknown as Parameters<typeof mcpHandler.fetch>[0];
}

const env = {} as Env;

describe("blog MCP transport", () => {
  it("serves the configured /admin/mcp route", async () => {
    const response = await mcpHandler.fetch(toolRequest(), env, context(["blog:read"]));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('"tags"');
  });

  it("does not serve the SDK default /mcp route", async () => {
    const response = await mcpHandler.fetch(toolRequest("/mcp"), env, context(["blog:read"]));
    expect(response.status).toBe(404);
  });

  it("authorizes tools from OAuth scopes carried in provider props", async () => {
    const allowed = await mcpHandler.fetch(toolRequest(), env, context(["blog:read"]));
    expect(await allowed.text()).not.toContain("insufficient_scope");

    const denied = await mcpHandler.fetch(toolRequest(), env, context(["blog:write"]));
    expect(await denied.text()).toContain("insufficient_scope");
  });
});
