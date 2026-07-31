import {
  formatIstDateTime,
  preparePostDraft,
  publishDraftMarkdown,
  slugify,
  PublishingValidationError,
  type PostDraftInput,
  type PreparedPost,
} from "./posts.ts";
import { normalizeTags } from "../tags.ts";

export interface GitHubRepositoryConfig {
  owner: string;
  repo: string;
  token: string;
  branch?: string;
  committer?: {
    name: string;
    email: string;
  };
}

export interface CreateDraftResult {
  path: string;
  slug: string;
  date: string;
  contentSha?: string;
  commitSha?: string;
  commitUrl?: string;
}

export interface ChangePostStatusResult {
  path: string;
  date: string;
  contentSha?: string;
  commitSha?: string;
  commitUrl?: string;
}

export interface EditPostResult {
  path: string;
  slug: string;
  contentSha?: string;
  commitSha?: string;
  commitUrl?: string;
}

export type GitHubRepositoryErrorCode =
  | "missing_configuration"
  | "path_exists"
  | "not_found"
  | "not_a_draft"
  | "github_error";

export class GitHubRepositoryError extends Error {
  constructor(
    message: string,
    readonly code: GitHubRepositoryErrorCode,
    readonly status?: number,
  ) {
    super(message);
    this.name = "GitHubRepositoryError";
  }
}

export class GitHubPostRepository {
  private readonly branch: string;
  private readonly committer: { name: string; email: string };

  constructor(
    private readonly config: GitHubRepositoryConfig,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    if (!config.owner || !config.repo || !config.token) {
      throw new GitHubRepositoryError("Missing GitHub configuration", "missing_configuration");
    }

    this.branch = config.branch || "main";
    this.committer = config.committer ?? {
      name: "Admin Bot",
      email: "admin@users.noreply.github.com",
    };
  }

  async createDraft(
    input: PostDraftInput | PreparedPost,
    options: { now?: Date; message?: string } = {},
  ): Promise<CreateDraftResult> {
    const prepared = "markdown" in input ? input : preparePostDraft(input, { now: options.now });
    const existingPath = await this.findPostPathBySlug(prepared.slug);
    if (existingPath) {
      const recovered = existingPath === prepared.path
        ? await this.readMatchingDraft(prepared)
        : null;
      if (recovered) {
        return recovered;
      }
      throw this.pathExistsError(prepared, existingPath);
    }

    let response: Response;
    try {
      response = await this.fetcher(this.contentsUrl(prepared.path), {
        method: "PUT",
        headers: this.headers(),
        body: JSON.stringify({
          message: options.message ?? `Add ${prepared.kind} draft: ${prepared.slug}`,
          content: base64EncodeUtf8(prepared.markdown),
          branch: this.branch,
          committer: this.committer,
        }),
      });
    } catch (error) {
      const recovered = await this.readMatchingDraft(prepared);
      if (recovered) {
        return recovered;
      }
      console.error("GitHub draft creation failed", {
        path: prepared.path,
        error,
      });
      throw new GitHubRepositoryError("Failed to create post", "github_error");
    }

    if (!response.ok) {
      const details = await response.text();
      if (response.status === 409 || response.status === 422) {
        const recovered = await this.readMatchingDraft(prepared);
        if (recovered) {
          return recovered;
        }
        throw this.pathExistsError(prepared, prepared.path, response.status);
      }
      console.error("GitHub draft creation failed", {
        status: response.status,
        path: prepared.path,
        response: details,
      });
      throw new GitHubRepositoryError("Failed to create post", "github_error", response.status);
    }

    try {
      const result = await response.json() as GitHubCreateFileResponse;
      if (!result.commit?.sha) {
        const recovered = await this.readMatchingDraft(prepared);
        if (recovered) {
          return recovered;
        }
        throw new GitHubRepositoryError(
          "GitHub did not return the draft commit",
          "github_error",
          response.status,
        );
      }
      return this.createResult(prepared, result);
    } catch (error) {
      if (error instanceof GitHubRepositoryError) {
        throw error;
      }
      const recovered = await this.readMatchingDraft(prepared);
      if (recovered) {
        return recovered;
      }
      console.error("GitHub draft creation response was invalid", {
        path: prepared.path,
        error,
      });
      throw new GitHubRepositoryError(
        "GitHub returned an invalid draft response",
        "github_error",
        response.status,
      );
    }
  }

