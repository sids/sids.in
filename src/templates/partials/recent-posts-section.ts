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
  return `<aside class="mt-12" aria-labelledby="recent-posts-title" role="complementary" data-content-role="related-posts">
  <h2 id="recent-posts-title" class="font-mono text-2xl font-medium mb-4">
    ${title}
  </h2>
  ${filterMarkup}
  ${listMarkup}
  ${footerMarkup}
</aside>`;
}

export function recentPostsPartial(
  listMarkup: string,
  filterMarkup: string
): string {
  return listMarkup + filterMarkup;
}
