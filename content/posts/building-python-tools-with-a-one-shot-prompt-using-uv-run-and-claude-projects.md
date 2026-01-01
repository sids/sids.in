---
title: "Building Python tools with a one-shot prompt using uv run and Claude Projects"
slug: "building-python-tools-with-a-one-shot-prompt-using-uv-run-and-claude-projects"
date: "2025-04-06"
description: ""
tags: ["ai", "AI Coding", "llm"]
link: "https://simonwillison.net/2024/Dec/19/one-shot-python-tools/"
draft: false
---

Nice and clever use of [uv](https://github.com/astral-sh/uv)’s `run` inline dependency management and [Claude Project](https://support.anthropic.com/en/articles/9517075-what-are-projects "Anthropic Claude | What are Projects?") [Custom Instructions](https://support.anthropic.com/en/articles/9519177-how-can-i-create-and-manage-projects "Anthropic Claude | How can I create and manage Projects?") to create Python scripts that are easy to run without any setup, even while depending on Python’s rich set of libraries.

I’ve used this workflow for a few scripts in the last couple of weeks, and it works remarkably well.

You can then go a step further — [add uv into the shebang line for a Python script to make it a self-contained executable](http://blog.dusktreader.dev/2025/03/29/self-contained-python-scripts-with-uv/ "Self-contained Python scripts with uv").
