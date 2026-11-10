import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3100";
const browser = await chromium.launch();
try {
  // Exercise the deployed action through HTTP. Each transport style supplies
  // attacker-controlled headers; neither can reset the account limit.
  for (const [route, username, password] of [
    ["direct Tailscale headers", "danny", "local-test-password-123"],
    ["proxy forwarding chain", "viewer", "viewer-test-pass-99"],
  ]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    for (let i = 0; i < 6; i++) {
      await context.setExtraHTTPHeaders({
        "x-forwarded-for": route.startsWith("proxy")
          ? `198.51.100.${i}, 192.0.2.10`
          : `198.51.100.${i}`,
        "x-real-ip": `203.0.113.${i}`,
      });
      await page.goto(`${BASE}/login`);
      await page.fill("#username", username);
      await page.fill("#password", i === 5 ? password : "incorrect-synthetic-password");
      await page.click("button[type=submit]");
      const expected =
        i === 5 ? "Too many attempts. Try again in 15 minutes." : "Invalid username or password.";
      await page.locator("form p[role=alert]").filter({ hasText: expected }).waitFor();
      assert.equal(await page.locator("form p[role=alert]").textContent(), expected);
      assert.equal(new URL(page.url()).pathname, "/login");
    }
    console.log(`PASS: account limit survives changing ${route}`);
    await context.close();
  }
  const context = await browser.newContext();
  let limited = 0;
  for (let i = 0; i < 121; i++) {
    const response = await context.request.post(`${BASE}/`, {
      headers: { "next-action": "synthetic-invalid-action", "x-forwarded-for": `198.51.100.${i}` },
      data: "",
      maxRedirects: 0,
    });
    if (response.status() === 429) {
      limited++;
      assert.equal(response.headers()["retry-after"], "60");
    }
  }
  assert.ok(limited > 0, "alternate Server Action paths must reach the request gate");
  console.log("PASS: alternate Server Action path reaches request limit");
  await context.close();
} finally {
  await browser.close();
}
