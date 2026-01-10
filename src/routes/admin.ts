import type { Env } from "../types.ts";
import { allTags } from "../manifest.ts";
import { linkLogTemplate } from "../templates/admin/link-log.ts";
import { asideTemplate } from "../templates/admin/aside.ts";
import { adminHomeTemplate } from "../templates/admin/home.ts";
import { html, json } from "../lib/responses.ts";
import { requireAdminAuth } from "../lib/admin-auth.ts";

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
  handleAdminLinkLogSubmissionRoute,
  handleAdminLinkLogMetadataRoute,
  handleAdminAsideSubmissionRoute,
  handleAdminHome,
  handleAdminLinkLogPage,
  handleAdminAsidePage,
];

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

  if (isAdminPath) {
    const authResponse = requireAdminAuth(request, env, "Admin");
    if (authResponse) {
      return authResponse;
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

function base64EncodeUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
