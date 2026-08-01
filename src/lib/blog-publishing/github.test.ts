import { describe, expect, it } from "vitest";
import { GitHubPostRepository, GitHubRepositoryError } from "./github.ts";
import { preparePostDraft } from "./posts.ts";

function repository(fetcher: typeof fetch): GitHubPostRepository {
  return new GitHubPostRepository({
    owner: "sids",
    repo: "sids.in",
    token: "secret-token",
    branch: "main",
  }, fetcher);
}

describe("GitHubPostRepository", () => {
  it("creates a draft without supplying a sha, so existing paths cannot be overwritten", async () => {
    let requestBody: Record<string, unknown> | undefined;
    const repo = repository((async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/git/trees/")) {
        return Response.json({ tree: [], truncated: false });
      }
      requestBody = JSON.parse(String(init?.body));
      return Response.json({
        content: { path: "content/posts/2026/07-23-note.md", sha: "content-sha" },
        commit: { sha: "commit-sha", html_url: "https://github.com/sids/sids.in/commit/commit-sha" },
      });
    }) as unknown as typeof fetch);

    const result = await repo.createDraft({
      kind: "note",
      title: "Note",
      tags: ["ai"],
      content: "Body",
    }, { now: new Date("2026-07-23T12:00:00.000Z") });

    expect(requestBody?.sha).toBeUndefined();
    expect(atob(String(requestBody?.content))).toContain("draft: true");
    expect(result.commitSha).toBe("commit-sha");
  });

  it("maps GitHub conflicts to a path_exists error without logging credentials", async () => {
    let requestCount = 0;
    const repo = repository((async () => {
      requestCount++;
      if (requestCount === 1) {
        return Response.json({ tree: [], truncated: false });
      }
      if (requestCount === 2) {
        return new Response(JSON.stringify({ message: "already exists" }), { status: 422 });
      }
      return Response.json({
        content: btoa("different content"),
        path: "content/posts/2026/07-23-note.md",
        sha: "other-content",
      });
    }) as unknown as typeof fetch);

    try {
      await repo.createDraft({
        kind: "note",
        title: "Note",
        content: "Body",
      }, { now: new Date("2026-07-23T12:00:00.000Z") });
      throw new Error("Expected createDraft to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(GitHubRepositoryError);
      expect((error as GitHubRepositoryError).code).toBe("path_exists");
      expect(String(error)).not.toContain("secret-token");
    }
  });

  it("rejects a slug that already exists at a different dated path", async () => {
    let requestCount = 0;
    const repo = repository((async () => {
      requestCount++;
      return Response.json({
        tree: [{
          path: "content/posts/2025/01-01-note.md",
          type: "blob",
        }],
        truncated: false,
      });
    }) as unknown as typeof fetch);

    await expect(repo.createDraft({
      kind: "note",
      title: "Note",
      content: "A new body",
    }, { now: new Date("2026-07-23T12:00:00.000Z") })).rejects.toMatchObject({
      code: "path_exists",
    });
    expect(requestCount).toBe(1);
  });

  it("reconciles the exact preview when an earlier attempt already committed it", async () => {
    const now = new Date("2026-07-23T12:00:00.000Z");
    const prepared = preparePostDraft({
      kind: "note",
      title: "Note",
      content: "Body",
    }, { now });
    const requests: string[] = [];
    const repo = repository((async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      if (url.includes("/git/trees/")) {
        return Response.json({
          tree: [{ path: prepared.path, type: "blob" }],
          truncated: false,
        });
      }
      if (url.includes("/contents/")) {
        return Response.json({
          content: btoa(prepared.markdown),
          path: prepared.path,
          sha: "content-sha",
        });
      }
      return Response.json([{
        sha: "commit-sha",
        html_url: "https://github.com/sids/sids.in/commit/commit-sha",
      }]);
    }) as unknown as typeof fetch);

    const result = await repo.createDraft(prepared);

    expect(result.commitSha).toBe("commit-sha");
    expect(result.commitUrl?.endsWith("/commit/commit-sha")).toBe(true);
    expect(requests).toHaveLength(3);
    expect(requests.some((url) => url.includes("/commits?"))).toBe(true);
  });

  it("recovers when the create response is lost after GitHub accepted the write", async () => {
    const prepared = preparePostDraft({
      kind: "note",
      title: "Ambiguous write",
      content: "Exact preview",
    }, { now: new Date("2026-07-23T12:00:00.000Z") });
    let requestCount = 0;
    const repo = repository((async (input: RequestInfo | URL) => {
      requestCount++;
      const url = String(input);
      if (requestCount === 1) {
        return Response.json({ tree: [], truncated: false });
      }
      if (requestCount === 2) {
        throw new TypeError("connection closed after upload");
      }
      if (url.includes("/contents/")) {
        return Response.json({
          content: btoa(prepared.markdown),
          path: prepared.path,
          sha: "content-sha",
        });
      }
      return Response.json([{
        sha: "recovered-commit",
        html_url: "https://github.com/sids/sids.in/commit/recovered-commit",
      }]);
    }) as unknown as typeof fetch);

    const result = await repo.createDraft(prepared);

    expect(result.commitSha).toBe("recovered-commit");
    expect(requestCount).toBe(4);
  });

  it("reads the current sha before publishing a draft", async () => {
    const requests: Array<{ method: string; body?: Record<string, unknown> }> = [];
    const raw = "---\ntitle: \"Draft\"\nslug: \"draft\"\ndate: \"2026-01-01\"\ndraft: true\n---\n\nBody\n";
    const repo = repository((async (_input, init) => {
      const method = init?.method ?? "GET";
      requests.push({
        method,
        ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}),
      });
      if (method === "GET") {
        return Response.json({ content: btoa(raw), sha: "old-sha" });
      }
      return Response.json({
        content: { path: "content/posts/2026/01-01-draft.md", sha: "new-sha" },
        commit: { sha: "commit-sha" },
      });
    }) as typeof fetch);

    await repo.changePostStatus("content/posts/2026/01-01-draft.md", false, {
      now: new Date("2026-07-23T12:30:00.000Z"),
    });

    expect(requests.map((request) => request.method)).toEqual(["GET", "PUT"]);
    expect(requests[1]?.body?.sha).toBe("old-sha");
    expect(atob(String(requests[1]?.body?.content))).toContain("draft: false");
  });

  it("can move a published post back to draft state", async () => {
    const raw = "---\ntitle: \"Post\"\nslug: \"post\"\ndate: \"2026-07-23\"\ntags: [\"ai\"]\ndraft: false\n---\n\nBody\n";
    const requests: Array<{ method: string; body?: Record<string, unknown> }> = [];
    const repo = repository((async (_input, init) => {
      const method = init?.method ?? "GET";
      requests.push({ method, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
      if (method === "GET") return Response.json({ content: btoa(raw), sha: "old-sha" });
      return Response.json({ content: { path: "content/posts/2026/07-23-post.md", sha: "new-sha" }, commit: { sha: "commit-sha" } });
    }) as typeof fetch);

    await repo.changePostStatus("content/posts/2026/07-23-post.md", true);

    expect(atob(String(requests[1]?.body?.content))).toContain("draft: true");
    expect(requests[1]?.body?.sha).toBe("old-sha");
  });

  it("selectively edits fields and preserves Markdown whitespace", async () => {
    const raw = "---\ntitle: \"Old title\"\nslug: \"stable-slug\"\ndate: \"2026-07-23\"\ntags: [\"old\"]\ndraft: true\n---\n\nOld body\n";
    const requests: Array<{ method: string; body?: Record<string, unknown> }> = [];
    const repo = repository((async (_input, init) => {
      const method = init?.method ?? "GET";
      requests.push({ method, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
      if (method === "GET") return Response.json({ content: btoa(raw), sha: "old-sha" });
      return Response.json({
        content: { path: "content/posts/2026/07-23-stable-slug.md", sha: "new-sha" },
        commit: { sha: "commit-sha" },
      });
    }) as typeof fetch);

    const result = await repo.editPost("content/posts/2026/07-23-stable-slug.md", {
      title: "New title",
      tags: ["AI", "Product Building", "ai"],
      content: "    indented code\n\n",
    });

    const markdown = atob(String(requests[1]?.body?.content));
    expect(markdown).toContain('title: "New title"');
    expect(markdown).toContain('slug: "stable-slug"');
    expect(markdown).toContain('tags: ["ai", "product-building"]');
    expect(markdown.endsWith("\n\n    indented code\n\n")).toBe(true);
    expect(result.slug).toBe("stable-slug");
    expect(result.path).toBe("content/posts/2026/07-23-stable-slug.md");
  });

  it("preserves omitted fields when editing one field", async () => {
    const raw = "---\ntitle: \"Title\"\nslug: \"post\"\ntags: [\"ai\"]\ndraft: true\n---\n\nOriginal body\n";
    let updateBody: Record<string, unknown> | undefined;
    const repo = repository((async (_input, init) => {
      if (!init?.method) return Response.json({ content: btoa(raw), sha: "old-sha" });
      updateBody = JSON.parse(String(init.body));
      return Response.json({ content: { path: "content/posts/2026/07-23-post.md" }, commit: { sha: "commit-sha" } });
    }) as typeof fetch);

    await repo.editPost("content/posts/2026/07-23-post.md", { tags: [] });

    const markdown = atob(String(updateBody?.content));
    expect(markdown).toContain('title: "Title"');
    expect(markdown).toContain("tags: []");
    expect(markdown.endsWith("\n\nOriginal body\n")).toBe(true);
  });

  it("changes the slug and source path in one Git commit", async () => {
    const raw = "---\ntitle: \"Title\"\nslug: \"old-slug\"\ntags: []\ndraft: true\n---\n\nBody\n";
    const requests: Array<{ url: string; method: string; body?: Record<string, unknown> }> = [];
    const repo = repository((async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
      requests.push({ url, method, ...(body ? { body } : {}) });
      if (url.includes("/contents/")) return Response.json({ content: btoa(raw), sha: "old-blob" });
      if (url.includes("/git/trees/main?")) return Response.json({ tree: [{ path: "content/posts/2026/07-23-old-slug.md", type: "blob" }] });
      if (url.includes("/git/ref/heads/main")) return Response.json({ object: { sha: "head-sha" } });
      if (url.endsWith("/git/commits/head-sha")) return Response.json({ tree: { sha: "base-tree" } });
      if (url.endsWith("/git/blobs")) return Response.json({ sha: "new-blob" });
      if (url.endsWith("/git/trees")) return Response.json({ sha: "new-tree" });
      if (url.endsWith("/git/commits")) return Response.json({ sha: "new-commit", html_url: "https://github.com/commit/new-commit" });
      if (url.includes("/git/refs/heads/main")) return Response.json({ object: { sha: "new-commit" } });
      return new Response("unexpected request", { status: 500 });
    }) as typeof fetch);

    const result = await repo.editPost("content/posts/2026/07-23-old-slug.md", { slug: "new-slug" });

    expect(result).toMatchObject({
      path: "content/posts/2026/07-23-new-slug.md",
      slug: "new-slug",
      commitSha: "new-commit",
    });
    const treeRequest = requests.find((request) => request.url.endsWith("/git/trees") && request.method === "POST");
    expect(treeRequest?.body?.tree).toEqual([
      { path: "content/posts/2026/07-23-new-slug.md", mode: "100644", type: "blob", sha: "new-blob" },
      { path: "content/posts/2026/07-23-old-slug.md", mode: "100644", type: "blob", sha: null },
    ]);
    const blobRequest = requests.find((request) => request.url.endsWith("/git/blobs"));
    expect(String(blobRequest?.body?.content)).toContain('slug: "new-slug"');
    expect(requests.at(-1)).toMatchObject({ method: "PATCH" });
  });

});
