import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import fm from "front-matter";

interface PostFrontmatter {
  title: string;
  slug: string;
  date: string | Date;
  description?: string;
  tags?: string[];
  draft?: boolean;
  link?: string;
}

interface LocalPost {
  path: string;
  content: string;
  hash: string;
  frontmatter: PostFrontmatter;
}

interface BearNote {
  id: string;
  title: string;
  tags: string[];
  hash: string;
  location?: string;
  content: string;
  normalizedContent: string;
  normalizedHash: string;
  frontmatter?: PostFrontmatter;
}

interface SyncEntry {
  bearId: string;
  slug: string;
  lastFileHash: string;
  lastBearHash: string;
}

type SyncState = Record<string, SyncEntry>;

export interface PlanOptions {
  fromFiles?: boolean;
  fromBear?: boolean;
  overwriteBearContent?: boolean;
}

type Action =
  | { type: "create-bear"; post: LocalPost }
  | { type: "update-bear"; post: LocalPost; note: BearNote; entry: SyncEntry }
  | { type: "update-file"; post: LocalPost; note: BearNote; entry: SyncEntry }
  | { type: "sync-tags"; post: LocalPost; note: BearNote }
  | { type: "create-file"; note: BearNote; path: string }
  | { type: "archive-bear"; note: BearNote; path: string }
  | { type: "conflict"; post: LocalPost; note: BearNote; reason: string }
  | { type: "skip"; reason: string };

const ROOT = join(import.meta.dirname, "..");
const POSTS_DIR = join(ROOT, "content", "posts");
const STATE_FILE = join(ROOT, ".bear-posts-sync.json");
const PENDING_GIT_PATHS_FILE = join(ROOT, ".bear-posts-sync-pending.json");
const MANAGED_TAG_PREFIX = "sids.in";
const ARTICLE_META_TAG = `${MANAGED_TAG_PREFIX}/~article`;
const DRAFT_META_TAG = `${MANAGED_TAG_PREFIX}/~draft`;
const WIP_TAG = "wip";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const fromFiles = args.has("--from-files");
const fromBear = args.has("--from-bear");
const overwriteBearContent = args.has("--overwrite-bear-content");
const commitAndPush = args.has("--commit-and-push");

