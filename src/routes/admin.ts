import type { Env } from "../types.ts";
import { allTags, postMetaBySlug } from "../manifest.ts";
import { linkLogTemplate } from "../templates/admin/link-log.ts";
import { noteTemplate } from "../templates/admin/note.ts";
import { adminHomeTemplate } from "../templates/admin/home.ts";
import { loginTemplate } from "../templates/admin/login.ts";
import { json, privateHtml } from "../lib/responses.ts";
import { requireAdminAuth } from "../lib/admin-auth.ts";
import { normalizeTags } from "../lib/tags.ts";
import { fetchPublicHttpUrl, normalizeHttpUrl, UnsafeUrlError } from "../lib/urls.ts";
import {
  createSessionCookie,
  clearSessionCookie,
  generateStateToken,
  createStateCookie,
  readStateCookie,
  verifyStateToken,
  clearStateCookie,
  createAdminFlagCookie,
  clearAdminFlagCookie,
  isValidSessionSecret,
} from "../lib/session.ts";
import {
  buildAppleAuthUrl,
  exchangeCodeForTokens,
  parseIdToken,
  extractEmailFromClaims,
  type AppleAuthConfig,
} from "../lib/apple-auth.ts";

type AdminContext = {
  path: string;
  request: Request;
  env: Env;
  origin: string;
  isPartialRequest: boolean;
};

type AdminHandler = (context: AdminContext) => Promise<Response | null>;

const routes: AdminHandler[] = [
  handleLegacyRedirects,
  handleLoginPage,
  handleLoginSubmit,
  handleCallback,
  handleLogout,
  handleAdminLinkLogSubmissionRoute,
  handleAdminLinkLogMetadataRoute,
  handleAdminNoteSubmissionRoute,
  handleAdminPublishRoute,
  handleAdminHome,
  handleAdminLinkLogPage,
  handleAdminNotePage,
];

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/callback"];
const METADATA_FETCH_TIMEOUT_MS = 5000;
const METADATA_RESPONSE_MAX_BYTES = 256 * 1024;

class MetadataResponseTooLargeError extends Error {
  constructor() {
    super("Metadata response is too large");
    this.name = "MetadataResponseTooLargeError";
  }
}

export async function routeAdmin(
  path: string,
  request: Request,
  env: Env,
  origin: string,
  isPartialRequest: boolean,
): Promise<Response | null> {
  const isAdminPath = path.startsWith("/admin");
  const isLegacyPath = path === "/link-log" || path.startsWith("/api/link-log");

  if (!isAdminPath && !isLegacyPath) {
    return null;
  }

  if (isAdminPath && !isValidSessionSecret(env.SESSION_SECRET)) {
    return adminConfigurationErrorResponse();
  }

  const context: AdminContext = {
    path,
    request,
    env,
    origin,
    isPartialRequest,
  };

  const isPublicPath = PUBLIC_ADMIN_PATHS.includes(path);
  if (isAdminPath && !isPublicPath) {
    const authResult = await requireAdminAuth(request, env);
    if (!authResult.authenticated) {
      return authResult.redirect;
    }
  }

  for (const handler of routes) {
    const response = await handler(context);
    if (response) {
      return response;
    }
  }

  return null;
}

async function handleLegacyRedirects({ path }: AdminContext): Promise<Response | null> {
  if (path === "/link-log") {
    return redirectResponse("/admin/link-log");
  }

  if (path === "/api/link-log") {
    return redirectResponse("/admin/api/link-log");
  }

  if (path === "/api/link-log/metadata") {
    return redirectResponse("/admin/api/link-log/metadata");
  }

  return null;
}

async function handleLoginPage({ path, request, isPartialRequest }: AdminContext): Promise<Response | null> {
  if (path !== "/admin/login" || request.method !== "GET") {
    return null;
  }

  const url = new URL(request.url);
  const error = url.searchParams.get("error") || undefined;
  const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"));
  const content = loginTemplate({ error, returnTo });
  return privateHtml(content, "Sign In", "Sign in to admin", isPartialRequest);
}

async function handleLoginSubmit({ path, request, env, origin }: AdminContext): Promise<Response | null> {
  if (path !== "/admin/login" || request.method !== "POST") {
    return null;
  }

  const formData = await request.formData();
  const rawReturnTo = formData.get("returnTo");
  const returnTo = sanitizeReturnTo(typeof rawReturnTo === "string" ? rawReturnTo : null);
  const config = getAppleAuthConfig(env, origin);
  const state = generateStateToken();
  const stateCookie = await createStateCookie(state, env.SESSION_SECRET, returnTo);
  const authUrl = buildAppleAuthUrl(config, state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl,
      "Set-Cookie": stateCookie,
    },
  });
}

