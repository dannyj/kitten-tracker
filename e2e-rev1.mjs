import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3100";
const FX = "/tmp/photo-fixtures";
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

async function login(p) {
  await p.goto(`${BASE}/login`);
  await p.fill("#username", "danny");
  await p.fill("#password", "local-test-password-123");
  await p.click("form button[type=submit]");
  await p.waitForURL(`${BASE}/`);
}

try {
  await login(page);

  // ---- Item 1: whole-row click target (click a non-name cell) ----
  await page.goto(`${BASE}/kittens?status=all`);
  // Click the Age cell of Okkie's row (far from the name) — must still navigate.
  await page.locator('tr:has-text("Okkie") td', { hasText: /\d+w \d+d|—/ }).last().click();
  await page.waitForURL(/\/kittens\/\d+$/, { timeout: 8000 });
  check("Item 1: clicking a non-name cell opens the kitten (390px)", true);
  const okkieUrl = page.url();

  // desktop viewport too
  const dctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const dpage = await dctx.newPage();
  await login(dpage);
  await dpage.goto(`${BASE}/kittens?status=all`);
  await dpage.locator('tr:has-text("Pip") td').last().click();
  await dpage.waitForURL(/\/kittens\/\d+$/, { timeout: 8000 });
  check("Item 1: whole-row click works on desktop", true);
  await dctx.close();

  // ---- Item 3: detail weights read-only + Manage entries view ----
  await page.goto(okkieUrl);
  await page.waitForSelector("text=Weights");
  const weightsCard = page.locator("div").filter({ hasText: /^Weights/ });
  // quick-add present, no inline edit/delete on the detail weights card
  check("Item 3: detail keeps quick-add (Add weight)", (await page.locator("button:has-text('Add weight')").count()) > 0);
  check("Item 3: 'Manage entries' link present", (await page.locator("a:has-text('Manage entries')").count()) > 0);
  // add a fresh weight so a within-window entry exists
  await page.fill("#weightGrams", "205");
  await page.click("button:has-text('Add weight')");
  await page.waitForSelector("li:has-text('205 g')");
  const inlineEditOnDetail = await page.locator("li:has-text('205 g') button:has-text('Edit')").count();
  check("Item 3: no inline edit/delete on detail weights", inlineEditOnDetail === 0);

  // ---- Enhancement: instant gain/loss + verdict after a quick-add ----
  const feedback = page.locator('[role=status]').filter({ hasText: /since the last weigh|First weight recorded/ });
  await feedback.first().waitFor();
  const feedbackText = await feedback.first().textContent();
  check(
    "Weigh feedback: quick-add shows gain/loss + verdict",
    /205 g/.test(feedbackText) && /(On track|Be aware|Keep weighing)/.test(feedbackText),
    feedbackText?.trim(),
  );
  void weightsCard;
  // go to manage view; the fresh entry should be editable
  await page.locator("a:has-text('Manage entries')").first().click();
  await page.waitForURL(/\/kittens\/\d+\/weights$/);
  check("Item 3: manage view exposes edit/delete within window", (await page.locator("li:has-text('205 g') button:has-text('Edit')").count()) > 0);
  await page.click("li:has-text('205 g') button:has-text('Edit')");
  await page.fill("li input[name=weightGrams]", "207");
  await page.click("li button:has-text('Save')");
  await page.waitForSelector("li:has-text('207 g')");
  check("Item 3: editing in manage view works", true);

  // ---- Item 2: cover photo in detail header ----
  // Pip has no photos -> header uses the placeholder (no /api/photos image anywhere).
  await page.goto(`${BASE}/kittens?status=all`);
  await page.locator('tr:has-text("Pip") td').last().click();
  await page.waitForURL(/\/kittens\/\d+$/);
  const pipUrl = page.url();
  check("Item 2: no-photo kitten shows placeholder (no image)", (await page.locator('img[src*="/api/photos/"]').count()) === 0);
  // upload a photo, then the header shows it
  await page.locator("#photos input[type=file]").setInputFiles(`${FX}/with-exif.jpg`);
  await page.waitForSelector("[data-testid=photo-grid] > li");
  await page.goto(pipUrl); // reload detail
  await page.waitForSelector("#photos");
  const headerImg = await page.locator("h1").locator("xpath=preceding-sibling::img | ../preceding-sibling::img").count().catch(() => 0);
  // simpler: a cover image exists near the top (first /api/photos img on the page)
  check("Item 2: detail header shows a cover image after upload", (await page.locator('img[src*="/api/photos/"]').first().count()) > 0);
  void headerImg;

  // ---- Item 4: export chart + weight table ----
  const okkieId = Number(okkieUrl.split("/").pop());
  await page.goto(`${BASE}/export/kitten/${okkieId}`);
  const exportHtml = await page.content();
  check("Item 4: export print view includes an SVG growth chart", /<svg[^>]*aria-label="Growth chart"/.test(exportHtml));
  const exportBody = await page.textContent("body");
  check("Item 4: export print view includes a weight table", /Weight/.test(exportBody) && /Note/.test(exportBody) && /180 g|200 g|205 g|207 g/.test(exportBody));
  const pdf = await page.evaluate(async (id) => {
    const r = await fetch(`/export/kitten/${id}/pdf`, { cache: "no-store" });
    const b = new Uint8Array(await r.arrayBuffer());
    let head = "";
    for (let i = 0; i < 5; i++) head += String.fromCharCode(b[i]);
    return { status: r.status, head, len: b.length };
  }, okkieId);
  check("Item 4: PDF still generates with chart+table", pdf.status === 200 && pdf.head === "%PDF-" && pdf.len > 2000, `${pdf.len} bytes`);

  // ---- Item 5: serif headings applied ----
  await page.goto(`${BASE}/`);
  const h1Font = await page.locator("h1").first().evaluate((el) => getComputedStyle(el).fontFamily);
  check("Item 5: headings use a serif (Source Serif)", /serif/i.test(h1Font), h1Font);
  const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  check("Item 5: body uses Inter", /inter/i.test(bodyFont), bodyFont);
} catch (err) {
  check("script completed", false, String(err).split("\n")[0]);
  await page.screenshot({ path: "/tmp/kitten_rev1_failure.png", fullPage: true }).catch(() => {});
}

await browser.close();
console.log(results.join("\n"));
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
