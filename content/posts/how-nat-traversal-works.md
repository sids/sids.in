---
title: "🔗 How NAT Traversal Works"
slug: "how-nat-traversal-works"
date: "2025-03-30"
description: ""
tags: ["link-log"]
draft: false
---

[How NAT traversal works](https://tailscale.com/blog/how-nat-traversal-works)

A [Stratechery interview with the CEO of Tailscale](https://stratechery.com/2025/an-interview-with-tailscale-co-founder-and-ceo-avery-pennarun/) dropped a few weeks ago. Tailscale is one of my favourite kinds of companies — focused on a single product that’s deeply technical and yet simple and delightful to use. I’m a longtime user and love the product. The interview is fun to listen to.

It reminded me of this old article that Tailscale published: [How NAT traversal works](https://tailscale.com/blog/how-nat-traversal-works). It’s an in-depth treatise on a topic that most of us never think about, but a critical problem to solve for those designing peer-to-peer networking software.

It’s a very long read, but a captivating one nevertheless. There are all kinds of interesting technical details, and some aha moments like how the ideas of [The Birthday Paradox](https://en.m.wikipedia.org/wiki/Birthday_problem "Birthday problem | Wikipedia") are used to devise an algorithm for NAT-busting (in a section delightfully titled “NAT notes for nerds”).