async function handleCallback({ path, request, env, origin }: AdminContext): Promise<Response | null> {
  if (path !== "/admin/callback") {
    return null;
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const formData = await request.formData();
  const code = formData.get("code");
  const state = formData.get("state");
  const errorParam = formData.get("error");
  const storedState = await readStateCookie(request, env.SESSION_SECRET);
  const storedReturnTo = sanitizeReturnTo(storedState?.returnTo ?? null);

  if (errorParam) {
    const errorDescription = formData.get("error_description") || "Authentication failed";
    return redirectToLoginWithError(String(errorDescription), storedReturnTo);
  }

  if (typeof code !== "string" || typeof state !== "string") {
    return redirectToLoginWithError("Missing code or state", storedReturnTo);
  }

  const stateResult = await verifyStateToken(request, state, env.SESSION_SECRET);
  if (!stateResult.valid) {
    return redirectToLoginWithError("Invalid state token", storedReturnTo);
  }
  const returnTo = sanitizeReturnTo(stateResult.returnTo) || "/admin";

  const config = getAppleAuthConfig(env, origin);

  let email: string | null;
  try {
    const tokens = await exchangeCodeForTokens(code, config);
    const claims = parseIdToken(tokens.id_token, config.clientId);
    email = extractEmailFromClaims(claims);
  } catch (error) {
    console.error("Apple auth error:", error);
    return redirectToLoginWithError("Authentication failed", returnTo);
  }

  if (!email) {
    return redirectToLoginWithError("Could not retrieve email from Apple", returnTo);
  }

  if (email !== env.ADMIN_EMAIL) {
    return new Response("Forbidden: You are not authorized to access the admin area.", {
      status: 403,
      headers: {
        "Content-Type": "text/plain",
        "Set-Cookie": clearStateCookie(),
      },
    });
  }

  const sessionCookie = await createSessionCookie(email, env.SESSION_SECRET);

  return new Response(null, {
    status: 302,
    headers: [
      ["Location", returnTo],
      ["Set-Cookie", sessionCookie],
      ["Set-Cookie", createAdminFlagCookie()],
      ["Set-Cookie", clearStateCookie()],
    ],
  });
}

async function handleLogout({ path, request, env }: AdminContext): Promise<Response | null> {
  if (path !== "/admin/logout" || request.method !== "POST") {
    return null;
  }

  return new Response(null, {
    status: 302,
    headers: [
      ["Location", "/"],
      ["Set-Cookie", clearSessionCookie()],
      ["Set-Cookie", clearAdminFlagCookie()],
    ],
  });
}

function getAppleAuthConfig(env: Env, origin: string): AppleAuthConfig {
  // Always use HTTPS for redirect URI (ngrok/proxies forward as HTTP locally)
  const httpsOrigin = origin.replace(/^http:/, "https:");
  return {
    clientId: env.APPLE_CLIENT_ID,
    teamId: env.APPLE_TEAM_ID,
    keyId: env.APPLE_KEY_ID,
    privateKey: env.APPLE_PRIVATE_KEY,
    redirectUri: `${httpsOrigin}/admin/callback`,
  };
}

function redirectToLoginWithError(message: string, returnTo?: string): Response {
  const params = new URLSearchParams({ error: message });
  if (returnTo) {
    params.set("returnTo", returnTo);
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: `/admin/login?${params.toString()}`,
      "Set-Cookie": clearStateCookie(),
    },
  });
}

async function handleAdminLinkLogSubmissionRoute({ path, request, env }: AdminContext): Promise<Response | null> {
  if (path !== "/admin/api/link-log" || request.method !== "POST") {
    return null;
  }

  return handleLinkLogSubmission(request, env);
}

async function handleAdminLinkLogMetadataRoute({ path, request, env }: AdminContext): Promise<Response | null> {
  if (path !== "/admin/api/link-log/metadata" || request.method !== "GET") {
    return null;
  }

  return handleLinkLogMetadata(request, env);
}

async function handleAdminNoteSubmissionRoute({ path, request, env }: AdminContext): Promise<Response | null> {
  if (path !== "/admin/api/note" || request.method !== "POST") {
    return null;
  }

  return handleNoteSubmission(request, env);
}