if (fromFiles && fromBear) {
  throw new Error("Use only one of --from-files or --from-bear.");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function parsePostFrontmatter(content: string, source: string, requireSlug = true): PostFrontmatter | undefined {
  try {
    const parsed = fm<PostFrontmatter>(content);
    const attributes = parsed.attributes;
    if (!attributes.title || !attributes.date) {
      return undefined;
    }
    if (!attributes.slug) {
      if (requireSlug) {
        return undefined;
      }
      attributes.slug = slugify(attributes.title);
    }
    return attributes;
  } catch (error) {
    console.warn(`Could not parse frontmatter for ${source}: ${String(error)}`);
    return undefined;
  }
}

function canonicalPostContent(content: string): string {
  return ensureTrailingNewline(stripBearTitleHeading(stripManagedBearTagLines(normalizeLineEndings(content))).trimEnd());
}

function contentForBear(post: LocalPost): string {
  return addBearTitleHeading(canonicalPostContent(post.content), post.frontmatter.title);
}

function contentForBearPreservingBody(post: LocalPost, note: BearNote): string {
  const mergedContent = replaceContentBody(canonicalPostContent(post.content), note.normalizedContent);
  return addBearTitleHeading(mergedContent, post.frontmatter.title);
}

function contentForBearContent(content: string, title: string): string {
  return addBearTitleHeading(canonicalPostContent(content), title);
}

function replaceContentBody(frontmatterSource: string, bodySource: string): string {
  const frontmatterLines = frontmatterBlockLines(frontmatterSource);
  if (!frontmatterLines) {
    return canonicalPostContent(frontmatterSource);
  }

  return ensureTrailingNewline([...frontmatterLines, contentBodyWithSpacing(bodySource)].join("\n").trimEnd());
}

function frontmatterBlockLines(content: string): string[] | undefined {
  const lines = canonicalPostContent(content).split("\n");
  if (lines[0] !== "---") {
    return undefined;
  }

  const frontmatterEnd = findFrontmatterEnd(lines);
  if (frontmatterEnd === undefined) {
    return undefined;
  }

  return lines.slice(0, frontmatterEnd + 1);
}

function contentBodyWithSpacing(content: string): string {
  const lines = canonicalPostContent(content).split("\n");
  if (lines[0] !== "---") {
    return canonicalPostContent(content).trimEnd();
  }

  const frontmatterEnd = findFrontmatterEnd(lines);
  if (frontmatterEnd === undefined) {
    return canonicalPostContent(content).trimEnd();
  }

  return lines.slice(frontmatterEnd + 1).join("\n").trimEnd();
}

function contentBody(content: string): string {
  return contentBodyWithSpacing(content).trim();
}

function bearBodyDiffersFromLocal(post: LocalPost, note: BearNote): boolean {
  return contentBody(post.content) !== contentBody(note.normalizedContent);
}

function bearMetadataNeedsSync(post: LocalPost, note: BearNote): boolean {
  return bearPresentationContent(note.content) !== contentForBearPreservingBody(post, note);
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "post";
}

function ensureFrontmatterSlug(content: string, slug: string): string {
  const lines = content.split("\n");
  if (lines[0] !== "---") {
    return content;
  }

  const frontmatterEnd = findFrontmatterEnd(lines);
  if (frontmatterEnd === undefined) {
    return content;
  }

  for (let index = 1; index < frontmatterEnd; index += 1) {
    if (/^slug:\s*/.test(lines[index] || "")) {
      lines[index] = `slug: "${slug}"`;
      return lines.join("\n");
    }
  }

  const titleIndex = lines.findIndex((line, index) => index > 0 && index < frontmatterEnd && /^title:\s*/.test(line));
  lines.splice(titleIndex === -1 ? frontmatterEnd : titleIndex + 1, 0, `slug: "${slug}"`);
  return lines.join("\n");
}

function inferTitleFromBodyHeading(content: string): string | undefined {
  const lines = content.split("\n");
  if (lines[0] !== "---") {
    return undefined;
  }

  const frontmatterEnd = findFrontmatterEnd(lines);
  if (frontmatterEnd === undefined) {
    return undefined;
  }

  let headingIndex = frontmatterEnd + 1;
  while (lines[headingIndex]?.trim() === "") {
    headingIndex += 1;
  }

  const heading = lines[headingIndex]?.match(/^#\s+(.+)$/);
  return heading?.[1]?.trim() || undefined;
}

function ensureFrontmatterTitle(content: string, title: string): string {
  const lines = content.split("\n");
  if (lines[0] !== "---") {
    return content;
  }

  const frontmatterEnd = findFrontmatterEnd(lines);
  if (frontmatterEnd === undefined) {
    return content;
  }

  for (let index = 1; index < frontmatterEnd; index += 1) {
    if (/^title:\s*/.test(lines[index] || "")) {
      lines[index] = `title: ${JSON.stringify(title)}`;
      return lines.join("\n");
    }
  }

  lines.splice(1, 0, `title: ${JSON.stringify(title)}`);
  return lines.join("\n");
}

function ensureFrontmatterBlock(content: string, fallbackTitle: string): string {
  const lines = content.split("\n");
  if (lines[0] === "---" && findFrontmatterEnd(lines) !== undefined) {
    return content;
  }

  const title = inferTitleFromLeadingHeading(content) || fallbackTitle || "Untitled";
  const slug = slugify(title);
  const date = new Date().toISOString().slice(0, 10);
  const body = content.trimStart();

  return ensureTrailingNewline(
    [
      "---",
      `title: ${JSON.stringify(title)}`,
      `slug: ${JSON.stringify(slug)}`,
      `date: ${JSON.stringify(date)}`,
      `description: ""`,
      `tags: []`,
      `draft: true`,
      "---",
      "",
      body,
    ]
      .join("\n")
      .trimEnd()
  );
}

function inferTitleFromLeadingHeading(content: string): string | undefined {
  const line = content.trimStart().split("\n")[0] || "";
  const heading = line.match(/^#\s+(.+)$/);
  return heading?.[1]?.trim() || undefined;
}

function bearPresentationContent(content: string): string {
  return ensureTrailingNewline(stripManagedBearTagLines(normalizeLineEndings(content)).trimEnd());
}

function stripBearTitleHeading(content: string): string {
  const lines = content.split("\n");
  if (!lines[0]?.startsWith("# ")) {
    return stripBearTitleHeadingAfterFrontmatter(content);
  }

  let index = 1;
  while (lines[index]?.trim() === "") {
    index += 1;
  }

  if (lines[index] !== "---") {
    return content;
  }

  return lines.slice(index).join("\n");
}

function stripBearTitleHeadingAfterFrontmatter(content: string): string {
  const lines = content.split("\n");
  if (lines[0] !== "---") {
    return content;
  }

  const frontmatterEnd = findFrontmatterEnd(lines);
  if (frontmatterEnd === undefined) {
    return content;
  }

  let headingIndex = frontmatterEnd + 1;
  while (lines[headingIndex]?.trim() === "") {
    headingIndex += 1;
  }

  if (!lines[headingIndex]?.startsWith("# ")) {
    return content;
  }

  const nextLinesStart = headingIndex + 1;
  const beforeHeading = lines.slice(0, frontmatterEnd + 1);
  const afterHeading = lines.slice(nextLinesStart);
  const hadBlankAfterHeading = afterHeading[0]?.trim() === "";
  while (afterHeading[0]?.trim() === "") {
    afterHeading.shift();
  }

  return [...beforeHeading, ...(hadBlankAfterHeading ? [""] : []), ...afterHeading].join("\n");
}

function addBearTitleHeading(content: string, title: string): string {
  const lines = content.split("\n");
  if (lines[0] !== "---") {
    return `# ${title}\n\n${content}`;
  }

  const frontmatterEnd = findFrontmatterEnd(lines);
  if (frontmatterEnd === undefined) {
    return `# ${title}\n\n${content}`;
  }

  const beforeBody = lines.slice(0, frontmatterEnd + 1);
  const body = lines.slice(frontmatterEnd + 1);
  const hasBlankBeforeBody = body[0]?.trim() === "";
  while (body[0]?.trim() === "") {
    body.shift();
  }

  return ensureTrailingNewline(
    [...beforeBody, "", `# ${title}`, ...(hasBlankBeforeBody ? [""] : []), ...body].join("\n").trimEnd()
  );
}

function findFrontmatterEnd(lines: string[]): number | undefined {
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index] === "---") {
      return index;
    }
  }
  return undefined;
}

