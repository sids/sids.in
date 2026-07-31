import { normalizeTags } from "./tags.ts";
import { normalizeHttpUrl } from "./urls.ts";

export type PostKind = "note" | "link" | "article";

export interface PostDraftInput {
  kind: PostKind;
  title: string;
  description?: string;
  tags?: unknown;
  content: string;
  link?: string;
  draft?: boolean;
}

export interface PreparedPost {
  kind: PostKind;
  title: string;
  slug: string;
  date: string;
  description: string;
  tags: string[];
  content: string;
  link?: string;
  path: string;
  markdown: string;
}

export type PublishingValidationCode =
  | "invalid_kind"
  | "invalid_date"
  | "missing_title"
  | "missing_changes"
  | "invalid_slug"
  | "invalid_link";

export class PublishingValidationError extends Error {
  constructor(
    message: string,
    readonly code: PublishingValidationCode,
  ) {
    super(message);
    this.name = "PublishingValidationError";
  }
}

export function formatIstDateTime(date = new Date()): string {
  if (Number.isNaN(date.getTime())) {
    throw new PublishingValidationError("Invalid post date", "invalid_date");
  }

  const istOffsetMilliseconds = (5 * 60 + 30) * 60 * 1000;
  return `${new Date(date.getTime() + istOffsetMilliseconds).toISOString().slice(0, -1)}+05:30`;
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function preparePostDraft(
  input: PostDraftInput,
  options: { now?: Date } = {},
): PreparedPost {
  if (input.kind !== "note" && input.kind !== "link" && input.kind !== "article") {
    throw new PublishingValidationError("Post kind must be note, link, or article", "invalid_kind");
  }

  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) {
    throw new PublishingValidationError("Missing title", "missing_title");
  }

  const slug = slugify(title);
  if (!slug) {
    throw new PublishingValidationError("Title must contain letters or numbers", "invalid_slug");
  }

  let link: string | undefined;
  if (input.kind === "link") {
    const normalized = normalizeHttpUrl(input.link);
    if (!normalized) {
      throw new PublishingValidationError("Invalid URL", "invalid_link");
    }
    link = normalized;
  }

  const date = formatIstDateTime(options.now);
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const tags = normalizeTags(input.tags);
  const content = typeof input.content === "string" ? input.content : "";
  const draft = input.draft ?? true;
  const path = buildPostPath(input.kind, date, slug);
  const markdown = buildPostMarkdown({
    title,
    slug,
    date,
    description,
    tags,
    link,
    draft,
    content,
  });

  return {
    kind: input.kind,
    title,
    slug,
    date,
    description,
    tags,
    content,
    ...(link ? { link } : {}),
    path,
    markdown,
  };
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

  const dateLine = `date: ${yamlQuotedString(publishedAt)}`;
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

function buildPostPath(kind: PostKind, date: string, slug: string): string {
  const [year, month, day] = date.slice(0, 10).split("-");
  if (kind === "article") {
    return `content/posts/articles/${year}-${month}-${slug}.md`;
  }
  return `content/posts/${year}/${month}-${day}-${slug}.md`;
}

function buildPostMarkdown(input: {
  title: string;
  slug: string;
  date: string;
  description: string;
  tags: string[];
  link?: string;
  draft: boolean;
  content: string;
}): string {
  const tagsLine = `tags: [${input.tags.map(yamlQuotedString).join(", ")}]\n`;
  const linkLine = input.link ? `link: ${yamlQuotedString(input.link)}\n` : "";

  return "---\n" +
    `title: ${yamlQuotedString(input.title)}\n` +
    `slug: ${yamlQuotedString(input.slug)}\n` +
    `date: ${yamlQuotedString(input.date)}\n` +
    `description: ${yamlQuotedString(input.description)}\n` +
    tagsLine +
    linkLine +
    `draft: ${input.draft}\n` +
    "---\n\n" +
    (input.content.endsWith("\n") ? input.content : `${input.content}\n`);
}

function yamlQuotedString(value: string): string {
  return JSON.stringify(value);
}
