export function notFoundTemplate(): string {
  return `<article class="post-content">
  <h1 class="font-mono">404</h1>
  <p>The page you're looking for doesn't exist.</p>
  <p>
    Head back <a href="/" class="link-accent">home</a>,
    browse the <a href="/posts" class="link-accent">posts</a>,
    or check the <a href="/archive" class="link-accent">archive</a>.
  </p>
</article>`;
}
