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
  content: string;
  normalizedContent: string;
  normalizedHash: string;
  frontmatter?: PostFrontmatter;
}

interface SyncEntry {
  bearId: string;
  lastFileHash: string;
  lastBearHash: string;
}

type SyncState = Record<string, SyncEntry>;

type Action =
  | { type: "create-bear"; post: LocalPost }
  | { type: "update-bear"; post: LocalPost; note: BearNote; entry: SyncEntry }
  | { type: "update-file"; post: LocalPost; note: BearNote; repairBear: boolean }
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
const WIP_META_TAG = `${MANAGED_TAG_PREFIX}/~wip`;

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const overwriteBearContent = args.has("--overwrite-bear-content");
const commitAndPush = args.has("--commit-and-push");

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

interface PostContentParts {
  frontmatterLines?: string[];
  body: string;
}

function splitPostContent(content: string): PostContentParts {
  const canonical = canonicalPostContent(content);
  const lines = canonical.split("\n");
  const frontmatterEnd = lines[0] === "---" ? findFrontmatterEnd(lines) : undefined;
  if (frontmatterEnd === undefined) {
    return { body: canonical.trimEnd() };
  }
  return {
    frontmatterLines: lines.slice(0, frontmatterEnd + 1),
    body: lines.slice(frontmatterEnd + 1).join("\n").trimEnd(),
  };
}

function replaceContentBody(frontmatterSource: string, bodySource: string): string {
  const source = splitPostContent(frontmatterSource);
  if (!source.frontmatterLines) {
    return canonicalPostContent(frontmatterSource);
  }
  return ensureTrailingNewline([...source.frontmatterLines, splitPostContent(bodySource).body].join("\n").trimEnd());
}

function contentBody(content: string): string {
  return splitPostContent(content).body.trim();
}

function bearBodyDiffersFromLocal(post: LocalPost, note: BearNote): boolean {
  return contentBody(post.content) !== contentBody(note.normalizedContent);
}

function bearMetadataNeedsSync(post: LocalPost, note: BearNote): boolean {
  return bearPresentationContent(note.content) !== contentForBearPreservingBody(post, note);
}

