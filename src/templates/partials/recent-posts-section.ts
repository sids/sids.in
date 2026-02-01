type RecentPostsSectionOptions = {
  title?: string;
  filterMarkup?: string;
  listMarkup: string;
  footerMarkup?: string;
};

export function recentPostsSection({
  title = "Recent Posts",
  filterMarkup = "",
  listMarkup,
  footerMarkup = "",
}: RecentPostsSectionOptions): string {
  return `<section class="mt-12" aria-labelledby="recent-posts-title">
  <h2 id="recent-posts-title" class="font-mono text-2xl font-medium mb-4">
    ${title}
  </h2>
  ${filterMarkup}
  ${listMarkup}
  ${footerMarkup}
</section>`;
}

export function recentPostsPartial(
  listMarkup: string,
  filterMarkup: string
): string {
  return listMarkup + filterMarkup;
}
