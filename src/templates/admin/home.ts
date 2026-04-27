import { escapeHtml } from "../../markdown.ts";
import type { PostMeta } from "../../types.ts";
import { formatPostDate } from "../format-date.ts";

export function adminHomeTemplate(draftPosts: PostMeta[]): string {
  return `
  <section class="flex flex-col gap-8">
    <header class="flex flex-col gap-3">
      <p class="font-mono text-sm text-secondary">Admin</p>
      <h1 class="text-3xl font-mono text-primary">Admin dashboard</h1>
      <p class="text-secondary">Create new content for the site.</p>
    </header>

    <div class="flex flex-col gap-4">
      <a href="/admin/link-log" class="link-accent font-mono text-sm">New link log entry →</a>
      <a href="/admin/note" class="link-accent font-mono text-sm">New note entry →</a>
    </div>

    ${draftPostsSection(draftPosts)}

    <form method="POST" action="/admin/logout" hx-boost="false">
      <button type="submit" class="font-mono text-sm text-secondary hover:text-accent transition">Sign out</button>
    </form>
  </section>
  `;
}

function draftPostsSection(draftPosts: PostMeta[]): string {
  const content = draftPosts.length === 0
    ? `<p class="text-sm text-secondary">No draft posts.</p>`
    : `<ul class="flex flex-col divide-y divide-border border border-border bg-secondary">
        ${draftPosts.map(draftPostItem).join("")}
      </ul>`;

  return `
    <section class="flex flex-col gap-3" aria-labelledby="draft-posts-heading">
      <div class="flex flex-col gap-1">
        <h2 id="draft-posts-heading" class="font-mono text-xl text-primary">Draft posts</h2>
        <p class="text-sm text-secondary">Preview posts that are hidden from public lists.</p>
      </div>
      ${content}
    </section>
  `;
}

function draftPostItem(post: PostMeta): string {
  const sourcePath = post.sourcePath
    ? `<p class="mt-1 font-mono text-xs text-secondary">${escapeHtml(post.sourcePath)}</p>`
    : "";

  return `
    <li class="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <a href="/posts/${escapeHtml(post.slug)}" class="link-accent font-mono text-sm">${escapeHtml(post.title)}</a>
        ${sourcePath}
      </div>
      <div class="flex shrink-0 flex-wrap gap-2 font-mono text-xs text-secondary sm:justify-end">
        <span>${escapeHtml(formatPostDate(post.date))}</span>
        <span aria-hidden="true">·</span>
        <span>${escapeHtml(formatPostType(post.postType))}</span>
      </div>
    </li>
  `;
}

function formatPostType(postType: PostMeta["postType"]): string {
  if (postType === "link") {
    return "Link log";
  }

  return postType.charAt(0).toUpperCase() + postType.slice(1);
}