async function handleAdminPublishRoute({ path, request, env }: AdminContext): Promise<Response | null> {
  if (path !== "/admin/api/publish" || request.method !== "POST") {
    return null;
  }

  const contentType = request.headers.get("Content-Type") || "";
  const isJson = contentType.includes("application/json");
  const isHtmx = request.headers.get("HX-Request") === "true";
  let slug = "";

  if (isJson) {
    const payload = await request.json<{ slug?: string }>();
    slug = String(payload.slug || "").trim();
  } else {
    const formData = await request.formData();
    slug = String(formData.get("slug") || "").trim();
  }

  if (!slug) {
    if (isJson) {
      return json({ error: "Missing slug" }, 400);
    }

    return new Response("Missing slug", {
      status: 400,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  const result = await handlePublishDraft(slug, env);

  if (isJson) {
    return json(result, result.error ? 502 : 200);
  }

  if (result.error) {
    return new Response(result.error, {
      status: 502,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  if (isHtmx) {
    return new Response(null, {
      status: 204,
      headers: {
        "HX-Location": `/posts/${slug}`,
      },
    });
  }

  return new Response(null, {
    status: 303,
    headers: {
      Location: `/posts/${slug}`,
    },
  });
}

async function handlePublishDraft(slug: string, env: Env): Promise<{ ok?: boolean; path?: string; date?: string; error?: string }> {
  if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO) {
    console.error("Missing GitHub configuration for publish", {
      hasToken: Boolean(env.GITHUB_TOKEN),
      hasOwner: Boolean(env.GITHUB_OWNER),
      hasRepo: Boolean(env.GITHUB_REPO),
      slug,
    });
    return { error: "Missing GitHub configuration" };
  }

  const meta = postMetaBySlug[slug];
  if (!meta?.draft || !meta.sourcePath) {
    console.error("Draft post lookup failed", {
      slug,
      hasMeta: Boolean(meta),
      isDraft: meta?.draft,
      sourcePath: meta?.sourcePath,
    });
    return { error: "Draft post not found" };
  }

  const branch = env.GITHUB_BRANCH || "main";
  const encodedPath = meta.sourcePath.split("/").map(encodeURIComponent).join("/");
  const apiUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${encodedPath}`;

  const readResponse = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, {
    headers: {
      "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "sids.in admin bot",
    },
  });

  if (!readResponse.ok) {
    const errorText = await readResponse.text();
    console.error("Failed to read draft post", {
      slug,
      branch,
      status: readResponse.status,
      response: errorText,
    });
    return { error: "Failed to read draft post" };
  }

  const file = await readResponse.json<{ content: string; sha: string }>();
  const raw = base64DecodeUtf8(file.content);
  const publishedAt = currentPostDateTime();
  const next = publishDraftMarkdown(raw, publishedAt);

  if (!next) {
    console.error("Draft flag not found while publishing", {
      slug,
      sourcePath: meta.sourcePath,
    });
    return { error: "Draft flag not found" };
  }

  const updateResponse = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "sids.in admin bot",
    },
    body: JSON.stringify({
      message: `Publish post: ${slug}`,
      content: base64EncodeUtf8(next),
      sha: file.sha,
      branch,
      committer: {
        name: "Admin Bot",
        email: "admin@users.noreply.github.com",
      },
    }),
  });

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    console.error("Failed to publish draft", {
      slug,
      branch,
      status: updateResponse.status,
      response: errorText,
    });
    return { error: "Failed to publish draft" };
  }

  return { ok: true, path: meta.sourcePath, date: publishedAt };
}

async function handleAdminHome({ path, isPartialRequest }: AdminContext): Promise<Response | null> {
  if (path !== "/admin") {
    return null;
  }

  const content = adminHomeTemplate();
  return privateHtml(content, "Admin", "Admin dashboard", isPartialRequest);
}

async function handleAdminLinkLogPage({ path, origin, isPartialRequest }: AdminContext): Promise<Response | null> {
  if (path !== "/admin/link-log") {
    return null;
  }

  const content = linkLogTemplate(origin, allTags);
  return privateHtml(content, "New Link Log", "Create a link log entry", isPartialRequest);
}

async function handleAdminNotePage({ path, isPartialRequest }: AdminContext): Promise<Response | null> {
  if (path !== "/admin/note") {
    return null;
  }

  const content = noteTemplate(allTags);
  return privateHtml(content, "New Note", "Create a new note entry", isPartialRequest);
}

function redirectResponse(location: string): Response {
  return new Response(null, {
    status: 308,
    headers: {
      Location: location,
    },
  });
}

function adminConfigurationErrorResponse(): Response {
  return new Response("Admin is not configured correctly.", {
    status: 500,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}

function sanitizeReturnTo(value: string | null): string | undefined {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return undefined;
  }

  try {
    const url = new URL(value, "https://sids.in");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return undefined;
  }
}

async function handleLinkLogMetadata(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const rawTarget = url.searchParams.get("url");
  if (!rawTarget) {
    return json({ error: "Missing url parameter" }, 400);
  }

  const target = normalizeHttpUrl(rawTarget);
  if (!target) {
    return json({ error: "Invalid URL" }, 400);
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), METADATA_FETCH_TIMEOUT_MS);

  try {
    const response = await fetchPublicHttpUrl(target, {
      headers: {
        "User-Agent": "sids.in link log bot",
      },
      signal: abortController.signal,
    });

    if (!response.ok) {
      return json({ error: "Failed to fetch URL" }, 502);
    }

    if (!isHtmlResponse(response)) {
      return json({ error: "URL did not return HTML" }, 415);
    }

    const htmlText = await readResponseTextWithLimit(response, METADATA_RESPONSE_MAX_BYTES, abortController.signal);
    const title = extractTitle(htmlText);

    return json({ title });
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      return json({ error: "Invalid URL" }, 400);
    }

    if (error instanceof MetadataResponseTooLargeError) {
      return json({ error: "Response too large" }, 413);
    }

    if (isAbortError(error)) {
      return json({ error: "URL fetch timed out" }, 504);
    }

    console.error(error);
    return json({ error: "Failed to fetch URL" }, 502);
  } finally {
    clearTimeout(timeout);
  }
}

function isHtmlResponse(response: Response): boolean {
  const contentType = response.headers.get("Content-Type");
  if (!contentType) {
    return true;
  }

  const mediaType = contentType.split(";", 1)[0]!.trim().toLowerCase();
  return mediaType === "text/html" || mediaType === "application/xhtml+xml";
}

async function readResponseTextWithLimit(response: Response, maxBytes: number, signal: AbortSignal): Promise<string> {
  const contentLength = response.headers.get("Content-Length");
  if (contentLength) {
    const parsedLength = Number(contentLength);
    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
      throw new MetadataResponseTooLargeError();
    }
  }

  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let shouldReleaseReader = true;

  try {
    while (true) {
      const { done, value } = await readChunkWithAbort(reader, signal);
      if (done) {
        break;
      }

      if (!value) {
        continue;
      }

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new MetadataResponseTooLargeError();
      }

      chunks.push(value);
    }
  } catch (error) {
    if (isAbortError(error)) {
      shouldReleaseReader = false;
    }

    throw error;
  } finally {
    if (shouldReleaseReader) {
      reader.releaseLock();
    }
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8").decode(body);
}

function readChunkWithAbort(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  if (signal.aborted) {
    void reader.cancel();
    return Promise.reject(createAbortError());
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      signal.removeEventListener("abort", abortRead);
      callback();
    };

    const abortRead = () => {
      void reader.cancel();
      settle(() => reject(createAbortError()));
    };

    signal.addEventListener("abort", abortRead, { once: true });
    reader.read().then(
      (result) => settle(() => resolve(result)),
      (error: unknown) => settle(() => reject(error)),
    );
  });
}

function createAbortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function extractTitle(htmlText: string): string | null {
  const ogTitleMatch = htmlText.match(
    /<meta[^>]+property=[\"']og:title[\"'][^>]+content=[\"']([^\"']+)[\"'][^>]*>/i,
  );
  if (ogTitleMatch?.[1]) {
    return decodeHtmlEntities(ogTitleMatch[1].trim());
  }

  const titleMatch = htmlText.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch?.[1]) {
    return decodeHtmlEntities(titleMatch[1].trim());
  }

  return null;
}

function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: "\"",
    apos: "'",
    nbsp: "\u00a0",
  };

  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity[0] === "#") {
      const isHex = entity[1]?.toLowerCase() === "x";
      const codePoint = parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (!Number.isNaN(codePoint)) {
        return String.fromCodePoint(codePoint);
      }
      return match;
    }

    return namedEntities[entity] ?? match;
  });
}

async function handleLinkLogSubmission(request: Request, env: Env): Promise<Response> {
  if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO) {
    return json({ error: "Missing GitHub configuration" }, 500);
  }

  const payload = await request.json<{
    url?: string;
    title?: string;
    description?: string;
    tags?: string | string[];
    content?: string;
  }>();

  if (!payload.url || !payload.title) {
    return json({ error: "Missing url or title" }, 400);
  }

  const link = normalizeHttpUrl(payload.url);
  if (!link) {
    return json({ error: "Invalid URL" }, 400);
  }

  const tags = normalizeTags(payload.tags);
  const date = currentPostDateTime();
  const slug = slugify(payload.title);
  if (!slug) {
    return json({ error: "Title must contain letters or numbers" }, 400);
  }
  const filePath = buildPostPath(date, slug);
  const markdown = buildPostMarkdown({
    title: payload.title,
    slug,
    date,
    description: payload.description,
    tags,
    link,
    content: payload.content || "",
  });

  const branch = env.GITHUB_BRANCH || "main";

  const createResponse = await fetch(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${filePath}`,
    {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "sids.in admin bot",
      },
      body: JSON.stringify({
        message: `Add link log: ${payload.title}`,
        content: base64EncodeUtf8(markdown),
        branch,
        committer: {
          name: "Link Log Bot",
          email: "link-log@users.noreply.github.com",
        },
      }),
    },
  );

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    console.error(errorText);
    return json({ error: "Failed to create post" }, 502);
  }

  const result = await createResponse.json<{ content?: { path?: string } }>();

  return json({
    path: result.content?.path || filePath,
    slug,
    date,
  });
}

async function handleNoteSubmission(request: Request, env: Env): Promise<Response> {
  if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO) {
    return json({ error: "Missing GitHub configuration" }, 500);
  }

  const payload = await request.json<{
    title?: string;
    description?: string;
    tags?: string | string[];
    content?: string;
  }>();

  if (!payload.title) {
    return json({ error: "Missing title" }, 400);
  }

  const tags = normalizeTags(payload.tags);
  const date = currentPostDateTime();
  const slug = slugify(payload.title);
  if (!slug) {
    return json({ error: "Title must contain letters or numbers" }, 400);
  }
  const filePath = buildPostPath(date, slug);
  const markdown = buildPostMarkdown({
    title: payload.title,
    slug,
    date,
    description: payload.description,
    tags,
    content: payload.content || "",
  });

  const branch = env.GITHUB_BRANCH || "main";

  const createResponse = await fetch(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${filePath}`,
    {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "sids.in admin bot",
      },
      body: JSON.stringify({
        message: `Add note: ${payload.title}`,
        content: base64EncodeUtf8(markdown),
        branch,
        committer: {
          name: "Admin Bot",
          email: "admin@users.noreply.github.com",
        },
      }),
    },
  );

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    console.error(errorText);
    return json({ error: "Failed to create post" }, 502);
  }

  const result = await createResponse.json<{ content?: { path?: string } }>();

  return json({
    path: result.content?.path || filePath,
    slug,
    date,
  });
}

export function publishDraftMarkdown(raw: string, publishedAt: string): string | null {
  const frontmatterMatch = raw.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return null;
  }

  const frontmatter = frontmatterMatch[1]!;
  const draftUpdated = frontmatter.replace(/^draft:\s*true\s*$/m, "draft: false");
  if (draftUpdated === frontmatter) {
    return null;
  }

  const dateLine = `date: "${publishedAt}"`;
  let nextFrontmatter: string;
  if (/^date:\s*.*$/m.test(draftUpdated)) {
    nextFrontmatter = draftUpdated.replace(/^date:\s*.*$/m, dateLine);
  } else if (/^slug:\s*.*$/m.test(draftUpdated)) {
    nextFrontmatter = draftUpdated.replace(/^slug:\s*.*$/m, (line) => `${line}\n${dateLine}`);
  } else {
    nextFrontmatter = `${dateLine}\n${draftUpdated}`;
  }

  return `---\n${nextFrontmatter}\n---${raw.slice(frontmatterMatch[0]!.length)}`;
}

function currentPostDateTime(): string {
  return new Date().toISOString();
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildPostPath(date: string, slug: string): string {
  const [year, month, day] = date.slice(0, 10).split("-");
  return `content/posts/${year}/${month}-${day}-${slug}.md`;
}

function buildPostMarkdown(input: {
  title: string;
  slug: string;
  date: string;
  description?: string;
  tags: string[];
  link?: string;
  content: string;
}): string {
  const descriptionLine = input.description ? `description: ${yamlQuotedString(input.description)}\n` : "";
  const tagsLine = input.tags.length
    ? `tags: [${input.tags.map(yamlQuotedString).join(", ")}]\n`
    : "tags: []\n";
  const linkLine = input.link ? `link: ${yamlQuotedString(input.link)}\n` : "";

  return "---\n" +
    `title: ${yamlQuotedString(input.title)}\n` +
    `slug: ${yamlQuotedString(input.slug)}\n` +
    `date: ${yamlQuotedString(input.date)}\n` +
    descriptionLine +
    tagsLine +
    linkLine +
    "draft: false\n" +
    "---\n\n" +
    `${input.content.trim()}\n`;
}

function yamlQuotedString(value: string): string {
  return JSON.stringify(value);
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
