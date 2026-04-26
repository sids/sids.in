const newsletterSubscribePath = "/newsletter/subscribe";

export function newsletterSignupForm(): string {
  return `<form action="${newsletterSubscribePath}" method="post" hx-boost="false" class="flex w-full max-w-md flex-col gap-2 sm:flex-row">
  <label for="newsletter-email" class="sr-only">Email address</label>
  <input id="newsletter-email" name="email" type="email" required placeholder="Email address" class="min-w-0 flex-1 rounded border border-border bg-primary px-3 py-2 text-primary placeholder:text-secondary">
  <button type="submit" class="rounded border border-border bg-secondary px-4 py-2 font-mono text-sm text-primary transition hover:text-accent">Subscribe</button>
</form>`;
}

export function newsletterSection(): string {
  return `<section class="mt-12">
  <h2 class="font-mono text-2xl font-medium mb-4">Newsletter</h2>
  <p class="text-secondary text-sm mb-4">Subscribe to my newsletter for an occasional roundup of interesting things.</p>
  ${newsletterSignupForm()}
</section>`;
}

export function postSubscribePrompt(): string {
  return `<div class="flex flex-col gap-3 mt-3">
  <p class="text-secondary text-sm">
    Enjoyed this post? Subscribe to RSS/Atom <a href="/posts/feed" class="link-accent">feed</a> or sign up for the newsletter:
  </p>
  ${newsletterSignupForm()}
</div>`;
}