  async changePostStatus(
    slugOrPath: string,
    draft: boolean,
    options: { now?: Date; message?: string } = {},
  ): Promise<ChangePostStatusResult> {
    const path = slugOrPath.includes("/")
      ? validatePostPath(slugOrPath)
      : await this.findPostPathBySlug(slugOrPath);
    if (!path) {
      throw new GitHubRepositoryError("Post not found", "not_found", 404);
    }

    const file = await this.readPostFile(path);
    const draftMatch = /^draft:\s*(true|false)\s*$/m.exec(file.raw);
    if (!draftMatch) throw new GitHubRepositoryError("Draft flag not found", "not_a_draft");
    const current = draftMatch[1] === "true";
    if (current === draft) {
      return { path, date: extractFrontmatterScalar(file.raw, "date") ?? "" };
    }

    const date = draft
      ? extractFrontmatterScalar(file.raw, "date") ?? ""
      : formatIstDateTime(options.now);
    const next = draft
      ? file.raw.replace(/^draft:\s*false\s*$/m, "draft: true")
      : publishDraftMarkdown(file.raw, date)!;
    const slug = extractFrontmatterScalar(file.raw, "slug") ?? postSlugFromPath(path)!;
    const result = await this.updatePostFile(
      path,
      file.sha,
      next,
      options.message ?? `${draft ? "Mark as draft" : "Publish post"}: ${slug}`,
    );
    return {
      path: result.content?.path || path,
      date,
      contentSha: result.content?.sha,
      commitSha: result.commit?.sha,
      commitUrl: result.commit?.html_url,
    };
  }

  async editPost(
    slugOrPath: string,
    changes: { title?: string; slug?: string; tags?: unknown; content?: string },
    options: { message?: string } = {},
  ): Promise<EditPostResult> {
    const hasTitle = changes.title !== undefined;
    const hasSlug = changes.slug !== undefined;
    const hasTags = changes.tags !== undefined;
    const hasContent = changes.content !== undefined;
    if (!hasTitle && !hasSlug && !hasTags && !hasContent) {
      throw new PublishingValidationError("Provide at least one field to edit", "missing_changes");
    }

    const path = slugOrPath.includes("/")
      ? validatePostPath(slugOrPath)
      : await this.findPostPathBySlug(slugOrPath);
    if (!path) throw new GitHubRepositoryError("Post not found", "not_found", 404);

    const file = await this.readPostFile(path);
    let next = file.raw;

    if (hasTitle) {
      const title = changes.title!.trim();
      if (!title) throw new PublishingValidationError("Missing title", "missing_title");
      next = replaceFrontmatterField(next, "title", JSON.stringify(title));
    }
    let nextPath = path;
    if (hasSlug) {
      const slug = changes.slug!.trim();
      if (!slug || slugify(slug) !== slug) {
        throw new PublishingValidationError("Slug must use lowercase letters, numbers, and hyphens", "invalid_slug");
      }
      const currentSlug = extractFrontmatterScalar(next, "slug") ?? postSlugFromPath(path)!;
      if (slug !== currentSlug) {
        const existingPath = await this.findPostPathBySlug(slug);
        if (existingPath && existingPath !== path) {
          throw new GitHubRepositoryError(`A post already exists with slug ${slug}`, "path_exists");
        }
        next = replaceFrontmatterField(next, "slug", JSON.stringify(slug));
        nextPath = postPathWithSlug(path, slug);
      }
    }
    if (hasTags) {
      const tags = normalizeTags(changes.tags);
      next = replaceFrontmatterField(next, "tags", `[${tags.map((tag) => JSON.stringify(tag)).join(", ")}]`);
    }
    if (hasContent) next = replaceMarkdownBody(next, changes.content!);

    const slug = extractFrontmatterScalar(next, "slug") ?? postSlugFromPath(path)!;
    if (nextPath !== path) {
      return this.commitRenamedPost(path, nextPath, slug, next, options.message);
    }
    if (next === file.raw) return { path, slug };
    const result = await this.updatePostFile(path, file.sha, next, options.message ?? `Edit post: ${slug}`);
    return {
      path: result.content?.path || path,
      slug,
      contentSha: result.content?.sha,
      commitSha: result.commit?.sha,
      commitUrl: result.commit?.html_url,
    };
  }

