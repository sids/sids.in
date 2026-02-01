import { escapeHtml } from "../../markdown.ts";

export type TagFilterType = "all" | string;

export function tagFilter(
  basePath: string,
  tags: string[],
  currentFilter: TagFilterType = "all",
  oob: boolean = false
): string {
  if (tags.length === 0) {
    return "";
  }

  const filters = ["all", ...tags];
  const links = filters
    .map((tag) => {
      const isAll = tag === "all";
      const href = isAll ? basePath : `${basePath}?tag=${encodeURIComponent(tag)}`;
      const isActive = tag === currentFilter;
      const label = isAll ? "All\u00A0Posts" : escapeHtml(tag);
      const activeClass = "bg-accent/15 text-accent";
      const inactiveClass = "text-secondary hover:text-primary hover:bg-primary/5";
      return `<a href="${href}" hx-target="#posts-list" hx-swap="outerHTML show:none" hx-push-url="true" class="px-3 py-1.5 rounded-md text-sm no-underline transition-colors ${
        isActive ? activeClass : inactiveClass
      }">${label}</a>`;
    })
    .join("");

  const oobAttr = oob ? ' hx-swap-oob="true"' : "";
  return `<nav id="post-filter" class="flex gap-1 mb-6 flex-wrap" role="navigation" aria-label="Filter posts by tag"${oobAttr}>
  ${links}
</nav>`;
}
