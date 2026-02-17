import type { TagInfo } from "../../types.ts";
import { escapeHtml } from "../../markdown.ts";

export function noteTemplate(tags: TagInfo[]): string {
  const tagOptions = tags
    .map((tag) => `"${escapeHtml(tag.tag)}"`)
    .join(", ");

  return `
  <section class="flex flex-col gap-8">
    <header class="flex flex-col gap-3">
      <a href="/admin" class="font-mono text-xs uppercase text-secondary link-accent">Admin home</a>
      <p class="font-mono text-sm text-secondary">Note</p>
      <h1 class="text-3xl font-mono text-primary">New note entry</h1>
    </header>

    <form id="note-form" class="flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <label for="title" class="font-mono text-xs uppercase text-secondary">Title</label>
        <input id="title" name="title" type="text" required class="w-full rounded border border-border bg-primary px-3 py-2 text-primary" placeholder="Short note title">
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
        <label for="note-content" class="font-mono text-xs uppercase text-secondary">Content</label>
        <textarea id="note-content" name="content" rows="10" class="w-full rounded border border-border bg-primary px-3 py-2 text-primary" placeholder="Write the note content here."></textarea>
      </div>

      <div id="note-status" class="alert hidden" role="status" aria-live="polite"></div>
      <button type="submit" class="inline-flex items-center justify-center rounded border border-border bg-secondary px-4 py-2 font-mono text-sm text-primary transition hover:text-accent">
        Create note
      </button>
    </form>
  </section>

  <script>
    const form = document.getElementById('note-form');
    const statusEl = document.getElementById('note-status');
    const titleInput = document.getElementById('title');
    const contentInput = document.getElementById('note-content');

    const tagChips = document.getElementById('tag-chips');
    const tagSuggestionsList = document.getElementById('tag-suggestions-list');
    const tagInput = document.getElementById('tags');
    const allTags = [${tagOptions}];

    function parseTags(value) {
      return value.split(',').map(tag => tag.trim()).filter(Boolean);
    }

    function setStatus(type, message, isHtml) {
      statusEl.classList.remove('hidden', 'alert-info', 'alert-success', 'alert-error');
      statusEl.classList.add(type);
      if (isHtml) {
        statusEl.innerHTML = message;
      } else {
        statusEl.textContent = message;
      }
    }

    function clearStatus() {
      statusEl.classList.add('hidden');
      statusEl.textContent = '';
      statusEl.classList.remove('alert-info', 'alert-success', 'alert-error');
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
      setStatus('alert-info', 'Creating post...');
      const submitButton = form.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = true;
      }
      const payload = {
        title: titleInput.value.trim(),
        description: document.getElementById('description').value.trim(),
        tags: document.getElementById('tags').value,
        content: contentInput.value,
      };

      try {
        const response = await fetch('/admin/api/note', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) {
          setStatus('alert-error', data.error || 'Failed to create post.');
          if (submitButton) {
            submitButton.disabled = false;
          }
          return;
        }
        const postUrl = '/posts/' + data.slug;
        setStatus('alert-success', 'Created! <a class="link-accent" href="' + postUrl + '">View post</a>', true);
        form.reset();
        tagInput.value = '';
        renderTagChips([]);
        tagSuggestionsList.classList.add('hidden');
        tagSuggestionsList.innerHTML = '';
        if (submitButton) {
          submitButton.disabled = false;
        }
      } catch (error) {
        setStatus('alert-error', 'Failed to create post.');
        if (submitButton) {
          submitButton.disabled = false;
        }
      }
    });
  </script>
  `;
}