function stripManagedBearTagLines(content: string): string {
  const lines = content.split("\n");
  const stripped: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] || "";
    if (isManagedBearTagLine(line)) {
      const previousLine = stripped[stripped.length - 1] || "";
      const nextLine = lines[index + 1] || "";
      if (previousLine.trim() === "" && nextLine.trim() === "") {
        index += 1;
      }
      continue;
    }
    stripped.push(line);
  }

  return stripped.join("\n");
}

function isManagedBearTagLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((token) => token === `#${MANAGED_TAG_PREFIX}` || token.startsWith(`#${MANAGED_TAG_PREFIX}/`));
}

function normalizeFrontmatterTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }
  return tags
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function desiredBearTags(path: string, frontmatter: PostFrontmatter): string[] {
  const tags = new Set<string>([MANAGED_TAG_PREFIX]);
  for (const tag of normalizeFrontmatterTags(frontmatter.tags)) {
    tags.add(`${MANAGED_TAG_PREFIX}/${tag}`);
  }
  if (frontmatter.draft) {
    tags.add(DRAFT_META_TAG);
  }
  if (path.startsWith("content/posts/articles/")) {
    tags.add(ARTICLE_META_TAG);
  }
  return [...tags].sort();
}

function normalizeBearTag(tag: string): string {
  return tag.replace(/^#/, "").trim();
}

function hasBearTag(note: BearNote, tag: string): boolean {
  return note.tags.map(normalizeBearTag).includes(tag);
}

function tagsNeedSync(note: BearNote, desiredTags: string[]): boolean {
  const current = new Set(note.tags.map(normalizeBearTag).filter((tag) => tag.startsWith(MANAGED_TAG_PREFIX)));
  const desired = new Set(desiredTags);
  if (current.size !== desired.size) {
    return true;
  }
  for (const tag of desired) {
    if (!current.has(tag)) {
      return true;
    }
  }
  return false;
}

function bearContentNeedsSync(post: LocalPost, note: BearNote): boolean {
  return bearPresentationContent(note.content) !== contentForBear(post);
}

async function getMarkdownFiles(dir: string): Promise<string[]> {
  const files = await readdir(dir, { recursive: true });
  return files
    .filter((file): file is string => typeof file === "string" && file.endsWith(".md"))
    .sort();
}

async function readLocalPosts(): Promise<LocalPost[]> {
  const files = await getMarkdownFiles(POSTS_DIR);
  const posts: LocalPost[] = [];

  for (const file of files) {
    const absolutePath = join(POSTS_DIR, file);
    const content = normalizeLineEndings(await readFile(absolutePath, "utf-8"));
    const frontmatter = parsePostFrontmatter(content, file);
    if (!frontmatter) {
      continue;
    }
    const path = `content/posts/${file}`;
    posts.push({ path, content, hash: sha256(canonicalPostContent(content)), frontmatter });
  }

  return posts;
}

async function loadState(): Promise<SyncState> {
  if (!existsSync(STATE_FILE)) {
    return {};
  }
  return JSON.parse(await readFile(STATE_FILE, "utf-8")) as SyncState;
}

async function saveState(state: SyncState): Promise<void> {
  const sorted = Object.fromEntries(Object.entries(state).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(STATE_FILE, `${JSON.stringify(sorted, null, 2)}\n`);
}

function runBearCli(args: string[], input?: string): string {
  const result = spawnSync("bearcli", args, {
    cwd: ROOT,
    input,
    encoding: "utf-8",
  });

  if (result.error) {
    throw new Error(`bearcli ${args.join(" ")} failed: ${result.error.message}`);
  }

  const stdout = result.stdout.trim();
  const stderr = result.stderr.trim();
  if (result.status !== 0) {
    throw new Error(`bearcli ${args.join(" ")} failed: ${stderr || stdout}`);
  }
  return stdout;
}

function runGit(args: string[]): string {
  const result = spawnSync("git", args, {
    cwd: ROOT,
    encoding: "utf-8",
  });

  if (result.error) {
    throw new Error(`git ${args.join(" ")} failed: ${result.error.message}`);
  }

  const stdout = result.stdout.trim();
  const stderr = result.stderr.trim();
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${stderr || stdout}`);
  }
  return stdout || stderr;
}

type BearCliRunner = (args: string[], input?: string) => string;
type SyncStateLoader = () => Promise<SyncState>;

export async function readBearNotes(
  bearCli: BearCliRunner = runBearCli,
  stateLoader: SyncStateLoader = loadState
): Promise<BearNote[]> {
  const state = await stateLoader();
  const notesById = new Map<string, BearNote>();
  for (const entry of Object.values(state)) {
    const note = readBearNoteById(entry.bearId, bearCli);
    if (note) {
      notesById.set(note.id, note);
    }
  }

  const output = bearCli([
    "list",
    "--tag",
    MANAGED_TAG_PREFIX,
    "--format",
    "json",
    "--fields",
    "id,title,tags,location",
  ]);
  const rawNotes = JSON.parse(output || "[]") as RawBearNoteMetadata[];

  for (const rawNote of rawNotes) {
    const note = readBearNote(rawNote, bearCli);
    notesById.set(note.id, note);
  }

  return [...notesById.values()];
}

interface RawBearNoteMetadata {
  id: string;
  title: string;
  tags?: string[];
  location?: string;
}

interface RawBearNoteContent {
  hash: string;
  content: string;
}

function readBearNote(metadata: RawBearNoteMetadata, bearCli: BearCliRunner): BearNote {
  const output = bearCli(["cat", metadata.id, "--format", "json"]);
  const noteContent = JSON.parse(output) as RawBearNoteContent;
  return normalizeBearNote({ ...metadata, ...noteContent });
}

function readBearNoteById(id: string, bearCli: BearCliRunner): BearNote | undefined {
  try {
    const output = bearCli(["show", id, "--format", "json", "--fields", "id,title,tags,location"]);
    return readBearNote(JSON.parse(output) as RawBearNoteMetadata, bearCli);
  } catch {
    return undefined;
  }
}

interface RawBearNote extends RawBearNoteMetadata, RawBearNoteContent {}

function normalizeBearNote(note: RawBearNote): BearNote {
  const content = normalizeLineEndings(note.content || "");
  const contentWithoutManagedTags = stripManagedBearTagLines(content);
  const contentWithFrontmatter = ensureFrontmatterBlock(contentWithoutManagedTags, note.title);
  const inferredTitle = inferTitleFromBodyHeading(contentWithFrontmatter);
  const contentWithTitle = inferredTitle ? ensureFrontmatterTitle(contentWithFrontmatter, inferredTitle) : contentWithFrontmatter;
  const rawNormalizedContent = canonicalPostContent(contentWithTitle);
  const frontmatter = parsePostFrontmatter(rawNormalizedContent, `Bear note ${note.id}`, false);
  const normalizedContent = frontmatter
    ? canonicalPostContent(ensureFrontmatterSlug(rawNormalizedContent, frontmatter.slug))
    : rawNormalizedContent;
  return {
    id: note.id,
    title: note.title,
    tags: note.tags || [],
    hash: note.hash,
    location: note.location,
    content,
    normalizedContent,
    normalizedHash: sha256(normalizedContent),
    frontmatter: frontmatter ? { ...frontmatter, slug: frontmatter.slug } : undefined,
  };
}

function indexByUnique<T>(items: T[], keyFor: (item: T) => string | undefined): Map<string, T | "ambiguous"> {
  const index = new Map<string, T | "ambiguous">();
  for (const item of items) {
    const key = keyFor(item);
    if (!key) {
      continue;
    }
    index.set(key, index.has(key) ? "ambiguous" : item);
  }
  return index;
}

function bearToFileSkip(note: BearNote): Extract<Action, { type: "skip" }> | undefined {
  if (!hasBearTag(note, WIP_TAG)) {
    return undefined;
  }
  return { type: "skip", reason: `Bear note ${note.id} (${note.title}) is tagged #${WIP_TAG}` };
}

export function planActions(
  localPosts: LocalPost[],
  bearNotes: BearNote[],
  state: SyncState,
  options: PlanOptions = {}
): Action[] {
  const planFromFiles = options.fromFiles ?? false;
  const planFromBear = options.fromBear ?? false;
  const planOverwriteBearContent = options.overwriteBearContent ?? false;
  const actions: Action[] = [];
  const notesById = new Map(bearNotes.map((note) => [note.id, note]));
  const postsByPath = new Map(localPosts.map((post) => [post.path, post]));
  const notesBySlug = indexByUnique(bearNotes, (note) => note.frontmatter?.slug);
  const notesByTitle = indexByUnique(bearNotes, (note) => note.frontmatter?.title || note.title);
  const matchedNoteIds = new Set<string>();
  const matchedPaths = new Set<string>();

  for (const post of localPosts) {
    const entry = state[post.path];
    let note = entry ? notesById.get(entry.bearId) : undefined;

    if (!note) {
      const bySlug = notesBySlug.get(post.frontmatter.slug);
      if (bySlug && bySlug !== "ambiguous") {
        note = bySlug;
      } else if (bySlug === "ambiguous") {
        actions.push({ type: "skip", reason: `Ambiguous Bear slug match for ${post.path}` });
        continue;
      }
    }

    if (!note) {
      const byTitle = notesByTitle.get(post.frontmatter.title);
      if (byTitle && byTitle !== "ambiguous") {
        note = byTitle;
      } else if (byTitle === "ambiguous") {
        actions.push({ type: "skip", reason: `Ambiguous Bear title match for ${post.path}` });
        continue;
      }
    }

    if (!note) {
      actions.push({ type: "create-bear", post });
      continue;
    }

    matchedNoteIds.add(note.id);
    matchedPaths.add(post.path);

    const effectiveEntry = entry || {
      bearId: note.id,
      slug: post.frontmatter.slug,
      lastFileHash: post.hash,
      lastBearHash: note.normalizedHash,
    };

    const fileChanged = planFromFiles || post.hash !== effectiveEntry.lastFileHash;
    const bearChanged = planFromBear || note.normalizedHash !== effectiveEntry.lastBearHash;
    const bearBodyChanged = bearBodyDiffersFromLocal(post, note);
    const bearPresentationChanged = planOverwriteBearContent
      ? bearContentNeedsSync(post, note)
      : bearMetadataNeedsSync(post, note);
    const tagChanged = tagsNeedSync(note, desiredBearTags(post.path, post.frontmatter));

    if (fileChanged && bearChanged && !planFromFiles && !planFromBear) {
      actions.push({ type: "conflict", post, note, reason: "Both local file and Bear note changed" });
    } else if (fileChanged && bearBodyChanged && !planOverwriteBearContent && !bearPresentationChanged) {
      actions.push({
        type: "skip",
        reason: `Local body differs from Bear for ${post.path}; re-run with --overwrite-bear-content to replace Bear content`,
      });
    } else if (fileChanged && !bearChanged) {
      actions.push({ type: "update-bear", post, note, entry: effectiveEntry });
    } else if (bearPresentationChanged && !bearChanged) {
      actions.push({ type: "update-bear", post, note, entry: effectiveEntry });
    } else if (bearChanged && !fileChanged) {
      actions.push(bearToFileSkip(note) ?? { type: "update-file", post, note, entry: effectiveEntry });
    } else if (planFromFiles) {
      actions.push({ type: "update-bear", post, note, entry: effectiveEntry });
    } else if (planFromBear) {
      actions.push(bearToFileSkip(note) ?? { type: "update-file", post, note, entry: effectiveEntry });
    } else {
      state[post.path] = {
        bearId: note.id,
        slug: post.frontmatter.slug,
        lastFileHash: post.hash,
        lastBearHash: note.normalizedHash,
      };
      if (tagChanged) {
        actions.push({ type: "sync-tags", post, note });
      }
    }
  }

  for (const [path, entry] of Object.entries(state)) {
    if (!postsByPath.has(path)) {
      const note = notesById.get(entry.bearId);
      if (note && !matchedNoteIds.has(note.id)) {
        actions.push({ type: "archive-bear", note, path });
        matchedNoteIds.add(note.id);
      }
    }
  }

  for (const note of bearNotes) {
    if (matchedNoteIds.has(note.id)) {
      continue;
    }
    const wipSkip = bearToFileSkip(note);
    if (wipSkip) {
      actions.push(wipSkip);
      continue;
    }
    if (!note.frontmatter) {
      actions.push({ type: "skip", reason: `Bear note ${note.id} (${note.title}) lacks required post frontmatter` });
      continue;
    }
    const path = pathForNewBearNote(note);
    if (matchedPaths.has(path) || postsByPath.has(path)) {
      actions.push({ type: "skip", reason: `Bear note ${note.id} maps to existing path ${path}` });
      continue;
    }
    actions.push({ type: "create-file", note, path });
  }

  return actions;
}

function pathForNewBearNote(note: BearNote): string {
  const frontmatter = note.frontmatter;
  if (!frontmatter) {
    throw new Error(`Bear note ${note.id} has no parseable frontmatter.`);
  }

  const dateParts = frontmatterDateParts(frontmatter.date);
  if (!dateParts) {
    throw new Error(`Bear note ${note.id} has invalid date: ${String(frontmatter.date)}`);
  }

  const isArticle = note.tags.map(normalizeBearTag).includes(ARTICLE_META_TAG);
  if (isArticle) {
    return `content/posts/articles/${dateParts.year}-${dateParts.month}-${frontmatter.slug}.md`;
  }
  return `content/posts/${dateParts.year}/${dateParts.month}-${dateParts.day}-${frontmatter.slug}.md`;
}

function frontmatterDateParts(value: string | Date): { year: string; month: string; day: string } | undefined {
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return { year: match[1]!, month: match[2]!, day: match[3]! };
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return {
    year: String(date.getFullYear()),
    month: String(date.getMonth() + 1).padStart(2, "0"),
    day: String(date.getDate()).padStart(2, "0"),
  };
}

function syncBearTags(noteId: string, currentTags: string[], desiredTags: string[]): void {
  const currentManagedTags = currentTags
    .map(normalizeBearTag)
    .filter((tag) => tag.startsWith(MANAGED_TAG_PREFIX));
  const desired = new Set(desiredTags);
  const tagsToRemove = currentManagedTags.filter((tag) => !desired.has(tag));
  const current = new Set(currentManagedTags);
  const tagsToAdd = desiredTags.filter((tag) => !current.has(tag));

  if (tagsToRemove.length > 0) {
    runBearCli(["tags", "remove", noteId, ...tagsToRemove]);
  }
  if (tagsToAdd.length > 0) {
    runBearCli(["tags", "add", noteId, ...tagsToAdd]);
  }
}

async function applyAction(action: Action, state: SyncState): Promise<void> {
  switch (action.type) {
    case "create-bear": {
      const content = contentForBear(action.post);
      const createOutput = runBearCli([
        "create",
        action.post.frontmatter.title,
        "--format",
        "json",
        "--fields",
        "id",
      ]);
      const created = JSON.parse(createOutput) as { id: string };
      runBearCli(["overwrite", created.id, "--force"], content);
      syncBearTags(created.id, [], desiredBearTags(action.post.path, action.post.frontmatter));
      state[action.post.path] = {
        bearId: created.id,
        slug: action.post.frontmatter.slug,
        lastFileHash: action.post.hash,
        lastBearHash: action.post.hash,
      };
      break;
    }
    case "update-bear": {
      const content = overwriteBearContent ? contentForBear(action.post) : contentForBearPreservingBody(action.post, action.note);
      const writtenHash = sha256(canonicalPostContent(content));
      runBearCli(["overwrite", action.note.id, "--base", action.note.hash, "--force"], content);
      syncBearTags(action.note.id, [], desiredBearTags(action.post.path, action.post.frontmatter));
      state[action.post.path] = {
        bearId: action.note.id,
        slug: action.post.frontmatter.slug,
        lastFileHash: writtenHash === action.post.hash ? action.post.hash : action.entry.lastFileHash,
        lastBearHash: writtenHash,
      };
      break;
    }
    case "update-file": {
      const content = ensureTrailingNewline(action.note.normalizedContent.trimEnd());
      const absolutePath = join(ROOT, action.post.path);
      await writeFile(absolutePath, content);
      runBearCli(
        ["overwrite", action.note.id, "--base", action.note.hash, "--force"],
        contentForBearContent(content, action.note.frontmatter?.title || action.post.frontmatter.title)
      );
      syncBearTags(
        action.note.id,
        [],
        desiredBearTags(action.post.path, action.note.frontmatter || action.post.frontmatter)
      );
      state[action.post.path] = {
        bearId: action.note.id,
        slug: action.note.frontmatter?.slug || action.post.frontmatter.slug,
        lastFileHash: sha256(content),
        lastBearHash: sha256(content),
      };
      break;
    }
    case "create-file": {
      const content = ensureTrailingNewline(action.note.normalizedContent.trimEnd());
      const absolutePath = join(ROOT, action.path);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, content, { flag: "wx" });
      runBearCli(
        ["overwrite", action.note.id, "--base", action.note.hash, "--force"],
        contentForBearContent(content, action.note.frontmatter!.title)
      );
      syncBearTags(action.note.id, [], desiredBearTags(action.path, action.note.frontmatter!));
      state[action.path] = {
        bearId: action.note.id,
        slug: action.note.frontmatter?.slug || "",
        lastFileHash: sha256(content),
        lastBearHash: sha256(content),
      };
      break;
    }
    case "sync-tags": {
      syncBearTags(action.note.id, action.note.tags, desiredBearTags(action.post.path, action.post.frontmatter));
      break;
    }
    case "archive-bear": {
      runBearCli(["archive", action.note.id]);
      delete state[action.path];
      break;
    }
    case "conflict":
    case "skip":
      break;
  }
}

type GitRunner = (args: string[]) => string;

interface GitPublication {
  commitOutput?: string;
  pushOutput?: string;
}

export interface PendingGitPathsStore {
  load: () => Promise<string[]>;
  save: (paths: string[]) => Promise<void>;
}

const pendingGitPathsStore: PendingGitPathsStore = {
  async load(): Promise<string[]> {
    if (!existsSync(PENDING_GIT_PATHS_FILE)) {
      return [];
    }

    const paths: unknown = JSON.parse(await readFile(PENDING_GIT_PATHS_FILE, "utf-8"));
    if (!Array.isArray(paths) || !paths.every((path): path is string => typeof path === "string")) {
      throw new Error(`${PENDING_GIT_PATHS_FILE} must contain an array of file paths.`);
    }
    return paths;
  },
  async save(paths: string[]): Promise<void> {
    if (paths.length === 0) {
      await rm(PENDING_GIT_PATHS_FILE, { force: true });
      return;
    }
    await writeFile(PENDING_GIT_PATHS_FILE, `${JSON.stringify(paths, null, 2)}\n`);
  },
};

export function commitAndPushFiles(paths: string[], git: GitRunner = runGit): GitPublication {
  const uniquePaths = [...new Set(paths)].sort();
  let commitOutput: string | undefined;

  if (uniquePaths.length > 0 && git(["status", "--porcelain", "--", ...uniquePaths])) {
    git(["add", "--", ...uniquePaths]);
    commitOutput = git([
      "commit",
      "--only",
      "-m",
      "chore: sync posts from Bear",
      "--",
      ...uniquePaths,
    ]);
  }

  const ahead = Number.parseInt(git(["rev-list", "--count", "@{upstream}..HEAD"]), 10);
  if (Number.isNaN(ahead)) {
    throw new Error("Could not determine whether the current branch is ahead of its upstream.");
  }

  const pushOutput = ahead > 0 ? git(["push"]) : undefined;
  return { commitOutput, pushOutput };
}

export async function publishPendingGitFiles(
  paths: string[],
  store: PendingGitPathsStore = pendingGitPathsStore,
  git: GitRunner = runGit
): Promise<GitPublication> {
  const pendingPaths = [...new Set([...(await store.load()), ...paths])].sort();
  if (pendingPaths.length > 0) {
    await store.save(pendingPaths);
  }

  const publication = commitAndPushFiles(pendingPaths, git);
  await store.save([]);
  return publication;
}

function describeAction(action: Action): string {
  switch (action.type) {
    case "create-bear":
      return `create Bear note for ${action.post.path}`;
    case "update-bear":
      return `update Bear note ${action.note.id} from ${action.post.path}`;
    case "update-file":
      return `update ${action.post.path} from Bear note ${action.note.id}`;
    case "sync-tags":
      return `sync Bear tags for ${action.post.path}`;
    case "create-file":
      return `create ${action.path} from Bear note ${action.note.id}`;
    case "archive-bear":
      return `archive Bear note ${action.note.id} for deleted ${action.path}`;
    case "conflict":
      return `CONFLICT ${action.post.path} / Bear note ${action.note.id}: ${action.reason}`;
    case "skip":
      return `skip: ${action.reason}`;
  }
}

async function main(): Promise<void> {
  const localPosts = await readLocalPosts();
  const bearNotes = await readBearNotes();
  const state = await loadState();
  const actions = planActions(localPosts, bearNotes, state, { fromFiles, fromBear, overwriteBearContent });
  const actionable = actions.filter((action) => action.type !== "skip" && action.type !== "conflict");

  console.log(`${dryRun ? "Dry run:" : "Sync:"} ${localPosts.length} local posts, ${bearNotes.length} Bear notes.`);
  if (actions.length === 0) {
    console.log("No changes.");
  } else {
    for (const action of actions) {
      console.log(`- ${describeAction(action)}`);
    }
  }

  if (dryRun) {
    console.log(`Dry run only. ${actionable.length} action(s) would be applied.`);
    return;
  }

  const changedFilePaths: string[] = [];
  for (const action of actions) {
    await applyAction(action, state);
    if (action.type === "update-file") {
      changedFilePaths.push(action.post.path);
    } else if (action.type === "create-file") {
      changedFilePaths.push(action.path);
    }
  }
  await saveState(state);
  if (commitAndPush) {
    const publication = await publishPendingGitFiles(changedFilePaths);
    if (publication.commitOutput) {
      console.log(publication.commitOutput);
    }
    if (publication.pushOutput) {
      console.log(publication.pushOutput);
    }
  }
  console.log(`Applied ${actionable.length} action(s).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
