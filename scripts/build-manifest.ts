import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { execSync } from "node:child_process";
import fm from "front-matter";

interface PostFrontmatter {
  title: string;
  slug: string;
  date: string;
  description?: string;
  tags: string[];
  draft?: boolean;
  link?: string;
}

interface PageFrontmatter {
  title: string;
  description?: string;
}

const CONTENT_DIR = join(import.meta.dir, "..", "content");
const OUTPUT_FILE = join(import.meta.dir, "..", "src", "manifest.ts");
const SITEMAP_FILE = join(import.meta.dir, "..", "public", "sitemap.xml");
const SITE_URL = "https://sids.in";

function getGitCommitHash(): string | null {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

async function getMarkdownFiles(dir: string): Promise<string[]> {
  try {
    const files = await readdir(dir, { recursive: true });
    return files.filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
}

function generateSitemap(
  pageFiles: string[],
  postMetaEntries: { meta: PostFrontmatter }[],
  tagIndex: Record<string, string[]>
): string {
  const urls: string[] = [];

  // Homepage
  urls.push(`  <url>
    <loc>${SITE_URL}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`);

  // Static pages
  for (const file of pageFiles) {
    const slug = basename(file, ".md");
    if (slug !== "home") {
      urls.push(`  <url>
    <loc>${SITE_URL}/${slug}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`);
    }
  }

  // Posts list page
  urls.push(`  <url>
    <loc>${SITE_URL}/posts</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`);

  // Archive page
  urls.push(`  <url>
    <loc>${SITE_URL}/archive</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`);

  // Individual posts
  for (const { meta } of postMetaEntries) {
    urls.push(`  <url>
    <loc>${SITE_URL}/posts/${meta.slug}</loc>
    <lastmod>${meta.date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`);
  }

  // Tag pages
  for (const tag of Object.keys(tagIndex)) {
    urls.push(`  <url>
    <loc>${SITE_URL}/tags/${tag}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
}

async function buildManifest() {
  const pagesDir = join(CONTENT_DIR, "pages");
  const postsDir = join(CONTENT_DIR, "posts");

  const pageFiles = await getMarkdownFiles(pagesDir);
  const postFiles = await getMarkdownFiles(postsDir);

  const imports: string[] = [];
  const pageEntries: string[] = [];
  const postMetaEntries: { meta: PostFrontmatter; varName: string; file: string }[] = [];
  const allPostMetaEntries: { meta: PostFrontmatter; file: string }[] = [];
  const postContentEntries: string[] = [];

  // Process pages
  for (const file of pageFiles) {
    const slug = basename(file, ".md");
    const varName = `page_${file.replace(/\.md$/, "").replace(/[\/-]/g, "_")}`;
    const relativePath = `../content/pages/${file}`;

    imports.push(`import ${varName} from "${relativePath}";`);

    const content = await readFile(join(pagesDir, file), "utf-8");
    const { attributes } = fm<PageFrontmatter>(content);

    pageEntries.push(
      `  "${slug}": { title: ${JSON.stringify(attributes.title)}, description: ${JSON.stringify(attributes.description || "")}, content: ${varName} }`
    );
  }

  // Process posts
  for (const file of postFiles) {
    const varName = `post_${file.replace(/\.md$/, "").replace(/[\/-]/g, "_")}`;
    const relativePath = `../content/posts/${file}`;

    imports.push(`import ${varName} from "${relativePath}";`);

    const content = await readFile(join(postsDir, file), "utf-8");
    const { attributes } = fm<PostFrontmatter>(content);

    if (!attributes.slug) {
      continue;
    }

    // Only use explicit frontmatter description (don't auto-generate)
    allPostMetaEntries.push({ meta: { ...attributes }, file });
    postContentEntries.push(`  "${attributes.slug}": ${varName}`);

    if (attributes.draft) {
      continue;
    }

    postMetaEntries.push({ meta: { ...attributes }, varName, file });
  }

  // Sort posts by date descending
  postMetaEntries.sort(
    (a, b) => new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime()
  );

  // Build tag index
  const tagIndex: Record<string, string[]> = {};
  for (const { meta } of postMetaEntries) {
    for (const tag of meta.tags || []) {
      if (!tagIndex[tag]) {
        tagIndex[tag] = [];
      }
      tagIndex[tag].push(meta.slug);
    }
  }

  // Build allTags sorted by count
  const allTags = Object.entries(tagIndex)
    .map(([tag, slugs]) => ({ tag, count: slugs.length }))
    .sort((a, b) => b.count - a.count);

  const postMetaArray = postMetaEntries.map(({ meta, file }) => {
    const [topLevelDir] = file.split("/");
    const isEssay = topLevelDir === "essays";
    const postType = isEssay ? "essay" : meta.link ? "link" : "aside";
    return `  { title: ${JSON.stringify(meta.title)}, slug: ${JSON.stringify(meta.slug)}, date: ${JSON.stringify(meta.date)}${meta.description ? `, description: ${JSON.stringify(meta.description)}` : ""}, tags: ${JSON.stringify(meta.tags || [])}${meta.link ? `, link: ${JSON.stringify(meta.link)}` : ""}, postType: ${JSON.stringify(postType)} }`;
  });

  const postMetaBySlug = allPostMetaEntries
    .map(({ meta, file }) => {
      const [topLevelDir] = file.split("/");
      const isEssay = topLevelDir === "essays";
      const postType = isEssay ? "essay" : meta.link ? "link" : "aside";
      return `  ${JSON.stringify(meta.slug)}: { title: ${JSON.stringify(meta.title)}, slug: ${JSON.stringify(meta.slug)}, date: ${JSON.stringify(meta.date)}${meta.description ? `, description: ${JSON.stringify(meta.description)}` : ""}, tags: ${JSON.stringify(meta.tags || [])}, draft: ${Boolean(meta.draft)}${meta.link ? `, link: ${JSON.stringify(meta.link)}` : ""}, postType: ${JSON.stringify(postType)} }`;
    })
    .join(",\n");

  const contentVersion = getGitCommitHash();

  const output = `// Auto-generated by scripts/build-manifest.ts
import type { PostMeta, TagInfo } from "./types.ts";

${imports.join("\n")}

export const contentVersion: string | null = ${JSON.stringify(contentVersion)};

export const pages: Record<string, { title: string; description: string; content: string }> = {
${pageEntries.join(",\n")}
};

export const posts: PostMeta[] = [
${postMetaArray.join(",\n")}
];

export const postContent: Record<string, string> = {
${postContentEntries.join(",\n")}
};

export const postMetaBySlug: Record<string, PostMeta> = {
${postMetaBySlug}
};

export const tagIndex: Record<string, string[]> = ${JSON.stringify(tagIndex, null, 2)};

export const allTags: TagInfo[] = ${JSON.stringify(allTags, null, 2)};
`;

  await writeFile(OUTPUT_FILE, output);
  console.log(`Manifest generated: ${OUTPUT_FILE}`);
  console.log(`  Pages: ${pageFiles.length}`);
  console.log(`  Posts: ${postMetaEntries.length}`);
  console.log(`  Tags: ${allTags.length}`);

  // Generate sitemap
  const sitemap = generateSitemap(pageFiles, postMetaEntries, tagIndex);
  await writeFile(SITEMAP_FILE, sitemap);
  console.log(`Sitemap generated: ${SITEMAP_FILE}`);
}

buildManifest().catch(console.error);
