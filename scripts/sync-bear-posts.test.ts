import { describe, expect, it } from "vitest";
import { commitAndPushFiles, planActions, publishPendingGitFiles, readBearNotes } from "./sync-bear-posts.ts";
import type { PendingGitPathsStore } from "./sync-bear-posts.ts";

type LocalPost = Parameters<typeof planActions>[0][number];
type BearNote = Parameters<typeof planActions>[1][number];
type SyncState = Parameters<typeof planActions>[2];

const frontmatter = {
  title: "Test post",
  slug: "test-post",
  date: "2026-06-07",
  tags: [],
  draft: false,
};

const localContent = `---
title: "Test post"
slug: "test-post"
date: "2026-06-07"
tags: []
draft: false
---

Body
`;

const bearContent = `---
title: "Test post"
slug: "test-post"
date: "2026-06-07"
tags: []
draft: false
---

# Test post

Body
`;

function makePost(overrides: Partial<LocalPost> = {}): LocalPost {
  return {
    path: "content/posts/2026/06-07-test-post.md",
    content: localContent,
    hash: "local-hash",
    frontmatter,
    ...overrides,
  };
}

function makeNote(overrides: Partial<BearNote> = {}): BearNote {
  return {
    id: "bear-id",
    title: "Test post",
    tags: ["sids.in"],
    hash: "bear-cli-hash",
    content: bearContent,
    normalizedContent: localContent,
    normalizedHash: "bear-hash",
    frontmatter,
    ...overrides,
  };
}

function makeState(overrides: Partial<SyncState[string]> = {}): SyncState {
  return {
    "content/posts/2026/06-07-test-post.md": {
      bearId: "bear-id",
      lastFileHash: "local-hash",
      lastBearHash: "bear-hash",
      ...overrides,
    },
  };
}

describe("Bear CLI reads", () => {
  it("searches for the managed tag and does not reread tracked search results", async () => {
    const calls: string[][] = [];
    const bearCli = (args: string[]): string => {
      calls.push(args);
      if (args[0] === "search") {
        return JSON.stringify([
          { id: "bear-id", title: "Test post", tags: ["#sids.in/ai"] },
        ]);
      }
      if (args[0] === "cat") {
        return JSON.stringify({ content: bearContent, hash: "bear-cli-hash" });
      }
      throw new Error(`Unexpected bearcli command: ${args.join(" ")}`);
    };

    const notes = await readBearNotes(bearCli, async () => makeState());

    expect(calls).toEqual([
      [
        "search",
        "#sids.in#",
        "--format",
        "json",
        "--fields",
        "id,title,tags",
      ],
      ["cat", "bear-id", "--format", "json"],
    ]);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      id: "bear-id",
      title: "Test post",
      tags: ["#sids.in/ai"],
      content: bearContent,
      hash: "bear-cli-hash",
    });
  });

  it("reads tracked notes missing from the managed-tag search", async () => {
    const calls: string[][] = [];
    const bearCli = (args: string[]): string => {
      calls.push(args);
      if (args[0] === "search") return "[]";
      if (args[0] === "show") {
        return JSON.stringify({ id: "bear-id", title: "Test post", tags: [] });
      }
      if (args[0] === "cat") {
        return JSON.stringify({ content: bearContent, hash: "bear-cli-hash" });
      }
      throw new Error(`Unexpected bearcli command: ${args.join(" ")}`);
    };

    const notes = await readBearNotes(bearCli, async () => makeState());

    expect(notes).toHaveLength(1);
    expect(calls.map(([command]) => command)).toEqual(["search", "show", "cat"]);
  });

  it("repairs an empty frontmatter template so a Bear link note can be imported", async () => {
    const emptyTemplate = `---
title: ""
slug: ""
date: ""
description: ""
tags: []
link: "https://example.com/post"
draft: true
---
# Link post title

Commentary
`;
    const bearCli = (args: string[]): string => {
      if (args[0] === "search") {
        return JSON.stringify([
          { id: "link-note", title: "Link post title", tags: ["#sids.in/ai"] },
        ]);
      }
      if (args[0] === "cat") {
        return JSON.stringify({ content: emptyTemplate, hash: "link-note-hash" });
      }
      throw new Error(`Unexpected bearcli command: ${args.join(" ")}`);
    };
    const today = new Date().toISOString().slice(0, 10);

    const notes = await readBearNotes(bearCli, async () => ({}));

    expect(notes[0]?.frontmatter).toMatchObject({
      title: "Link post title",
      slug: "link-post-title",
      date: today,
      link: "https://example.com/post",
      draft: true,
    });
    expect(notes[0]?.normalizedContent).toContain(`date: "${today}"`);
    expect(planActions([], notes, {})).toMatchObject([
      {
        type: "create-file",
        path: `content/posts/${today.slice(0, 4)}/${today.slice(5, 7)}-${today.slice(8, 10)}-link-post-title.md`,
        note: {
          normalizedContent: expect.stringContaining('tags: ["ai"]'),
          frontmatter: { tags: ["ai"] },
        },
      },
    ]);
  });
});

