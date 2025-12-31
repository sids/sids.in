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

  // If no description in frontmatter, extract from body
  const description = attributes.description || extractDescriptionFromBody(body);

  return {
    title: attributes.title,
    slug: attributes.slug,
    date: attributes.date,
    description,
    tags: attributes.tags || [],
    draft: attributes.draft,
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

function extractDescriptionFromBody(body: string, maxLength: number = 300): string {
  // Remove code blocks
  let text = body.replace(/```[\s\S]*?```/g, "");

  // Remove inline code (but preserve the text)
  text = text.replace(/`([^`]+)`/g, "$1");

  // Remove images
  text = text.replace(/!\[([^\]]*)\]\([^\)]+\)/g, "");

  // Remove heading markers but keep the text
  text = text.replace(/^#+\s+/gm, "");

  // Collapse multiple newlines into double newlines (preserve paragraphs)
  text = text.replace(/\n{3,}/g, "\n\n");

  // Trim each line but preserve line breaks
  text = text.split("\n").map(line => line.trim()).join("\n");

  // Remove leading/trailing whitespace
  text = text.trim();

  // Take first maxLength characters at word boundary, preserving structure
  if (text.length <= maxLength) {
    return text;
  }

  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  const lastNewline = truncated.lastIndexOf("\n");
  const breakPoint = Math.max(lastSpace, lastNewline);
  return (breakPoint > 0 ? truncated.slice(0, breakPoint) : truncated).trim() + "...";
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
