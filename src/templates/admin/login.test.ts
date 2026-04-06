import { describe, expect, it } from "bun:test";
import { loginTemplate } from "./login.ts";

describe("loginTemplate", () => {
  it("preserves the return path in the login form", () => {
    const html = loginTemplate({ returnTo: "/posts/draft-post?tag=ai" });

    expect(html).toContain('type="hidden" name="returnTo" value="/posts/draft-post?tag=ai"');
  });
});
