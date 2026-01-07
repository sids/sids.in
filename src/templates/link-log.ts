import type { TagInfo } from "../types.ts";
import { escapeHtml } from "../markdown.ts";

export function linkLogTemplate(origin: string, tags: TagInfo[]): string {
  const bookmarklet = buildBookmarklet(origin);
  const tagOptions = tags
    .map((tag) => `"${escapeHtml(tag.tag)}"`)
    .join(", ");

  return `
  <section class="flex flex-col gap-8">
    <header class="flex flex-col gap-3">
      <p class="font-mono text-sm text-secondary">Link Log</p>
      <h1 class="text-3xl font-mono text-primary">New link log entry</h1>
      <p class="text-secondary">
        Save this bookmarklet in Safari or Chrome:
        <a class="link-accent break-all" href="${escapeHtml(bookmarklet)}">Post to sids.in</a>
      </p>
    </header>

    <form id="link-log-form" class="flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <label for="url" class="font-mono text-xs uppercase text-secondary">Link</label>
        <input id="url" name="url" type="url" required class="w-full rounded border border-border bg-primary px-3 py-2 text-primary" placeholder="https://example.com">
      </div>

      <div class="flex flex-col gap-2">
        <label for="title" class="font-mono text-xs uppercase text-secondary">Title</label>
        <input id="title" name="title" type="text" required class="w-full rounded border border-border bg-primary px-3 py-2 text-primary" placeholder="Auto-filled from the page title">
      </div>

      <div class="flex flex-col gap-2">
        <label for="description" class="font-mono text-xs uppercase text-secondary">Description</label>
        <input id="description" name="description" type="text" class="w-full rounded border border-border bg-primary px-3 py-2 text-primary" placeholder="Optional summary for cards">
      </div>

      <div class="flex flex-col gap-2">
        <label for="tags" class="font-mono text-xs uppercase text-secondary">Tags</label>
        <div id="tag-chips" class="flex flex-wrap gap-2"></div>
        <input id="tags" name="tags" type="text" class="w-full rounded border border-border bg-primary px-3 py-2 text-primary" placeholder="Comma-separated tags">
        <div id="tag-suggestions" class="relative">
          <div id="tag-suggestions-list" class="absolute z-10 mt-2 hidden w-full rounded border border-border bg-primary shadow-sm"></div>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <label for="content" class="font-mono text-xs uppercase text-secondary">Content</label>
        <textarea id="content" name="content" rows="10" class="w-full rounded border border-border bg-primary px-3 py-2 text-primary" placeholder="Selected text is inserted as a blockquote."></textarea>
      </div>

      <button type="submit" class="inline-flex items-center justify-center rounded border border-border bg-secondary px-4 py-2 font-mono text-sm text-primary transition hover:text-accent">
        Create link log
      </button>
      <p id="link-log-status" class="text-sm text-secondary"></p>
    </form>
  </section>

  <script>
    const form = document.getElementById('link-log-form');
    const statusEl = document.getElementById('link-log-status');
    const urlInput = document.getElementById('url');
    const titleInput = document.getElementById('title');
    const contentInput = document.getElementById('content');

    const params = new URLSearchParams(window.location.search);
    const tagChips = document.getElementById('tag-chips');
    const tagSuggestionsList = document.getElementById('tag-suggestions-list');
    const tagInput = document.getElementById('tags');
    const allTags = [${tagOptions}];
    if (params.get('url')) {
      urlInput.value = params.get('url');
    }
    if (params.get('title')) {
      titleInput.value = params.get('title');
    }
    if (params.get('selection')) {
      const selection = params.get('selection');
      const quoted = selection.split(/\\r?\\n/).map(line => '> ' + line).join('\\n');
      contentInput.value = quoted + '\\n\\n';
    }

    function parseTags(value) {
      return value.split(',').map(tag => tag.trim()).filter(Boolean);
    }

    function renderTagChips(tags) {
      tagChips.innerHTML = tags.map(tag => (
        '<span class="tag-pill bg-secondary flex items-center gap-1">' +
          '<span>' + tag + '</span>' +
          '<button type="button" data-tag="' + tag + '" class="text-secondary hover:text-accent">×</button>' +
        '</span>'
      )).join('');
      tagChips.querySelectorAll('button[data-tag]').forEach((button) => {
        button.addEventListener('click', () => {
          const nextTags = parseTags(tagInput.value).filter(item => item !== button.dataset.tag);
          tagInput.value = nextTags.join(', ');
          renderTagChips(nextTags);
          renderTagSuggestions(tagInput.value);
        });
      });
    }

    function renderTagSuggestions(inputValue) {
      const currentTags = parseTags(inputValue);
      const fragment = inputValue.split(',');
      const currentQuery = (fragment[fragment.length - 1] || '').trim().toLowerCase();

      if (!currentQuery) {
        tagSuggestionsList.classList.add('hidden');
        tagSuggestionsList.innerHTML = '';
        return;
      }

      const matches = allTags
        .filter(tag => tag.toLowerCase().includes(currentQuery))
        .filter(tag => !currentTags.includes(tag))
        .slice(0, 6);

      if (!matches.length) {
        tagSuggestionsList.classList.add('hidden');
        tagSuggestionsList.innerHTML = '';
        return;
      }

      tagSuggestionsList.innerHTML = matches.map(tag => (
        '<button type="button" class="block w-full px-3 py-2 text-left text-sm text-primary hover:bg-secondary" data-tag="' + tag + '">' +
          tag +
        '</button>'
      )).join('');
      tagSuggestionsList.classList.remove('hidden');
      tagSuggestionsList.querySelectorAll('button[data-tag]').forEach((button) => {
        button.addEventListener('click', () => {
          const nextTags = [...currentTags, button.dataset.tag];
          tagInput.value = nextTags.join(', ') + ', ';
          renderTagChips(nextTags);
          renderTagSuggestions(tagInput.value);
          tagInput.focus();
        });
      });
    }

    async function hydrateTitleFromUrl() {
      if (!urlInput.value || titleInput.value) {
        return;
      }
      statusEl.textContent = 'Fetching title...';
      try {
        const response = await fetch('/api/link-log/metadata?url=' + encodeURIComponent(urlInput.value));
        const data = await response.json();
        if (data && data.title) {
          titleInput.value = data.title;
          statusEl.textContent = '';
        } else {
          statusEl.textContent = 'Could not find a title.';
        }
      } catch (error) {
        statusEl.textContent = 'Could not fetch title.';
      }
    }

    urlInput.addEventListener('blur', hydrateTitleFromUrl);
    tagInput.addEventListener('input', () => {
      renderTagChips(parseTags(tagInput.value));
      renderTagSuggestions(tagInput.value);
    });
    tagInput.addEventListener('focus', () => {
      renderTagSuggestions(tagInput.value);
    });
    document.addEventListener('click', (event) => {
      if (!tagSuggestionsList.contains(event.target) && event.target !== tagInput) {
        tagSuggestionsList.classList.add('hidden');
      }
    });
    renderTagChips(parseTags(tagInput.value));

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      statusEl.textContent = 'Creating post...';
      const payload = {
        url: urlInput.value.trim(),
        title: titleInput.value.trim(),
        description: document.getElementById('description').value.trim(),
        tags: document.getElementById('tags').value,
        content: contentInput.value,
      };

      try {
        const response = await fetch('/api/link-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) {
          statusEl.textContent = data.error || 'Failed to create post.';
          return;
        }
        const postUrl = '/posts/' + data.slug;
        statusEl.innerHTML = 'Created! <a class="link-accent" href="' + postUrl + '">View post</a>';
      } catch (error) {
        statusEl.textContent = 'Failed to create post.';
      }
    });
  </script>
  `;
}

function buildBookmarklet(origin: string): string {
  const script = `(function(){var url=encodeURIComponent(location.href);var title=encodeURIComponent(document.title);var selection=encodeURIComponent(window.getSelection?window.getSelection().toString():'');var target='${origin}/link-log?url='+url+'&title='+title+'&selection='+selection;window.location.href=target;})();`;
  return `javascript:${script}`;
}
