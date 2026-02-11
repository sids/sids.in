---
title: "Showboat and Rodney — Agents Demoing Their Work"
slug: "showboat-and-rodney"
date: "2026-02-11"
description: ""
tags: ["AI Coding", "Agentic Engineering"]
link: "https://simonwillison.net/2026/Feb/10/showboat-and-rodney/"
draft: true
---

[Simon Willison](https://simonwillison.net/):

> A key challenge working with coding agents is having them both test what they've built and demonstrate that software to you, their overseer. This goes beyond automated tests—we need artifacts that show their progress and help us see exactly what the agent-produced software is able to do.

[Showboat](https://github.com/simonw/showboat):

> It's a CLI tool (a Go binary, optionally wrapped in Python to make it easier to install) that helps an agent construct a Markdown document demonstrating exactly what their newly developed code can do.

This might be a very useful artefact to include in PRs (assuming they are supposed to be reviewed by humans of course!)

[Rodney](https://github.com/simonw/rodney):

> Rodney is a CLI tool for browser automation designed to work with Showboat. It can navigate to URLs, take screenshots, click on elements and fill in forms.

Rodney is quite interesting too. There are a few such CLIs/skills for agents to control browsers for testing out there: [Vercel's agent-browser](https://github.com/vercel-labs/agent-browser) seems very popular, but there are a few others as well on [skills.sh](https://skills.sh).

I'm currently using [web-browser skill from mitsuhiko](https://github.com/mitsuhiko/agent-stuff/tree/main/skills/web-browser) on GitHub, which has a set of typescript scripts that control a Chrome browser using CDP (similar to Rodney); it has no npm dependencies save for one websockets lib. This works well, but I'm going give Rodney a try because, being able to run using `uvx` means that it should work well in environments like Codex for web (which has `uv` and Chrome) without additional setup.
