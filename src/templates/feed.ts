import { escapeHtml } from "../markdown.ts";

export function feedTemplate(): string {
  return `<article class="post-content">
  <h1 class="font-mono">Feed</h1>
  <p>Subscribe to all posts:</p>
  <ul>
    <li><a href="/posts/feed.atom" hx-boost="false" class="link-accent">Atom</a></li>
    <li><a href="/posts/feed.xml" hx-boost="false" class="link-accent">RSS</a></li>
  </ul>
  <p>Looking for specific topics? Visit a tag page and open its feed page.</p>
</article>`;
}

export function tagFeedTemplate(tag: string): string {
  const escapedTag = escapeHtml(tag);

  return `<article class="post-content">
  <h1 class="font-mono">Feed: <span class="text-accent">${escapedTag}</span></h1>
  <p>Subscribe to posts tagged <strong>${escapedTag}</strong>:</p>
  <ul>
    <li><a href="/tags/${tag}/feed.atom" hx-boost="false" class="link-accent">Atom</a></li>
    <li><a href="/tags/${tag}/feed.xml" hx-boost="false" class="link-accent">RSS</a></li>
  </ul>
  <p>Prefer the complete stream? Use the <a href="/posts/feed" class="link-accent">global feed page</a>.</p>
</article>`;
}