function bearNoteNeedsWriteback(note: BearNote): boolean {
  const title = note.frontmatter?.title || note.title;
  return bearPresentationContent(note.content) !== contentForBearContent(note.normalizedContent, title);
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

interface FrontmatterFieldOptions {
  after?: string;
  atStart?: boolean;
  onlyIfEmpty?: boolean;
  multiline?: boolean;
}

function setFrontmatterField(
  content: string,
  key: string,
  value: unknown,
  options: FrontmatterFieldOptions = {}
): string {
  const lines = content.split("\n");
  const frontmatterEnd = lines[0] === "---" ? findFrontmatterEnd(lines) : undefined;
  if (frontmatterEnd === undefined) {
    return content;
  }

  const fieldPattern = new RegExp(`^${key}:\\s*(.*)$`);
  for (let index = 1; index < frontmatterEnd; index += 1) {
    const match = lines[index]?.match(fieldPattern);
    if (!match) {
      continue;
    }
    if (options.onlyIfEmpty && !/^(?:""|''|null|~)?\s*$/.test(match[1] || "")) {
      return content;
    }
    let end = index + 1;
    if (options.multiline) {
      while (end < frontmatterEnd && /^\s+-\s+/.test(lines[end] || "")) {
        end += 1;
      }
    }
    lines.splice(index, end - index, `${key}: ${JSON.stringify(value)}`);
    return lines.join("\n");
  }

  const afterIndex = options.after
    ? lines.findIndex((line, index) => index > 0 && index < frontmatterEnd && line.startsWith(`${options.after}:`))
    : -1;
  const insertIndex = options.atStart ? 1 : afterIndex === -1 ? frontmatterEnd : afterIndex + 1;
  lines.splice(insertIndex, 0, `${key}: ${JSON.stringify(value)}`);
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

function ensureFrontmatterBlock(content: string, fallbackTitle: string, date: string): string {
  const lines = content.split("\n");
  if (lines[0] === "---" && findFrontmatterEnd(lines) !== undefined) {
    return content;
  }

  const title = inferTitleFromLeadingHeading(content) || fallbackTitle || "Untitled";
  const slug = slugify(title);
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
  const frontmatterEnd = lines[0] === "---" ? findFrontmatterEnd(lines) : undefined;
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

  const beforeHeading = lines.slice(0, frontmatterEnd + 1);
  const afterHeading = lines.slice(headingIndex + 1);
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

function normalizedBearTags(tags: string[]): Set<string> {
  return new Set(tags.map((tag) => tag.replace(/^#/, "").trim()).filter(Boolean));
}

function managedBearTags(tags: string[]): Set<string> {
  const managed = new Set(
    [...normalizedBearTags(tags)].filter(
      (tag) => tag === MANAGED_TAG_PREFIX || tag.startsWith(`${MANAGED_TAG_PREFIX}/`)
    )
  );
  if ([...managed].some((tag) => tag.startsWith(`${MANAGED_TAG_PREFIX}/`))) {
    managed.delete(MANAGED_TAG_PREFIX);
  }
  return managed;
}

function desiredBearTags(path: string, frontmatter: PostFrontmatter, existingTags: string[] = []): string[] {
  const tags = new Set<string>();
  for (const tag of normalizeFrontmatterTags(frontmatter.tags)) {
    tags.add(`${MANAGED_TAG_PREFIX}/${tag}`);
  }
  if (frontmatter.draft) {
    tags.add(DRAFT_META_TAG);
  }
  if (path.startsWith("content/posts/articles/")) {
    tags.add(ARTICLE_META_TAG);
  }
  if (normalizedBearTags(existingTags).has(WIP_META_TAG)) {
    tags.add(WIP_META_TAG);
  }
  if (tags.size === 0) {
    tags.add(MANAGED_TAG_PREFIX);
  }
  return [...tags].sort();
}

function tagsNeedSync(note: BearNote, path: string, frontmatter: PostFrontmatter): boolean {
  const current = managedBearTags(note.tags);
  const desired = new Set(desiredBearTags(path, frontmatter, note.tags));
  return current.size !== desired.size || [...desired].some((tag) => !current.has(tag));
}

function bearContentNeedsSync(post: LocalPost, note: BearNote): boolean {
  return bearPresentationContent(note.content) !== contentForBear(post);
}

async function readLocalPosts(): Promise<LocalPost[]> {
  const files = (await readdir(POSTS_DIR, { recursive: true }))
    .filter((file): file is string => typeof file === "string" && file.endsWith(".md"))
    .sort();
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

function runCommand(command: string, args: string[], input?: string): string {
  const result = spawnSync(command, args, { cwd: ROOT, input, encoding: "utf-8" });
  const stdout = result.stdout.trim();
  const stderr = result.stderr.trim();
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed: ${result.error?.message || stderr || stdout}`);
  }
  return stdout || stderr;
}

function runBearCli(args: string[], input?: string): string {
  return runCommand("bearcli", args, input);
}

function runGit(args: string[]): string {
  return runCommand("git", args);
}

type BearCliRunner = (args: string[], input?: string) => string;
type SyncStateLoader = () => Promise<SyncState>;

export async function readBearNotes(
  bearCli: BearCliRunner = runBearCli,
  stateLoader: SyncStateLoader = loadState
): Promise<BearNote[]> {
  const state = await stateLoader();
  // Bear search tags containing punctuation must be closed with a trailing #.
  // `list --tag sids.in` returns no matches even though the tag exists.
  const output = bearCli([
    "search",
    `#${MANAGED_TAG_PREFIX}#`,
    "--format",
    "json",
    "--fields",
    "id,title,tags",
  ]);
  const notesById = new Map<string, BearNote>();
  for (const metadata of JSON.parse(output || "[]") as RawBearNoteMetadata[]) {
    const note = readBearNote(metadata, bearCli);
    notesById.set(note.id, note);
  }

  for (const bearId of new Set(Object.values(state).map((entry) => entry.bearId))) {
    if (notesById.has(bearId)) {
      continue;
    }
    const note = readBearNoteById(bearId, bearCli);
    if (note) {
      notesById.set(note.id, note);
    }
  }

  return [...notesById.values()];
}

interface RawBearNoteMetadata {
  id: string;
  title: string;
  tags?: string[];
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
    const output = bearCli(["show", id, "--format", "json", "--fields", "id,title,tags"]);
    return readBearNote(JSON.parse(output) as RawBearNoteMetadata, bearCli);
  } catch {
    return undefined;
  }
}

interface RawBearNote extends RawBearNoteMetadata, RawBearNoteContent {}

function repairBearContent(note: RawBearNote): { content: string; frontmatter?: PostFrontmatter } {
  const today = new Date().toISOString().slice(0, 10);
  let content = ensureFrontmatterBlock(stripManagedBearTagLines(note.content), note.title, today);
  const title = inferTitleFromBodyHeading(content) || note.title.trim();
  if (title) {
    content = setFrontmatterField(content, "title", title, { atStart: true });
  }
  content = setFrontmatterField(content, "date", today, { after: "slug", onlyIfEmpty: true });
  content = canonicalPostContent(content);

  const frontmatter = parsePostFrontmatter(content, `Bear note ${note.id}`, false);
  if (!frontmatter) {
    return { content };
  }
  content = canonicalPostContent(setFrontmatterField(content, "slug", frontmatter.slug, { after: "title" }));
  return { content, frontmatter };
}

function normalizeBearNote(note: RawBearNote): BearNote {
  const content = normalizeLineEndings(note.content || "");
  const repaired = repairBearContent({ ...note, content });
  return {
    id: note.id,
    title: note.title,
    tags: note.tags || [],
    hash: note.hash,
    content,
    normalizedContent: repaired.content,
    normalizedHash: sha256(repaired.content),
    frontmatter: repaired.frontmatter,
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
  if (!normalizedBearTags(note.tags).has(WIP_META_TAG)) {
    return undefined;
  }
  return { type: "skip", reason: `Bear note ${note.id} (${note.title}) is tagged as WIP` };
}

export function planActions(
  localPosts: LocalPost[],
  bearNotes: BearNote[],
  state: SyncState,
  allowBodyOverwrite = false
): Action[] {
  const actions: Action[] = [];
  const notesById = new Map(bearNotes.map((note) => [note.id, note]));
  const postsByPath = new Map(localPosts.map((post) => [post.path, post]));
  const notesBySlug = indexByUnique(bearNotes, (note) => note.frontmatter?.slug);
  const notesByTitle = indexByUnique(bearNotes, (note) => note.frontmatter?.title || note.title);
  const matchedNoteIds = new Set<string>();

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

    const effectiveEntry = entry || {
      bearId: note.id,
      lastFileHash: post.hash,
      lastBearHash: note.normalizedHash,
    };

    const fileChanged = post.hash !== effectiveEntry.lastFileHash;
    const bearChanged = note.normalizedHash !== effectiveEntry.lastBearHash;
    const bearBodyChanged = bearBodyDiffersFromLocal(post, note);
    const bearPresentationChanged = allowBodyOverwrite
      ? bearContentNeedsSync(post, note)
      : bearMetadataNeedsSync(post, note);
    const tagChanged = tagsNeedSync(note, post.path, post.frontmatter);

    if (fileChanged && bearChanged) {
      actions.push({ type: "conflict", post, note, reason: "Both local file and Bear note changed" });
    } else if (fileChanged && bearBodyChanged && !allowBodyOverwrite && !bearPresentationChanged) {
      actions.push({
        type: "skip",
        reason: `Local body differs from Bear for ${post.path}; re-run with --overwrite-bear-content to replace Bear content`,
      });
    } else if (fileChanged && !bearChanged) {
      actions.push({ type: "update-bear", post, note, entry: effectiveEntry });
    } else if (bearPresentationChanged && !bearChanged) {
      actions.push({ type: "update-bear", post, note, entry: effectiveEntry });
    } else if (bearChanged && !fileChanged) {
      actions.push(
        bearToFileSkip(note) ?? { type: "update-file", post, note, repairBear: bearNoteNeedsWriteback(note) }
      );
    } else {
      state[post.path] = {
        bearId: note.id,
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
    const noteForImport = addBearTagsToFrontmatter(note);
    const path = pathForNewBearNote(noteForImport);
    if (postsByPath.has(path)) {
      actions.push({ type: "skip", reason: `Bear note ${note.id} maps to existing path ${path}` });
      continue;
    }
    actions.push({ type: "create-file", note: noteForImport, path });
  }

  return actions;
}

function addBearTagsToFrontmatter(note: BearNote): BearNote {
  if (!note.frontmatter) {
    return note;
  }

  const tags = new Set(normalizeFrontmatterTags(note.frontmatter.tags));
  for (const tag of normalizedBearTags(note.tags)) {
    const prefix = `${MANAGED_TAG_PREFIX}/`;
    if (!tag.startsWith(prefix)) {
      continue;
    }
    const nestedTag = tag.slice(prefix.length);
    if (nestedTag && !nestedTag.startsWith("~")) {
      tags.add(nestedTag);
    }
  }

  const mergedTags = [...tags].sort();
  const currentTags = normalizeFrontmatterTags(note.frontmatter.tags);
  if (mergedTags.length === currentTags.length && mergedTags.every((tag, index) => tag === currentTags[index])) {
    return note;
  }

  const normalizedContent = setFrontmatterField(note.normalizedContent, "tags", mergedTags, { multiline: true });
  return {
    ...note,
    normalizedContent,
    normalizedHash: sha256(normalizedContent),
    frontmatter: { ...note.frontmatter, tags: mergedTags },
  };
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

  const isArticle = normalizedBearTags(note.tags).has(ARTICLE_META_TAG);
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
  const current = managedBearTags(currentTags);
  const desired = new Set(desiredTags);
  const tagsToRemove = [...current].filter((tag) => !desired.has(tag));
  const tagsToAdd = desiredTags.filter((tag) => !current.has(tag));

  if (tagsToRemove.length > 0) {
    runBearCli(["tags", "remove", noteId, ...tagsToRemove]);
  }
  if (tagsToAdd.length > 0) {
    runBearCli(["tags", "add", noteId, ...tagsToAdd]);
  }
}

function overwriteBearNote(note: BearNote, content: string, path: string, frontmatter: PostFrontmatter): void {
  runBearCli(["overwrite", note.id, "--base", note.hash, "--force"], content);
  // Overwrite clears Bear tags, so re-add the complete desired set.
  syncBearTags(note.id, [], desiredBearTags(path, frontmatter, note.tags));
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
        lastFileHash: action.post.hash,
        lastBearHash: action.post.hash,
      };
      break;
    }
    case "update-bear": {
      const content = overwriteBearContent ? contentForBear(action.post) : contentForBearPreservingBody(action.post, action.note);
      const writtenHash = sha256(canonicalPostContent(content));
      overwriteBearNote(action.note, content, action.post.path, action.post.frontmatter);
      state[action.post.path] = {
        bearId: action.note.id,
        lastFileHash: writtenHash === action.post.hash ? action.post.hash : action.entry.lastFileHash,
        lastBearHash: writtenHash,
      };
      break;
    }
    case "update-file": {
      const content = action.note.normalizedContent;
      const frontmatter = action.note.frontmatter || action.post.frontmatter;
      await writeFile(join(ROOT, action.post.path), content);
      if (action.repairBear) {
        overwriteBearNote(
          action.note,
          contentForBearContent(content, frontmatter.title),
          action.post.path,
          frontmatter
        );
      } else {
        syncBearTags(
          action.note.id,
          action.note.tags,
          desiredBearTags(action.post.path, frontmatter, action.note.tags)
        );
      }
      state[action.post.path] = {
        bearId: action.note.id,
        lastFileHash: action.note.normalizedHash,
        lastBearHash: action.note.normalizedHash,
      };
      break;
    }
    case "create-file": {
      const content = action.note.normalizedContent;
      const frontmatter = action.note.frontmatter!;
      const absolutePath = join(ROOT, action.path);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, content, { flag: "wx" });
      overwriteBearNote(action.note, contentForBearContent(content, frontmatter.title), action.path, frontmatter);
      state[action.path] = {
        bearId: action.note.id,
        lastFileHash: action.note.normalizedHash,
        lastBearHash: action.note.normalizedHash,
      };
      break;
    }
    case "sync-tags": {
      syncBearTags(
        action.note.id,
        action.note.tags,
        desiredBearTags(action.post.path, action.post.frontmatter, action.note.tags)
      );
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

function pushHeadToUpstream(git: GitRunner): string {
  const branch = git(["branch", "--show-current"]);
  if (!branch) {
    throw new Error("Cannot push Bear sync changes from a detached HEAD.");
  }

  const remote = git(["config", "--get", `branch.${branch}.remote`]);
  const mergeRef = git(["config", "--get", `branch.${branch}.merge`]);
  const headsPrefix = "refs/heads/";
  if (!remote || !mergeRef.startsWith(headsPrefix)) {
    throw new Error(`Could not determine the upstream destination for branch ${branch}.`);
  }

  return git(["push", remote, `HEAD:${mergeRef.slice(headsPrefix.length)}`]);
}

export function commitAndPushFiles(paths: string[], git: GitRunner = runGit): GitPublication {
  const uniquePaths = [...new Set(paths)].sort();
  if (uniquePaths.length === 0) {
    return {};
  }
  let commitOutput: string | undefined;

  if (git(["status", "--porcelain", "--", ...uniquePaths])) {
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

  const pushOutput = ahead > 0 ? pushHeadToUpstream(git) : undefined;
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
  const actions = planActions(localPosts, bearNotes, state, overwriteBearContent);
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