  private contentsUrl(path: string): string {
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    return `https://api.github.com/repos/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(this.config.repo)}/contents/${encodedPath}`;
  }

  private async readPostFile(path: string): Promise<{ raw: string; sha: string }> {
    const response = await this.fetcher(
      `${this.contentsUrl(path)}?ref=${encodeURIComponent(this.branch)}`,
      { headers: this.headers() },
    );
    if (!response.ok) {
      throw new GitHubRepositoryError(
        "Post not found",
        response.status === 404 ? "not_found" : "github_error",
        response.status,
      );
    }
    const file = await response.json() as { content: string; sha: string };
    return { raw: base64DecodeUtf8(file.content), sha: file.sha };
  }

  private async updatePostFile(
    path: string,
    sha: string,
    markdown: string,
    message: string,
  ): Promise<GitHubCreateFileResponse> {
    const response = await this.fetcher(this.contentsUrl(path), {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify({
        message,
        content: base64EncodeUtf8(markdown),
        sha,
        branch: this.branch,
        committer: this.committer,
      }),
    });
    if (!response.ok) {
      throw new GitHubRepositoryError("Failed to update post", "github_error", response.status);
    }
    return response.json() as Promise<GitHubCreateFileResponse>;
  }

  private async findPostPathBySlug(slug: string): Promise<string | null> {
    const paths = await this.listPostPaths();
    return paths.find((path) => postSlugFromPath(path) === slug) ?? null;
  }

  private async listPostPaths(): Promise<string[]> {
    const response = await this.fetcher(
      `https://api.github.com/repos/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(this.config.repo)}/git/trees/${encodeURIComponent(this.branch)}?recursive=1`,
      { headers: this.headers() },
    );
    if (!response.ok) {
      const details = await response.text();
      console.error("GitHub post tree lookup failed", {
        status: response.status,
        response: details,
      });
      throw new GitHubRepositoryError(
        "Failed to check existing post slugs",
        "github_error",
        response.status,
      );
    }
    const payload = await response.json() as {
      truncated?: boolean;
      tree?: Array<{ path?: string; type?: string }>;
    };
    if (payload.truncated) {
      throw new GitHubRepositoryError(
        "GitHub post tree was truncated while checking slugs",
        "github_error",
      );
    }
    return (payload.tree ?? [])
      .filter((entry) => entry.type === "blob" && typeof entry.path === "string")
      .map((entry) => entry.path!)
      .filter((path) => postSlugFromPath(path) !== null);
  }

  private async readMatchingDraft(prepared: PreparedPost): Promise<CreateDraftResult | null> {
    const response = await this.fetcher(
      `${this.contentsUrl(prepared.path)}?ref=${encodeURIComponent(this.branch)}`,
      { headers: this.headers() },
    );
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      const details = await response.text();
      console.error("GitHub draft reconciliation read failed", {
        status: response.status,
        path: prepared.path,
        response: details,
      });
      throw new GitHubRepositoryError(
        "Failed to reconcile the draft commit",
        "github_error",
        response.status,
      );
    }

    const file = await response.json() as {
      content?: string;
      path?: string;
      sha?: string;
    };
    if (
      typeof file.content !== "string" ||
      base64DecodeUtf8(file.content) !== prepared.markdown
    ) {
      return null;
    }

