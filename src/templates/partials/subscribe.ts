const substackSubscribeUrl = "https://siddhartha.substack.com/subscribe?utm_source=sids.in";

export function newsletterSubscribeLink(): string {
  return `<a href="${substackSubscribeUrl}" hx-boost="false" class="inline-flex self-start rounded border border-border bg-secondary px-4 py-2 font-mono text-sm text-primary no-underline transition hover:text-accent">Subscribe on Substack</a>`;
}

export function newsletterSection(): string {
  return `<section class="mt-12">
  <h2 class="font-mono text-2xl font-medium mb-4">Newsletter</h2>
  <p class="text-secondary text-sm mb-4">Subscribe to my newsletter for an occasional roundup of interesting things.</p>
  ${newsletterSubscribeLink()}
</section>`;
}

export function postSubscribePrompt(): string {
  return `<div class="flex flex-col gap-3 mt-3">
  <p class="text-secondary text-sm">
    Enjoyed this post? Subscribe to RSS/Atom <a href="/posts/feed" class="link-accent">feed</a> or sign up for the newsletter:
  </p>
  ${newsletterSubscribeLink()}
</div>`;
}
