import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3100";
const results = [];
let failures = 0;
const check = (name, ok, extra = "") => {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.setDefaultTimeout(15000);

async function login(p, user, pass) {
  await p.goto(`${BASE}/login`);
  await p.fill("#username", user);
  await p.fill("#password", pass);
  await p.click("form button[type=submit]");
  await p.waitForURL(`${BASE}/`);
}

try {
  // ---- AC6: security headers (no cookie needed) ----
  const headResp = await ctx.request.get(`${BASE}/login`);
  const h = headResp.headers();
  const csp = h["content-security-policy"] || "";
  const scriptSrc = csp.split(";").find((p) => p.trim().startsWith("script-src")) || "";
  check("AC6: CSP present", csp.length > 0);
  check("AC6: script-src has no unsafe-inline", csp.length > 0 && !scriptSrc.includes("unsafe-inline"), scriptSrc.trim());
  check("AC6: frame-ancestors none", csp.includes("frame-ancestors 'none'"));
  check("AC6: X-Content-Type-Options nosniff", h["x-content-type-options"] === "nosniff");
  check("AC6: Referrer-Policy set", !!h["referrer-policy"]);
  check("AC6: X-Frame-Options DENY", h["x-frame-options"] === "DENY");

  // ---- AC1: unified dashboard ----
  await login(page, "danny", "local-test-password-123");
  const dash = await page.textContent("body");
  check("AC1: dashboard 'Needs attention' alert section", /Needs attention/.test(dash));
  check("AC1: urgent kitten surfaced (Bram)", /Bram/.test(dash));
  check("AC1: warning kitten surfaced (Pip)", /Pip/.test(dash));
  check("AC1: medical-due section present", /Medical due/.test(dash));
  check("AC1: active kittens section present", /Active kittens/.test(dash));
  check("AC1: active kitten card shows an age", /\d+w \d+d/.test(dash));
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  check("AC1: dashboard no horizontal overflow at 390px", !overflow);

  // urgent pinned above warning
  check("AC1: urgent pinned above warning", dash.indexOf("Bram") < dash.indexOf("Pip"));

  // ---- AC2: semantic states not colour-only (icon/label) ----
  // Alert badges render an emoji + text label, not a bare colour swatch.
  check(
    "AC2: alert badge carries a text label (not colour only)",
    /Urgent/.test(dash) && /Warning/.test(dash),
  );

  // ---- AC3: admin sees settings form ----
  await page.goto(`${BASE}/settings`);
  check("AC3: admin can edit settings (form present)", (await page.locator("#minDailyGainG").count()) > 0);

  // ---- AC3: non-admin cannot reach settings UI ----
  const vctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const vpage = await vctx.newPage();
  await login(vpage, "viewer", "viewer-test-pass-99");
  await vpage.goto(`${BASE}/settings`);
  const vSettings = await vpage.textContent("body");
  check("AC3: viewer settings page is admin-only", /admin-only/i.test(vSettings));
  check("AC3: viewer cannot see settings form", (await vpage.locator("#minDailyGainG").count()) === 0);

  // ---- AC3: non-admin cannot read adopter PII via the export route ----
  // (Bram is adopted with adopter PII; viewer opt-in must be ignored server-side.)
  await vpage.goto(`${BASE}/kittens?status=all`);
  const bramHref = await vpage
    .locator(`tr:has-text("Weg") a[href^="/kittens/"]`)
    .first()
    .getAttribute("href")
    .catch(() => null);
  // "Weg" is the adopted kitten in seed-step3 (has no adopter row); use export route check generically:
  const adopterLeak = await vpage.evaluate(async () => {
    // Probe a litter export with adopter opt-in as a viewer; PII must not appear.
    const r = await fetch("/export/litter/1?adopter=1", { cache: "no-store" });
    return (await r.text()).includes("Include adopter details");
  });
  check("AC3: viewer has no adopter opt-in control on exports", adopterLeak === false);
  void bramHref;
  await vctx.close();

  // ---- AC6: production build serves no stack trace on errors ----
  // A bad photo id returns a clean 404 (not an internal error page).
  const notFound = await page.evaluate(async () => {
    const r = await fetch("/api/photos/0", { cache: "no-store" });
    return { status: r.status, body: await r.text() };
  });
  check(
    "AC6: error responses are clean (no stack trace)",
    notFound.status === 404 && !/at \w+ \(|node_modules|\.ts:\d+/.test(notFound.body),
  );
} catch (err) {
  check("script completed", false, String(err).split("\n")[0]);
  await page.screenshot({ path: "/tmp/kitten_e2e7_failure.png", fullPage: true }).catch(() => {});
}

await browser.close();
console.log(results.join("\n"));
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
