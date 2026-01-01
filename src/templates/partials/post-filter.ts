export function postFilter(currentFilter: string = "all"): string {
  const filters = [
    { id: "all", label: "All Posts" },
    { id: "essay", label: "Essays" },
    { id: "link-log", label: "Link Log" },
  ];

  const buttons = filters
    .map(
      (f) =>
        `<button type="button" data-filter="${f.id}" class="post-filter-btn px-3 py-1 font-mono text-sm transition-colors ${
          f.id === currentFilter
            ? "text-accent"
            : "text-secondary hover:text-primary"
        }">${f.label}</button>`
    )
    .join("");

  return `<div class="post-filter flex gap-1 mb-6" role="tablist" aria-label="Filter posts">
  ${buttons}
</div>
<script>
(function() {
  const container = document.currentScript.parentElement;
  const buttons = container.querySelectorAll('.post-filter-btn');
  const articles = document.querySelectorAll('article[data-post-type]');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;

      // Update active button
      buttons.forEach(b => {
        b.classList.remove('text-accent');
        b.classList.add('text-secondary');
      });
      btn.classList.remove('text-secondary');
      btn.classList.add('text-accent');

      // Filter articles
      articles.forEach(article => {
        const postType = article.dataset.postType;
        if (filter === 'all' || postType === filter) {
          article.style.display = '';
        } else {
          article.style.display = 'none';
        }
      });
    });
  });
})();
</script>`;
}