    const commitResponse = await this.fetcher(
      `https://api.github.com/repos/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(this.config.repo)}/commits?sha=${encodeURIComponent(this.branch)}&path=${encodeURIComponent(prepared.path)}&per_page=1`,
      { headers: this.headers() },
    );
    if (!commitResponse.ok) {
      const details = await commitResponse.text();
      console.error("GitHub draft reconciliation commit lookup failed", {
        status: commitResponse.status,
        path: prepared.path,
        response: details,
      });
      throw new GitHubRepositoryError(
        "Failed to recover the draft commit",
        "github_error",
        commitResponse.status,
      );
    }
    const commit = (await commitResponse.json() as Array<{
      sha?: string;
      html_url?: string;
    }>)[0];
    if (!commit?.sha) {
      throw new GitHubRepositoryError(
        "No commit was found for the existing draft",
        "github_error",
      );
    }
    return {
      path: file.path || prepared.path,
      slug: prepared.slug,
      date: prepared.date,
      contentSha: file.sha,
      commitSha: commit.sha,
      commitUrl: commit.html_url || this.commitUrl(commit.sha),
    };
  }

  private createResult(
    prepared: PreparedPost,
    result: GitHubCreateFileResponse,
  ): CreateDraftResult {
    return {
      path: result.content?.path || prepared.path,
      slug: prepared.slug,
      date: prepared.date,
      contentSha: result.content?.sha,
      commitSha: result.commit!.sha,
      commitUrl: result.commit?.html_url || this.commitUrl(result.commit!.sha!),
    };
  }

  private pathExistsError(
    prepared: PreparedPost,
    existingPath: string,
    status?: number,
  ): GitHubRepositoryError {
    const location = existingPath === prepared.path
      ? prepared.path
      : `${existingPath} with slug ${prepared.slug}`;
    return new GitHubRepositoryError(
      `A post already exists at ${location}`,
      "path_exists",
      status,
    );
  }

  private commitUrl(sha: string): string {
    return `https://github.com/${this.config.owner}/${this.config.repo}/commit/${sha}`;
  }

  private async commitRenamedPost(
    oldPath: string,
    newPath: string,
    slug: string,
    markdown: string,
    message?: string,
  ): Promise<EditPostResult> {
    const repositoryUrl = `https://api.github.com/repos/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(this.config.repo)}`;
    const refPath = this.branch.split("/").map(encodeURIComponent).join("/");
    const refResponse = await this.fetcher(`${repositoryUrl}/git/ref/heads/${refPath}`, { headers: this.headers() });
    if (!refResponse.ok) throw new GitHubRepositoryError("Failed to read branch head", "github_error", refResponse.status);
    const head = await refResponse.json() as { object?: { sha?: string } };
    if (!head.object?.sha) throw new GitHubRepositoryError("Branch head was invalid", "github_error");

    const commitResponse = await this.fetcher(`${repositoryUrl}/git/commits/${encodeURIComponent(head.object.sha)}`, { headers: this.headers() });
    if (!commitResponse.ok) throw new GitHubRepositoryError("Failed to read branch commit", "github_error", commitResponse.status);
    const parent = await commitResponse.json() as { tree?: { sha?: string } };
    if (!parent.tree?.sha) throw new GitHubRepositoryError("Branch commit was invalid", "github_error");

    const blobResponse = await this.fetcher(`${repositoryUrl}/git/blobs`, {
      method: "POST", headers: this.headers(), body: JSON.stringify({ content: markdown, encoding: "utf-8" }),
    });
    if (!blobResponse.ok) throw new GitHubRepositoryError("Failed to create edited post content", "github_error", blobResponse.status);
    const blob = await blobResponse.json() as { sha?: string };
    if (!blob.sha) throw new GitHubRepositoryError("Edited post content was invalid", "github_error");

    const treeResponse = await this.fetcher(`${repositoryUrl}/git/trees`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        base_tree: parent.tree.sha,
        tree: [
          { path: newPath, mode: "100644", type: "blob", sha: blob.sha },
          { path: oldPath, mode: "100644", type: "blob", sha: null },
        ],
      }),
    });
    if (!treeResponse.ok) throw new GitHubRepositoryError("Failed to rename post", "github_error", treeResponse.status);
    const tree = await treeResponse.json() as { sha?: string };
    if (!tree.sha) throw new GitHubRepositoryError("Renamed post tree was invalid", "github_error");

    const newCommitResponse = await this.fetcher(`${repositoryUrl}/git/commits`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        message: message ?? `Edit post: ${slug}`,
        tree: tree.sha,
        parents: [head.object.sha],
        author: this.committer,
        committer: this.committer,
      }),
    });
    if (!newCommitResponse.ok) throw new GitHubRepositoryError("Failed to commit renamed post", "github_error", newCommitResponse.status);
    const commit = await newCommitResponse.json() as { sha?: string; html_url?: string };
    if (!commit.sha) throw new GitHubRepositoryError("Renamed post commit was invalid", "github_error");

    const updateRefResponse = await this.fetcher(`${repositoryUrl}/git/refs/heads/${refPath}`, {
      method: "PATCH", headers: this.headers(), body: JSON.stringify({ sha: commit.sha, force: false }),
    });
    if (!updateRefResponse.ok) throw new GitHubRepositoryError("Failed to update branch with renamed post", "github_error", updateRefResponse.status);
    return { path: newPath, slug, contentSha: blob.sha, commitSha: commit.sha, commitUrl: commit.html_url ?? this.commitUrl(commit.sha) };
  }

  private headers(): HeadersInit {
    return {
      "Authorization": `Bearer ${this.config.token}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "sids.in publishing bot",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }
}

type GitHubCreateFileResponse = {
  content?: { path?: string; sha?: string };
  commit?: { sha?: string; html_url?: string };
};

function postSlugFromPath(path: string): string | null {
  const note = /^content\/posts\/\d{4}\/\d{2}-\d{2}-(.+)\.md$/.exec(path);
  if (note?.[1]) {
    return note[1];
  }
  const article = /^content\/posts\/articles\/\d{4}-\d{2}-(.+)\.md$/.exec(path);
  return article?.[1] ?? null;
}

function validatePostPath(path: string): string {
  if (postSlugFromPath(path) === null) {
    throw new GitHubRepositoryError("Invalid post path", "not_found", 404);
  }
  return path;
}

function postPathWithSlug(path: string, slug: string): string {
  const note = /^(content\/posts\/\d{4}\/\d{2}-\d{2})-.+\.md$/.exec(path);
  if (note?.[1]) return `${note[1]}-${slug}.md`;
  const article = /^(content\/posts\/articles\/\d{4}-\d{2})-.+\.md$/.exec(path);
  if (article?.[1]) return `${article[1]}-${slug}.md`;
  throw new GitHubRepositoryError("Invalid post path", "not_found", 404);
}

function extractFrontmatterScalar(raw: string, key: string): string | null {
  const match = new RegExp(`^${key}:\\s*(.+?)\\s*$`, "m").exec(raw);
  if (!match?.[1]) return null;
  try {
    const parsed = JSON.parse(match[1]);
    return typeof parsed === "string" ? parsed : String(parsed);
  } catch {
    return match[1].trim();
  }
}

function replaceFrontmatterField(raw: string, key: string, value: string): string {
  const frontmatter = /^---\s*\n([\s\S]*?)\n---/.exec(raw);
  if (!frontmatter?.[1]) throw new GitHubRepositoryError("Post frontmatter not found", "github_error");
  const fieldPattern = new RegExp(`^${key}:\\s*.*$`, "m");
  if (!fieldPattern.test(frontmatter[1])) {
    throw new GitHubRepositoryError(`Post ${key} field not found`, "github_error");
  }
  const updated = frontmatter[1].replace(fieldPattern, `${key}: ${value}`);
  return `---\n${updated}\n---${raw.slice(frontmatter[0].length)}`;
}

function replaceMarkdownBody(raw: string, content: string): string {
  const frontmatter = /^---\s*\n[\s\S]*?\n---/.exec(raw);
  if (!frontmatter) throw new GitHubRepositoryError("Post frontmatter not found", "github_error");
  return `${frontmatter[0]}\n\n${content}${content.endsWith("\n") ? "" : "\n"}`;
}

function base64DecodeUtf8(value: string): string {
  const binary = atob(value.replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

function base64EncodeUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
