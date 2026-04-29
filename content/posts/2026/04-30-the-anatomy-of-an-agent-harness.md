---
title: "The Anatomy of an Agent Harness"
slug: "the-anatomy-of-an-agent-harness"
date: "2026-04-29T19:22:34.460Z"
description: ""
tags: ["agentic-engineering", "ai"]
link: "https://x.com/aparnadhinak/status/2046980769747533830"
draft: false
---

Aparna Dhinakaran:

> Someone asked me at a hacker event last week: "Can anyone actually tell me what a harness really is?" It was said with real skepticism. The kind of skepticism that says we all use the word "Harness" in the industry, but nobody actually knows what it is.
>
> Fair question. Let me try.

This is a good post and does the important job of defining a term that is getting used increasingly in the context of AI agents.

Perhaps a good addendum would be to define an agent as something that wraps the harness into an app that users interact with. Claude Code is a harness and a coding agent merged into one. Codex cli is a coding agent that builds on the codex-app-server harness. Cursor is also a harness + coding agent, but they are also experimenting with Claude Code as a harness!

T3Code is a coding agent that demonstrates this difference best: it does not ship with its own harness and can instead use Codex, Claude Code, or OpenCode as harnesses.

One exception I take with the linked post is that not every component that it describes as making up a harness is actually necessary in every harness.

As an obvious example, you could very well build an agent without subagents (if you do want subagents, it would have to come in at the harness level as subagents are exposed as tools to the LLM).

So what are the absolute minimal components in a harness? I think it's just the agentic loop. That includes assembling the system prompt, tool definitions, executing the tool calls & assembling the results, etc.

Context management and compaction is not required (it could live outside the harness). Skills are not required. We already talked about subagents. Built-in prepackaged skills should probably not be there in any harness. Lifecycle hooks are nice to have. Session persistence & recovery is optional. So is a permission & safety layer.
