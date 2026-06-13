import { chromium } from "playwright";
import exifr from "exifr";

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
page.setDefaultTimeout(20000);

const fileInput = () => page.locator("#photos input[type=file]");
const gridItems = () => page.locator("[data-testid=photo-grid] > li");
async function waitCount(n) {
  await page.waitForFunction(
    (n) => document.querySelectorAll("[data-testid=photo-grid] > li").length === n,
    n,
    { timeout: 20000 },
  );
}
// Fetch bytes from inside the page (sends the Secure localhost cookie).
function fetchBytes(p, url) {
  return p.evaluate(async (u) => {
    const r = await fetch(u, { cache: "no-store" });
    const b = new Uint8Array(await r.arrayBuffer());
    let bin = "";
    for (const x of b) bin += String.fromCharCode(x);
    return {
      status: r.status,
      ct: r.headers.get("content-type") || "",
      b64: btoa(bin),
      len: b.length,
    };
  }, url);
}
async function lastThumbId() {
  const src = await gridItems().last().locator("img").getAttribute("src");
  return Number(src.match(/\/api\/photos\/(\d+)/)[1]);
}

try {
  await page.goto(`${BASE}/login`);
  await page.fill("#username", "danny");
  await page.fill("#password", "local-test-password-123");
  await page.click("form button[type=submit]");
  await page.waitForURL(`${BASE}/`);

  await page.goto(`${BASE}/kittens?status=all`);
  await page.locator(`tr:has-text("Muis") td`).last().click();
  await page.waitForURL(/\/kittens\/\d+$/);
  const muis = new URL(page.url()).pathname;
  await page.goto(`${BASE}${muis}`);
  await page.waitForSelector("#photos");

  // ---- AC1: JPEG with EXIF -> correct age-at-photo ----
  await fileInput().setInputFiles(`${FX}/with-exif.jpg`);
  await waitCount(1);
  // birth 2026-05-01, photo 2026-05-20 => 2w 5d
  check(
    "AC1: EXIF JPEG shows correct age-at-photo (2w 5d)",
    (await gridItems().first().textContent()).includes("2w 5d"),
    await gridItems().first().textContent(),
  );

  // ---- AC3: stored file is re-encoded (no EXIF/GPS), served as webp ----
  const exifPhotoId = await lastThumbId();
  const served = await fetchBytes(page, `${BASE}/api/photos/${exifPhotoId}`);
  const bytes = Buffer.from(served.b64, "base64");
  const isWebp =
    bytes.slice(0, 4).toString("latin1") === "RIFF" &&
    bytes.slice(8, 12).toString("latin1") === "WEBP";
  const reExif = await exifr.parse(bytes).catch(() => null);
  check("AC3: served image is webp", served.ct === "image/webp" && isWebp, served.ct);
  check(
    "AC3: re-encoded file has no EXIF date / GPS",
    !reExif || (!reExif.DateTimeOriginal && !reExif.latitude && !reExif.GPSLatitude),
    reExif ? JSON.stringify(Object.keys(reExif)).slice(0, 60) : "no exif",
  );

  // ---- AC1 fallback: no-EXIF image falls back + prompts for manual ----
  await fileInput().setInputFiles(`${FX}/no-exif.png`);
  await waitCount(2);
  await gridItems().last().click(); // newest (upload date today) is last
  await page.waitForSelector("[role=dialog]");
  let dlg = await page.locator("[role=dialog]").textContent();
  check(
    "AC1: no-date photo falls back to upload date + manual prompt",
    /upload date/.test(dlg) && /set it manually/.test(dlg),
  );

  // ---- AC5: manual override before birth is flagged; later date recomputes ----
  // The lightbox stays open and updates in place after Save (router.refresh()).
  await page.fill("[role=dialog] input[name=takenAt]", "2026-04-20"); // before birth 2026-05-01
  await page.click("[role=dialog] button:has-text('Save')");
  await page.waitForFunction(() =>
    document.querySelector("[role=dialog]")?.textContent.includes("before birth"),
  );
  dlg = await page.locator("[role=dialog]").textContent();
  check(
    "AC5: photo dated before birth is flagged (not negative age)",
    /before birth/.test(dlg) && /set manually/.test(dlg),
  );
  await page.fill("[role=dialog] input[name=takenAt]", "2026-06-01"); // after birth => age
  await page.click("[role=dialog] button:has-text('Save')");
  await page.waitForFunction(() => {
    const t = document.querySelector("[role=dialog]")?.textContent ?? "";
    return /\d+w \d+d/.test(t) && !t.includes("before birth");
  });
  dlg = await page.locator("[role=dialog]").textContent();
  check(
    "AC5: manual override sets source=manual and recomputes age",
    /set manually/.test(dlg) && /4w/.test(dlg),
    dlg.match(/\d+w \d+d/)?.[0],
  );
  await page.keyboard.press("Escape");

  // ---- AC2: HEIC converts + displays; non-image rejected by sniffing ----
  await fileInput().setInputFiles(`${FX}/phone.heic`);
  await waitCount(3);
  const heicId = await lastThumbId();
  const heicServed = await fetchBytes(page, `${BASE}/api/photos/${heicId}`);
  const heicBytes = Buffer.from(heicServed.b64, "base64");
  check(
    "AC2: HEIC converted + served as displayable webp",
    heicServed.ct === "image/webp" && heicBytes.slice(8, 12).toString("latin1") === "WEBP",
    heicServed.ct,
  );

  await fileInput().setInputFiles(`${FX}/fake.jpg`);
  await page.waitForSelector("#photos li:has-text('Failed')");
  check("AC2: non-image (renamed .txt) rejected by content sniffing", true);
  await waitCount(3); // unchanged — the fake didn't create a photo

  // ---- AC8: batch upload, independent success/failure ----
  await fileInput().setInputFiles([`${FX}/batch-a.jpg`, `${FX}/batch-b.jpg`, `${FX}/fake.jpg`]);
  await page.waitForSelector("#photos li:has-text('Failed')");
  await waitCount(5); // +2 succeeded, fake failed
  const added = await page.locator("#photos li:has-text('Added')").count();
  const failed = await page.locator("#photos li:has-text('Failed')").count();
  check(
    "AC8: batch upload independent (2 ok, 1 failed)",
    added === 2 && failed === 1,
    `added ${added}, failed ${failed}`,
  );

  // ---- AC6: cover photo reflects in list ----
  await gridItems().first().click();
  await page.waitForSelector("[role=dialog]");
  await page.click("[role=dialog] button:has-text('Set as cover')");
  await page.waitForTimeout(800);
  const coverId = exifPhotoId;
  await page.goto(`${BASE}/kittens?status=all`);
  const rowImg = await page
    .locator(`tr:has-text("Muis") img[src*="/api/photos/"]`)
    .first()
    .getAttribute("src");
  check("AC6: cover photo shows in kitten list", rowImg.includes(`/api/photos/${coverId}`), rowImg);

  // ---- AC4: auth required, unknown -> 404, traversal blocked ----
  const anon = await browser.newContext();
  const anonReq = await anon.request.get(`${BASE}/api/photos/${coverId}`);
  check(
    "AC4: image requires a session (401 without cookie)",
    anonReq.status() === 401,
    `status ${anonReq.status()}`,
  );
  await anon.close();
  const unknown = await fetchBytes(page, `${BASE}/api/photos/999999`);
  check("AC4: unknown id -> 404", unknown.status === 404);
  const traversal = await fetchBytes(page, `${BASE}/api/photos/..%2f..%2f..%2fetc%2fpasswd`);
  check("AC4: path-traversal id -> 404", traversal.status === 404, `status ${traversal.status}`);

  // ---- AC7: delete removes file + row (served URL 404 after) ----
  await page.goto(`${BASE}${muis}`);
  await page.waitForSelector("#photos");
  const before = await gridItems().count();
  const delId = await lastThumbId();
  await gridItems().last().click();
  await page.waitForSelector("[role=dialog]");
  page.once("dialog", (d) => d.accept());
  await page.click("[role=dialog] button:has-text('Delete')");
  await waitCount(before - 1);
  const goneServed = await fetchBytes(page, `${BASE}/api/photos/${delId}`);
  check("AC7: deleted photo row + file removed (404 after)", goneServed.status === 404);

  // ---- AC9: 390px usable ----
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  check("AC9: kitten photos page no overflow at 390px", !overflow);

  // ---- mother gallery: date only, no age ----
  await page.goto(`${BASE}/mothers`);
  const motherHref = await page
    .locator(`a[href^="/mothers/"]:has-text("Mama")`)
    .first()
    .getAttribute("href");
  await page.goto(`${BASE}${motherHref}`);
  await page.waitForSelector("text=Add photos");
  await page.locator("input[type=file]").first().setInputFiles(`${FX}/batch-a.jpg`);
  await page.waitForSelector("[data-testid=photo-grid] > li");
  check(
    "mother gallery accepts photos (date only)",
    (await page.locator("[data-testid=photo-grid] > li").count()) >= 1,
  );
} catch (err) {
  check("script completed", false, String(err).split("\n")[0]);
  await page.screenshot({ path: "/tmp/kitten_e2e6_failure.png", fullPage: true }).catch(() => {});
}

await browser.close();
console.log(results.join("\n"));
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
