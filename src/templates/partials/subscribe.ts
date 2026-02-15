export function newsletterEmbed(): string {
  return `<section class="mt-12">
  <h2 class="font-mono text-2xl font-medium mb-4">Newsletter</h2>
  <p class="text-secondary text-sm mb-4">Subscribe to my newsletter for an occasional roundup of interesting things.</p>
  <iframe src="https://siddhartha.substack.com/embed" width="480" height="320" style="border: 1px solid var(--border); border-radius: 8px; background: white; max-width: 100%;" frameborder="0" scrolling="no"></iframe>
</section>`;
}

export function postSubscribePrompt(): string {
  return `<div class="flex flex-col gap-3 mt-3">
  <p class="text-secondary text-sm">
    Enjoyed this post? Subscribe via <a href="/posts/feed.xml" class="link-accent">RSS</a> or sign up for the newsletter:
  </p>
  <iframe src="https://siddhartha.substack.com/embed" width="480" height="150" style="border: 1px solid var(--border); border-radius: 8px; background: white; max-width: 100%;" frameborder="0" scrolling="no"></iframe>
</div>`;
}
