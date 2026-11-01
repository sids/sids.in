---
title: "Prompts for Better Code from Coding Agents"
slug: "prompts-for-better-code-from-coding-agents"
date: "2026-11-01T08:51:53+05:30"
description: ""
tags: ["ai-tip", "agentic-engineering"]
draft: true
---

There is a meme on X that frontier LLMs have gotten so good that how we prompt doesn’t matter. Absolute BS.

Here are a couple of _magical_ prompts that improve the quality of generated code. Try them in a non-trivial agentic coding session and you’ll see what I mean.

```
now that you have written the code, how would you do it better and SIMPLER?
```

Try this after the agent has written the code. Both Claude and GPT models usually come back with some nice ways in which the change could be better done; sometimes, if the change is obvious, they will just do it. They will also usually tell you what they believe should not change.

You can read through and pick what you want the agent to change. Even if you choose to not change anything, the possibilities give you an idea about the solution space and what assumptions & directions the agent took.

```
review your complete body of work, and try to simplify it. remove code that is now dead. simplify code that can now be simpler. reuse code that makes sense to be shared. find leftovers from previous attempts.
```

— [Lucas Meijer](https://x.com/lucasmeijer/status/2076066050148299234)

I typically send this after the previous prompt and the agents inevitably find something to clean up and/or simplify.