describe("Bear managed tags", () => {
  it("does not add the bare root when a nested tag exists", () => {
    const actions = planActions(
      [makePost({ frontmatter: { ...frontmatter, tags: ["ai"] } })],
      [makeNote({ tags: ["sids.in/ai"] })],
      makeState()
    );

    expect(actions).toEqual([]);
  });

  it("ignores Bear's implied parent tag when a nested tag exists", () => {
    const actions = planActions(
      [makePost({ frontmatter: { ...frontmatter, tags: ["ai"] } })],
      [makeNote({ tags: ["sids.in", "sids.in/ai"] })],
      makeState()
    );

    expect(actions).toEqual([]);
  });
});

describe("Bear-to-file updates", () => {
  it("does not write a normal Bear edit back to Bear", () => {
    const changedLocalContent = localContent.replace("Body", "Changed body");
    const changedBearContent = bearContent.replace("Body", "Changed body");
    const note = makeNote({
      content: changedBearContent,
      normalizedContent: changedLocalContent,
      normalizedHash: "changed-bear-hash",
    });

    expect(planActions([makePost()], [note], makeState())).toEqual([
      { type: "update-file", post: makePost(), note, repairBear: false },
    ]);
  });

  it("writes repaired Bear metadata back after pulling content", () => {
    const note = makeNote({
      content: bearContent.replace('slug: "test-post"', 'slug: ""'),
      normalizedHash: "changed-bear-hash",
    });

    expect(planActions([makePost()], [note], makeState())).toEqual([
      { type: "update-file", post: makePost(), note, repairBear: true },
    ]);
  });
});

describe("Bear body safeguards", () => {
  it("does not overwrite a divergent Bear body by default", () => {
    const post = makePost({ content: localContent.replace("Body", "Changed body"), hash: "changed-local-hash" });

    expect(planActions([post], [makeNote()], makeState())).toEqual([
      {
        type: "skip",
        reason: `Local body differs from Bear for ${post.path}; re-run with --overwrite-bear-content to replace Bear content`,
      },
    ]);
  });

  it("allows an explicit Bear body overwrite", () => {
    const post = makePost({ content: localContent.replace("Body", "Changed body"), hash: "changed-local-hash" });
    const note = makeNote();

    expect(planActions([post], [note], makeState(), true)).toEqual([
      {
        type: "update-bear",
        post,
        note,
        entry: makeState()[post.path],
      },
    ]);
  });
});

describe("Bear WIP imports", () => {
  it("does not create a local file for a new #sids.in/~wip note", () => {
    const actions = planActions(
      [],
      [makeNote({ tags: ["sids.in", "sids.in/~wip"], frontmatter: { ...frontmatter, date: "invalid" } })],
      {}
    );

    expect(actions).toEqual([
      {
        type: "skip",
        reason: "Bear note bear-id (Test post) is tagged as WIP",
      },
    ]);
  });

  it("does not update a local file from an existing #sids.in/~wip note", () => {
    const actions = planActions(
      [makePost()],
      [makeNote({ tags: ["sids.in", "sids.in/~wip"], normalizedHash: "changed-bear-hash" })],
      makeState({ lastBearHash: "old-bear-hash" })
    );

    expect(actions).toEqual([
      {
        type: "skip",
        reason: "Bear note bear-id (Test post) is tagged as WIP",
      },
    ]);
  });

  it("does not treat the WIP marker as a stale managed tag", () => {
    const actions = planActions(
      [makePost()],
      [makeNote({ tags: ["sids.in", "sids.in/~wip"] })],
      makeState()
    );

    expect(actions).toEqual([]);
  });

  it("still updates a WIP Bear note from a changed local file", () => {
    const post = makePost({ hash: "changed-local-hash" });
    const note = makeNote({ tags: ["sids.in", "sids.in/~wip"] });
    const actions = planActions([post], [note], makeState({ lastFileHash: "old-local-hash" }));

    expect(actions).toEqual([
      {
        type: "update-bear",
        post,
        note,
        entry: makeState({ lastFileHash: "old-local-hash" })[post.path],
      },
    ]);
  });
});

