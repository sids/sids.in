type PostFilter = "all" | "essay" | "link-log";

export function postFilter(basePath: string, currentFilter: PostFilter = "all"): string {
  const filters: { id: PostFilter; label: string }[] = [
    { id: "all", label: "All Posts" },
    { id: "essay", label: "Essays" },
    { id: "link-log", label: "Link Log" },
  ];

  const links = filters
    .map((f) => {
      const href = f.id === "all" ? basePath : `${basePath}?type=${f.id}`;
      const isActive = f.id === currentFilter;
      return `<a href="${href}" hx-target="#posts-list" hx-swap="outerHTML" hx-push-url="true" class="px-3 py-1 font-mono text-sm no-underline transition-colors ${
        isActive ? "text-accent" : "text-secondary hover:text-primary"
      }">${f.label}</a>`;
    })
    .join("");

  return `<nav class="post-filter flex gap-1 mb-6" role="navigation" aria-label="Filter posts">
  ${links}
</nav>`;
}
