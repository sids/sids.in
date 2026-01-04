import { allTags } from "../manifest.ts";

export function linkSubmitTemplate(): string {
  const tagsJson = JSON.stringify(allTags.map((t) => t.tag));

  // Bookmarklet code - minified
  const bookmarklet = `javascript:(function(){var u=encodeURIComponent(location.href);var t=encodeURIComponent(document.title);var s=encodeURIComponent(getSelection().toString());window.open('https://sids.in/link-submit?url='+u+'&title='+t+'&text='+s,'_blank')})();`;

  return `
<div class="max-w-2xl mx-auto">
  <h1 class="text-2xl font-bold mb-6">New Link Log</h1>

  <details class="mb-6 p-4 border border-border rounded-lg">
    <summary class="cursor-pointer text-sm font-medium">Bookmarklet Installation</summary>
    <div class="mt-4 space-y-4">
      <p class="text-sm text-secondary">Drag this link to your bookmarks bar, or copy the code below:</p>
      <p class="text-center">
        <a href="${bookmarklet}" class="inline-block px-4 py-2 bg-accent text-white rounded font-medium no-underline hover:opacity-90" onclick="event.preventDefault();alert('Drag this to your bookmarks bar!')">+ Link Log</a>
      </p>
      <div class="text-xs">
        <p class="font-medium mb-1">iOS Safari:</p>
        <ol class="list-decimal list-inside text-secondary space-y-1">
          <li>Bookmark any page</li>
          <li>Edit the bookmark and replace the URL with the code below</li>
          <li>Select text on any page, tap the bookmarklet to post</li>
        </ol>
      </div>
      <div class="mt-2">
        <label class="text-xs font-medium">Bookmarklet code:</label>
        <textarea readonly class="w-full mt-1 px-2 py-1 text-xs font-mono bg-secondary border border-border rounded" rows="3" onclick="this.select()">${bookmarklet}</textarea>
      </div>
    </div>
  </details>

  <div id="auth-section" class="mb-6 p-4 border border-border rounded-lg bg-secondary">
    <label class="block text-sm font-medium mb-2">GitHub Token</label>
    <div class="flex gap-2">
      <input type="password" id="github-token" placeholder="ghp_..." class="flex-1 px-3 py-2 border border-border rounded bg-primary text-primary font-mono text-sm" />
      <button onclick="saveToken()" class="px-4 py-2 bg-accent text-white rounded hover:opacity-90">Save</button>
    </div>
    <p class="text-xs text-secondary mt-2">Token is stored locally. Needs <code>repo</code> scope. <a href="https://github.com/settings/tokens/new?scopes=repo&description=sids.in%20link%20bookmarklet" target="_blank" class="text-accent underline">Create token</a></p>
  </div>

  <form id="link-form" class="space-y-4">
    <div>
      <label class="block text-sm font-medium mb-1">URL *</label>
      <input type="url" id="link-url" required class="w-full px-3 py-2 border border-border rounded bg-primary text-primary" />
    </div>

    <div>
      <label class="block text-sm font-medium mb-1">Title *</label>
      <input type="text" id="link-title" required class="w-full px-3 py-2 border border-border rounded bg-primary text-primary" />
    </div>

    <div>
      <label class="block text-sm font-medium mb-1">Content</label>
      <textarea id="link-content" rows="8" class="w-full px-3 py-2 border border-border rounded bg-primary text-primary font-mono text-sm" placeholder="Your commentary..."></textarea>
      <p class="text-xs text-secondary mt-1">Markdown supported. Selected text from bookmarklet will appear as a blockquote.</p>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1">Tags</label>
      <div id="tags-container" class="flex flex-wrap gap-2 mb-2"></div>
      <div class="relative">
        <input type="text" id="tag-input" autocomplete="off" placeholder="Add tags..." class="w-full px-3 py-2 border border-border rounded bg-primary text-primary" />
        <div id="tag-suggestions" class="absolute z-10 w-full mt-1 bg-primary border border-border rounded shadow-lg hidden max-h-48 overflow-y-auto"></div>
      </div>
    </div>

    <div class="flex gap-4 pt-4">
      <button type="submit" id="submit-btn" class="px-6 py-2 bg-accent text-white rounded hover:opacity-90 disabled:opacity-50">
        Create Post
      </button>
      <button type="button" onclick="previewPost()" class="px-6 py-2 border border-border rounded hover:bg-secondary">
        Preview
      </button>
    </div>
  </form>

  <div id="preview-section" class="hidden mt-6 p-4 border border-border rounded-lg">
    <h3 class="text-sm font-medium mb-2 text-secondary">Preview (Frontmatter + Content)</h3>
    <pre id="preview-content" class="text-sm bg-secondary p-4 rounded overflow-x-auto font-mono whitespace-pre-wrap"></pre>
  </div>

  <div id="result-section" class="hidden mt-6 p-4 border border-border rounded-lg">
    <p id="result-message" class="text-sm"></p>
  </div>
</div>

<script>
(function() {
  const REPO_OWNER = 'sids';
  const REPO_NAME = 'sids.in';
  const BRANCH = 'main';
  const ALL_TAGS = ${tagsJson};

  let selectedTags = [];

  // Initialize on load
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    loadToken();
    parseUrlParams();
    setupTagInput();
    setupForm();
  }

  function loadToken() {
    const token = localStorage.getItem('github_token');
    if (token) {
      document.getElementById('github-token').value = token;
      document.getElementById('auth-section').classList.add('border-green-500');
    }
  }

  window.saveToken = function() {
    const token = document.getElementById('github-token').value.trim();
    if (token) {
      localStorage.setItem('github_token', token);
      document.getElementById('auth-section').classList.add('border-green-500');
      alert('Token saved!');
    }
  };

  function parseUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const url = params.get('url');
    const title = params.get('title');
    const text = params.get('text');

    if (url) {
      document.getElementById('link-url').value = url;
    }
    if (title) {
      document.getElementById('link-title').value = title;
    }
    if (text) {
      // Format selected text as blockquote
      const blockquote = text.split('\\n').map(line => '> ' + line).join('\\n');
      document.getElementById('link-content').value = blockquote + '\\n\\n';
    }
  }

  function setupTagInput() {
    const input = document.getElementById('tag-input');
    const suggestions = document.getElementById('tag-suggestions');

    input.addEventListener('input', () => {
      const value = input.value.toLowerCase().trim();
      if (!value) {
        suggestions.classList.add('hidden');
        return;
      }

      const matches = ALL_TAGS.filter(tag =>
        tag.toLowerCase().includes(value) && !selectedTags.includes(tag)
      );

      if (matches.length === 0) {
        // Show option to create new tag
        suggestions.innerHTML = '<div class="px-3 py-2 cursor-pointer hover:bg-secondary" data-tag="' + escapeHtml(input.value.trim()) + '">Create: "' + escapeHtml(input.value.trim()) + '"</div>';
      } else {
        suggestions.innerHTML = matches.slice(0, 10).map(tag =>
          '<div class="px-3 py-2 cursor-pointer hover:bg-secondary" data-tag="' + escapeHtml(tag) + '">' + escapeHtml(tag) + '</div>'
        ).join('');
      }
      suggestions.classList.remove('hidden');
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const value = input.value.trim();
        if (value && !selectedTags.includes(value)) {
          addTag(value);
        }
        input.value = '';
        suggestions.classList.add('hidden');
      }
    });

    suggestions.addEventListener('click', (e) => {
      const tag = e.target.dataset.tag;
      if (tag) {
        addTag(tag);
        input.value = '';
        suggestions.classList.add('hidden');
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#tag-input') && !e.target.closest('#tag-suggestions')) {
        suggestions.classList.add('hidden');
      }
    });
  }

  function addTag(tag) {
    if (selectedTags.includes(tag)) return;
    selectedTags.push(tag);
    renderTags();
  }

  function removeTag(tag) {
    selectedTags = selectedTags.filter(t => t !== tag);
    renderTags();
  }

  function renderTags() {
    const container = document.getElementById('tags-container');
    container.innerHTML = selectedTags.map(tag =>
      '<span class="inline-flex items-center gap-1 px-2 py-1 bg-secondary rounded text-sm">' +
        escapeHtml(tag) +
        '<button type="button" onclick="window.removeTagHandler(\\'' + escapeHtml(tag) + '\\')" class="text-secondary hover:text-primary">&times;</button>' +
      '</span>'
    ).join('');
  }

  window.removeTagHandler = function(tag) {
    removeTag(tag);
  };

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function generateSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\\s-]/g, '')
      .replace(/\\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
  }

  function generatePost() {
    const url = document.getElementById('link-url').value.trim();
    const title = document.getElementById('link-title').value.trim();
    const content = document.getElementById('link-content').value;

    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const slug = generateSlug(title);

    const frontmatter = [
      '---',
      'title: "' + title.replace(/"/g, '\\\\"') + '"',
      'slug: "' + slug + '"',
      'date: "' + date + '"',
      'description: ""',
      'tags: ' + JSON.stringify(selectedTags),
      'link: "' + url + '"',
      'draft: false',
      '---'
    ].join('\\n');

    return {
      frontmatter,
      content: content.trim(),
      fullContent: frontmatter + '\\n\\n' + content.trim() + '\\n',
      slug,
      date,
      year: now.getFullYear().toString()
    };
  }

  window.previewPost = function() {
    const post = generatePost();
    document.getElementById('preview-content').textContent = post.fullContent;
    document.getElementById('preview-section').classList.remove('hidden');
  };

  function setupForm() {
    document.getElementById('link-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await submitPost();
    });
  }

  async function submitPost() {
    const token = localStorage.getItem('github_token');
    if (!token) {
      showResult('Please save your GitHub token first.', true);
      return;
    }

    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
      const post = generatePost();
      const month = post.date.split('-')[1];
      const day = post.date.split('-')[2];
      const filename = month + '-' + day + '-' + post.slug + '.md';
      const filepath = 'content/posts/' + post.year + '/' + filename;

      // Check if year directory needs to be created (GitHub API creates it automatically)
      const response = await fetch('https://api.github.com/repos/' + REPO_OWNER + '/' + REPO_NAME + '/contents/' + filepath, {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
          message: 'Add link log: ' + post.slug,
          content: btoa(unescape(encodeURIComponent(post.fullContent))),
          branch: BRANCH
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create post');
      }

      const result = await response.json();
      showResult('Post created successfully! <a href="' + result.content.html_url + '" target="_blank" class="underline text-accent">View on GitHub</a>', false);

      // Clear form
      document.getElementById('link-form').reset();
      selectedTags = [];
      renderTags();
      document.getElementById('preview-section').classList.add('hidden');

    } catch (error) {
      showResult('Error: ' + error.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Post';
    }
  }

  function showResult(message, isError) {
    const section = document.getElementById('result-section');
    const msgEl = document.getElementById('result-message');
    section.classList.remove('hidden');
    msgEl.innerHTML = message;
    msgEl.className = 'text-sm ' + (isError ? 'text-red-500' : 'text-green-600');
  }
})();
</script>
`;
}

export function linkSubmitPage(): string {
  return linkSubmitTemplate();
}