function makePendingGitPathsStore() {
  let pendingPaths: string[] = [];
  const store: PendingGitPathsStore = {
    async load() {
      return pendingPaths;
    },
    async save(paths) {
      pendingPaths = paths;
    },
  };
  return { store, pendingPaths: () => pendingPaths };
}

function gitUpstreamOutput(args: string[]): string | undefined {
  if (args[0] === "branch") return "bear-sync";
  if (args[0] === "config" && args[2]?.endsWith(".remote")) return "origin";
  if (args[0] === "config" && args[2]?.endsWith(".merge")) return "refs/heads/main";
  return undefined;
}

describe("Git publication", () => {
  it("does not inspect or push Git when there are no pending Bear files", () => {
    const git = (): string => {
      throw new Error("Git should not be called");
    };

    expect(commitAndPushFiles([], git)).toEqual({});
  });

  it("commits only Bear-produced files and pushes HEAD to the tracked upstream branch", () => {
    const calls: string[][] = [];
    const git = (args: string[]): string => {
      calls.push(args);
      const upstreamOutput = gitUpstreamOutput(args);
      if (upstreamOutput !== undefined) return upstreamOutput;
      if (args[0] === "status") return " M content/posts/from-bear.md";
      if (args[0] === "commit") return "committed";
      if (args[0] === "rev-list") return "1";
      if (args[0] === "push") return "pushed";
      return "";
    };

    const result = commitAndPushFiles(["content/posts/from-bear.md"], git);

    expect(result).toEqual({ commitOutput: "committed", pushOutput: "pushed" });
    expect(calls).toContainEqual(["add", "--", "content/posts/from-bear.md"]);
    expect(calls).toContainEqual(["push", "origin", "HEAD:main"]);
    expect(calls).toContainEqual([
      "commit",
      "--only",
      "-m",
      "chore: sync posts from Bear",
      "--",
      "content/posts/from-bear.md",
    ]);
    expect(calls.flat()).not.toContain("content/posts/unrelated.md");
  });

  it("retains Bear-produced paths and retries a failed commit", async () => {
    const pending = makePendingGitPathsStore();
    let commitAttempts = 0;
    const git = (args: string[]): string => {
      const upstreamOutput = gitUpstreamOutput(args);
      if (upstreamOutput !== undefined) return upstreamOutput;
      if (args[0] === "status") return "M  content/posts/from-bear.md";
      if (args[0] === "commit") {
        commitAttempts += 1;
        if (commitAttempts === 1) throw new Error("commit failed");
        return "committed";
      }
      if (args[0] === "rev-list") return "1";
      if (args[0] === "push") return "pushed";
      return "";
    };

    await expect(
      publishPendingGitFiles(["content/posts/from-bear.md"], pending.store, git)
    ).rejects.toThrow("commit failed");
    expect(pending.pendingPaths()).toEqual(["content/posts/from-bear.md"]);

    await expect(publishPendingGitFiles([], pending.store, git)).resolves.toEqual({
      commitOutput: "committed",
      pushOutput: "pushed",
    });
    expect(pending.pendingPaths()).toEqual([]);
    expect(commitAttempts).toBe(2);
  });

  it("retains Bear-produced paths and retries a failed push", async () => {
    const pending = makePendingGitPathsStore();
    let statusChecks = 0;
    let pushAttempts = 0;
    let commits = 0;
    const git = (args: string[]): string => {
      const upstreamOutput = gitUpstreamOutput(args);
      if (upstreamOutput !== undefined) return upstreamOutput;
      if (args[0] === "status") {
        statusChecks += 1;
        return statusChecks === 1 ? "M  content/posts/from-bear.md" : "";
      }
      if (args[0] === "commit") {
        commits += 1;
        return "committed";
      }
      if (args[0] === "rev-list") return "1";
      if (args[0] === "push") {
        pushAttempts += 1;
        if (pushAttempts === 1) throw new Error("push failed");
        return "pushed";
      }
      return "";
    };

    await expect(
      publishPendingGitFiles(["content/posts/from-bear.md"], pending.store, git)
    ).rejects.toThrow("push failed");
    expect(pending.pendingPaths()).toEqual(["content/posts/from-bear.md"]);

    await expect(publishPendingGitFiles([], pending.store, git)).resolves.toEqual({
      commitOutput: undefined,
      pushOutput: "pushed",
    });
    expect(pending.pendingPaths()).toEqual([]);
    expect(commits).toBe(1);
    expect(pushAttempts).toBe(2);
  });
});
