import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const authSurfaceFiles = [
  "src/lib/auth.ts",
  "src/lib/auth-client.ts",
  "src/components/account/account-panel.tsx",
  "src/app/page.tsx",
  "src/app/account/page.tsx",
  "docs/deployment.md",
  ".env.example",
];

describe("password auth surface", () => {
  it("uses password login and registration copy instead of magic links", () => {
    const source = authSurfaceFiles
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    assert.match(source, /账号密码/);
    assert.match(source, /注册/);
    assert.doesNotMatch(source, /magic link/i);
    assert.doesNotMatch(source, /登录链接/);
    assert.doesNotMatch(source, /RESEND_API_KEY/);
  });

  it("keeps the dedicated account page focused on the auth action", () => {
    const page = readFileSync("src/app/account/page.tsx", "utf8");
    const panel = readFileSync("src/components/account/account-panel.tsx", "utf8");
    const source = `${page}\n${panel}`;

    assert.match(source, /登录或注册/);
    assert.doesNotMatch(source, /跨设备继续/);
    assert.doesNotMatch(source, /训练记录/);
    assert.doesNotMatch(source, /当前状态/);
    assert.doesNotMatch(source, /回首页登录/);
  });
});
