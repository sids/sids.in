import { describe, expect, it } from "bun:test";
import { newsletterSection, postSubscribePrompt } from "./subscribe.ts";

describe("newsletter subscribe forms", () => {
  it("renders a native subscribe form instead of the Substack iframe", () => {
    const html = newsletterSection();

    expect(html).toContain('action="/newsletter/subscribe"');
    expect(html).toContain('method="post"');
    expect(html).toContain('hx-boost="false"');
    expect(html).toContain('name="email"');
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("siddhartha.substack.com/embed");
  });

  it("uses the native subscribe form in post prompts", () => {
    const html = postSubscribePrompt();

    expect(html).toContain('type="email"');
    expect(html).not.toContain("<iframe");
  });
});
