import { marked } from "marked";
import fm from "front-matter";
import type { PageMeta, PostMeta, Page, Post } from "./types.ts";

export function parsePage(rawMarkdown: string, slug: string): Page {
  const { attributes, body } = fm<PageMeta>(rawMarkdown);
  const html = marked.parse(body, { async: false }) as string;

  return {
    slug,
    title: attributes.title,
    description: attributes.description,
    html,
  };
}

export function parsePost(rawMarkdown: string): Post {
  const { attributes, body } = fm<PostMeta>(rawMarkdown);
  const html = marked.parse(body, { async: false }) as string;
  const excerpt = extractExcerpt(html, 150);

  // Only use explicit frontmatter description (don't auto-generate)
  const description = attributes.description;

  return {
    title: attributes.title,
    slug: attributes.slug,
    date: attributes.date,
    description,
    tags: attributes.tags || [],
    draft: attributes.draft,
    link: attributes.link,
    html,
    excerpt,
  };
}

function extractExcerpt(html: string, maxLength: number): string {
  const text = html
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maxLength) {
    return text;
  }

  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "...";
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
