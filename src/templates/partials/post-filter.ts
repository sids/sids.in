export type PostFilterType = "all" | "essay" | "brief" | "link-log";

export function postFilter(basePath: string, currentFilter: PostFilterType = "all", oob: boolean = false): string {
  const filters: { id: PostFilterType; label: string }[] = [
    { id: "all", label: "All Posts" },
    { id: "essay", label: "Essays" },
    { id: "brief", label: "✦ Briefs" },
    { id: "link-log", label: "↗ Link Log" },
  ];

  const links = filters
    .map((f) => {
      const href = f.id === "all" ? basePath : `${basePath}?type=${f.id}`;
      const isActive = f.id === currentFilter;
      const activeClass = "bg-accent/15 text-accent";
      const inactiveClass = "text-secondary hover:text-primary hover:bg-primary/5";
      return `<a href="${href}" hx-target="#posts-list" hx-swap="outerHTML show:none" hx-push-url="true" class="px-3 py-1.5 rounded-md text-sm no-underline transition-colors ${
        isActive ? activeClass : inactiveClass
      }">${f.label}</a>`;
    })
    .join("");

  const oobAttr = oob ? ' hx-swap-oob="true"' : '';
  return `<nav id="post-filter" class="flex gap-1 mb-6" role="navigation" aria-label="Filter posts"${oobAttr}>
  ${links}
</nav>`;
}
