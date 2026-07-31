import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler, getMcpAuthContext } from "agents/mcp/server";
import { z } from "zod";
import { allTags } from "../manifest.ts";
import type { Env } from "../types.ts";
import { GitHubPostRepository, GitHubRepositoryError, PublishingValidationError } from "../../packages/blog-publishing/src/index.ts";

const SERVER_INSTRUCTIONS = `Use this server to administer posts on sids.in.

Recommended workflow:
1. Call list_tags before choosing tags so existing normalized tags are reused when appropriate.
2. Call create_draft_post to create new content. It always creates draft=true and never publishes directly.
3. Use kind=link for commentary centered on an external URL (link is required), kind=note for an original short post, and kind=article for a long-form article. Preserve the author's Markdown exactly in content.
4. Call list_posts to find an existing post and obtain its slug or repository path. Use the draft and kind filters to narrow results.
5. Call edit_post to selectively replace a post's title, slug, tags, or Markdown content. Omitted fields remain unchanged. Changing a title alone keeps the URL stable; supply slug separately only when the URL should also change.
6. Call change_post_status only when the user wants to publish a reviewed draft or return a published post to draft. status=published updates the publication timestamp; status=draft hides the post from public lists.

Do not publish a newly created draft unless the user explicitly asks to publish it. Prefer the path returned by create_draft_post or list_posts when changing status.`;

function repository(env: Env): GitHubPostRepository {
  return new GitHubPostRepository({ owner: env.GITHUB_OWNER, repo: env.GITHUB_REPO, token: env.GITHUB_TOKEN, branch: env.GITHUB_BRANCH });
}

function createServer(env: Env) {
  const server = new McpServer(
    { name: "sids-in-blog-admin", version: "1.0.0" },
    { instructions: SERVER_INSTRUCTIONS },
  );

  server.registerTool("list_tags", {
    description: "List the normalized tags currently used by blog posts.", inputSchema: {}, annotations: { readOnlyHint: true },
  }, async () => requireScope("blog:read", async () => ({ tags: allTags })));

  server.registerTool("list_posts", {
    description: "List blog posts from the source repository, optionally filtered by draft state or kind.",
    inputSchema: { draft: z.boolean().optional(), kind: z.enum(["link", "note", "article"]).optional(), limit: z.number().int().min(1).max(40).default(25) },
    annotations: { readOnlyHint: true },
  }, async ({ draft, kind, limit }) => requireScope("blog:read", async () => {
    const posts = await repository(env).listPosts({ draft, kind, limit });
    return { posts };
  }));

  server.registerTool("create_draft_post", {
    description: "Create a new draft link, note, or article. This always writes draft=true; use change_post_status separately after review to publish it.",
    inputSchema: {
      kind: z.enum(["link", "note", "article"]), title: z.string().min(1), description: z.string().optional(),
      tags: z.array(z.string()).optional(), content: z.string().default(""),
      link: z.url().optional().describe("Required for kind=link; omit for notes and articles."),
    }, annotations: { destructiveHint: false, idempotentHint: true },
  }, async (input) => requireScope("blog:write", async () => repository(env).createDraft({ ...input, draft: true })));

  server.registerTool("change_post_status", {
    description: "Change an existing post to published or draft. Publishing updates its publication timestamp; moving to draft removes it from public post lists.",
    inputSchema: {
      slug_or_path: z.string().min(1).describe("Prefer the repository path returned by create_draft_post or list_posts."),
      status: z.enum(["draft", "published"]),
    },
    annotations: { destructiveHint: false, idempotentHint: true },
  }, async ({ slug_or_path, status }) => requireScope(
    "blog:write",
    async () => repository(env).setDraftState(slug_or_path, status === "draft"),
  ));

  server.registerTool("edit_post", {
    description: "Selectively edit an existing post's title, slug, tags, or Markdown content. Omitted fields are preserved. Changing the slug also changes the public URL and renames the source file.",
    inputSchema: {
      slug_or_path: z.string().min(1).describe("Prefer the repository path returned by create_draft_post or list_posts."),
      title: z.string().min(1).optional(),
      slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional().describe("New normalized slug. Changes the public URL and source path."),
      tags: z.array(z.string()).optional().describe("Replaces the complete tag list; pass [] to remove all tags."),
      content: z.string().optional().describe("Replaces the complete Markdown body without changing frontmatter."),
    },
    annotations: { destructiveHint: false, idempotentHint: true },
  }, async ({ slug_or_path, title, slug, tags, content }) => requireScope(
    "blog:write",
    async () => repository(env).editPost(slug_or_path, { title, slug, tags, content }),
  ));
  return server;
}

function result(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }], structuredContent: value as Record<string, unknown> };
}

async function run(operation: () => Promise<unknown>) {
  try { return result(await operation()); }
  catch (error) {
    if (error instanceof PublishingValidationError || error instanceof GitHubRepositoryError) {
      return { ...result({ error: error.code, message: error.message }), isError: true };
    }
    console.error("MCP blog tool failed", error);
    return { ...result({ error: "internal_error", message: "The blog operation failed" }), isError: true };
  }
}

function requireScope(scope: string, operation: () => Promise<unknown>) {
  const granted = getMcpAuthContext()?.props.scopes;
  if (!Array.isArray(granted) || !granted.includes(scope)) {
    return Promise.resolve({ ...result({ error: "insufficient_scope", message: `This tool requires ${scope}` }), isError: true });
  }
  return run(operation);
}

export const mcpHandler = {
  fetch(request, env, ctx) {
    const props = readOAuthProps(ctx);
    return createMcpHandler(() => createServer(env), {
      route: "/admin/mcp",
      authContext: { props },
    })(request, env, ctx);
  },
} satisfies Pick<Required<ExportedHandler<Env>>, "fetch">;

function readOAuthProps(ctx: ExecutionContext): Record<string, unknown> {
  const props = (ctx as ExecutionContext & { props?: unknown }).props;
  return props !== null && typeof props === "object" ? props as Record<string, unknown> : {};
}
