import type { Env } from "../types.ts";
import { allTags, postMetaBySlug } from "../manifest.ts";
import { linkLogTemplate } from "../templates/admin/link-log.ts";
import { asideTemplate } from "../templates/admin/aside.ts";
import { adminHomeTemplate } from "../templates/admin/home.ts";
import { loginTemplate } from "../templates/admin/login.ts";
import { html, json } from "../lib/responses.ts";
import { requireAdminAuth } from "../lib/admin-auth.ts";
import {
  createSessionCookie,
  clearSessionCookie,
  generateStateToken,
  createStateCookie,
  verifyStateToken,
  clearStateCookie,
  createAdminFlagCookie,
  clearAdminFlagCookie,
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
  handleAdminAsideSubmissionRoute,
  handleAdminPublishRoute,
  handleAdminHome,
  handleAdminLinkLogPage,
  handleAdminAsidePage,
];

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/callback"];

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
  const content = loginTemplate({ error });
  return html(content, "Sign In", "Sign in to admin", isPartialRequest, request);
}

async function handleLoginSubmit({ path, request, env, origin }: AdminContext): Promise<Response | null> {
  if (path !== "/admin/login" || request.method !== "POST") {
    return null;
  }

  const config = getAppleAuthConfig(env, origin);
  const state = generateStateToken();
  const stateCookie = await createStateCookie(state, env.SESSION_SECRET);
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

  if (errorParam) {
    const errorDescription = formData.get("error_description") || "Authentication failed";
    return redirectToLoginWithError(String(errorDescription));
  }

  if (typeof code !== "string" || typeof state !== "string") {
    return redirectToLoginWithError("Missing code or state");
  }

  const isValidState = await verifyStateToken(request, state, env.SESSION_SECRET);
  if (!isValidState) {
    return redirectToLoginWithError("Invalid state token");
  }

  const config = getAppleAuthConfig(env, origin);

  let email: string | null;
  try {
    const tokens = await exchangeCodeForTokens(code, config);
    const claims = parseIdToken(tokens.id_token, config.clientId);
    email = extractEmailFromClaims(claims);
  } catch (error) {
    console.error("Apple auth error:", error);
    return redirectToLoginWithError("Authentication failed");
  }

  if (!email) {
    return redirectToLoginWithError("Could not retrieve email from Apple");
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
      ["Location", "/admin"],
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

function redirectToLoginWithError(message: string): Response {
  const params = new URLSearchParams({ error: message });
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

async function handleAdminAsideSubmissionRoute({ path, request, env }: AdminContext): Promise<Response | null> {
  if (path !== "/admin/api/aside" || request.method !== "POST") {
    return null;
  }

  return handleAsideSubmission(request, env);
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

async function handlePublishDraft(slug: string, env: Env): Promise<{ ok?: boolean; path?: string; error?: string }> {
  if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO) {
    return { error: "Missing GitHub configuration" };
  }

  const meta = postMetaBySlug[slug];
  if (!meta?.draft || !meta.sourcePath) {
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
    console.error(errorText);
    return { error: "Failed to read draft post" };
  }

  const file = await readResponse.json<{ content: string; sha: string }>();
  const raw = base64DecodeUtf8(file.content);
  const next = raw.replace(/^draft:\s*true\s*$/m, "draft: false");

  if (next === raw) {
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
    console.error(errorText);
    return { error: "Failed to publish draft" };
  }

  return { ok: true, path: meta.sourcePath };
}

async function handleAdminHome({ path, request, isPartialRequest }: AdminContext): Promise<Response | null> {
  if (path !== "/admin") {
    return null;
  }

  const content = adminHomeTemplate();
  return html(content, "Admin", "Admin dashboard", isPartialRequest, request);
}

async function handleAdminLinkLogPage({ path, request, origin, isPartialRequest }: AdminContext): Promise<Response | null> {
  if (path !== "/admin/link-log") {
    return null;
  }

  const content = linkLogTemplate(origin, allTags);
  return html(content, "New Link Log", "Create a link log entry", isPartialRequest, request);
}

async function handleAdminAsidePage({ path, request, isPartialRequest }: AdminContext): Promise<Response | null> {
  if (path !== "/admin/aside") {
    return null;
  }

  const content = asideTemplate(allTags);
  return html(content, "New Aside", "Create a new aside entry", isPartialRequest, request);
}

function redirectResponse(location: string): Response {
  return new Response(null, {
    status: 308,
    headers: {
      Location: location,
    },
  });
}

async function handleLinkLogMetadata(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const target = url.searchParams.get("url");
  if (!target) {
    return json({ error: "Missing url parameter" }, 400);
  }

  let response: Response;
  try {
    response = await fetch(target, {
      headers: {
        "User-Agent": "sids.in link log bot",
      },
    });
  } catch (error) {
    console.error(error);
    return json({ error: "Failed to fetch URL" }, 502);
  }

  if (!response.ok) {
    return json({ error: "Failed to fetch URL" }, 502);
  }

  const htmlText = await response.text();
  const title = extractTitle(htmlText);

  return json({ title });
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

  const tags = normalizeTags(payload.tags);
  const date = new Date().toISOString().slice(0, 10);
  const slug = slugify(payload.title);
  const filePath = buildPostPath(date, slug);
  const markdown = buildPostMarkdown({
    title: payload.title,
    slug,
    date,
    description: payload.description,
    tags,
    link: payload.url,
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

async function handleAsideSubmission(request: Request, env: Env): Promise<Response> {
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
  const date = new Date().toISOString().slice(0, 10);
  const slug = slugify(payload.title);
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
        message: `Add aside: ${payload.title}`,
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

function normalizeTags(input?: string | string[]): string[] {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return input.map((tag) => tag.trim()).filter(Boolean);
  }

  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildPostPath(date: string, slug: string): string {
  const [year, month, day] = date.split("-");
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
  const descriptionLine = input.description ? `description: "${escapeYaml(input.description)}"\n` : "";
  const tagsLine = input.tags.length
    ? `tags: [${input.tags.map((tag) => `"${escapeYaml(tag)}"`).join(", ")}]\n`
    : "tags: []\n";
  const linkLine = input.link ? `link: "${escapeYaml(input.link)}"\n` : "";

  return "---\n" +
    `title: "${escapeYaml(input.title)}"\n` +
    `slug: "${escapeYaml(input.slug)}"\n` +
    `date: "${input.date}"\n` +
    descriptionLine +
    tagsLine +
    linkLine +
    "draft: false\n" +
    "---\n\n" +
    `${input.content.trim()}\n`;
}

function escapeYaml(value: string): string {
  return value.replace(/"/g, "\\\"");
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
