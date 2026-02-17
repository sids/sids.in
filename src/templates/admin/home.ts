export function adminHomeTemplate(): string {
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

    <form method="POST" action="/admin/logout" hx-boost="false">
      <button type="submit" class="font-mono text-sm text-secondary hover:text-accent transition">Sign out</button>
    </form>
  </section>
  `;
}
