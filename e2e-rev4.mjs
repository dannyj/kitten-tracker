// rev4 — viewings & adoption workflow. Runs under verify-prod.sh (server in UTC,
// browser in a different zone) at a 390px phone viewport.
//
// AC2 (migration of existing step-2 viewing data into the party model) is proven
// separately and deterministically by scripts/verify-migration.cjs — it can't be
// reconstructed through the UI here, so it's asserted there, not in this e2e.
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

async function login(user, pass) {
  await page.goto(`${BASE}/login`);
  await page.fill("#username", user);
  await page.fill("#password", pass);
  await page.click("form button[type=submit]");
  await page.waitForURL(`${BASE}/`);
}
async function partyHref(name) {
  await page.goto(`${BASE}/parties?status=all`);
  await page.locator(`a:has-text("${name}")`).first().click();
  await page.waitForURL(/\/parties\/\d+$/);
  return new URL(page.url()).pathname;
}
async function kittenHref(name) {
  // The kittens list uses clickable rows (role="link"), not anchor tags.
  await page.goto(`${BASE}/kittens?status=all`);
  await page.locator(`tr[role=link]:has-text("${name}")`).first().click();
  await page.waitForURL(/\/kittens\/\d+$/);
  return new URL(page.url()).pathname;
}
async function noOverflow() {
  return !(await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  ));
}

try {
  await login("danny", "local-test-password-123");
  check("login as admin", true);

  // ---- AC: default filter hides off-ramped parties; all shows them ----
  await page.goto(`${BASE}/parties`);
  let body = await page.textContent("body");
  check(
    "default filter shows active parties",
    body.includes("Familie Bakker") && body.includes("Sophie Visser"),
  );
  check("default filter hides withdrew party", !body.includes("Tom Pruim"));
  check("AC9: parties list no overflow at 390px", await noOverflow());

  await page.goto(`${BASE}/parties?status=all`);
  body = await page.textContent("body");
  check("status=all reveals withdrew party", body.includes("Tom Pruim"));

  // ---- AC8 (admin): full contact details visible to admin ----
  const bakker = await partyHref("Familie Bakker");
  body = await page.textContent("body");
  check("admin sees party contact details", body.includes("06 55510100"));
  check("AC9: party detail no overflow at 390px", await noOverflow());
  check(
    "past viewing with notes is shown",
    body.includes("Lovely home with a garden") && body.includes("Pixel") && body.includes("Dot"),
  );

  // ---- AC4: per-viewing notes/impressions editable ----
  await page.locator("button:has-text('Edit')").first().click();
  await page.waitForSelector("text=Edit viewing");
  await page.fill("#notes", "UPDATED: calm home, no other pets, great fit.");
  await page.click("button[type=submit]:has-text('Save')");
  await page.waitForSelector("text=UPDATED: calm home");
  body = await page.textContent("body");
  check("AC4: viewing notes edited", body.includes("UPDATED: calm home"));

  // ---- AC3 + AC1: book a viewing from the party page (party prefilled) ----
  await page.goto(`${BASE}${bakker}`);
  await page.click("a:has-text('Book a viewing')");
  await page.waitForURL(/\/viewings\/new\?party=\d+/);
  check(
    "AC3: booking from party prefills the party",
    (await page.textContent("#interestedPartyId")).includes("Familie Bakker"),
  );
  check("AC9: new-viewing form no overflow at 390px", await noOverflow());
  await page.locator("label:has-text('Bean') button[role=checkbox]").click();
  await page.click("button[type=submit]:has-text('Book viewing')");
  await page.waitForURL(`${BASE}/viewings`);
  // AC1: the same party is now linked to Bean too, no details retyped.
  await page.goto(`${BASE}${bakker}`);
  body = await page.textContent("body");
  check("AC1: party reused across viewings/kittens (Bean now linked)", body.includes("Bean"));

  // ---- AC3: book a viewing from a kitten page (kitten prefilled) ----
  const pixel = await kittenHref("Pixel");
  await page.click("a:has-text('Book viewing')");
  await page.waitForURL(/\/viewings\/new\?kitten=\d+/);
  const pixelChecked = await page
    .locator("label:has-text('Pixel') button[role=checkbox]")
    .getAttribute("aria-checked");
  check("AC3: booking from kitten prefills that kitten", pixelChecked === "true");
  // choose a party via the Radix select
  await page.click("#interestedPartyId");
  await page.click("[role=option]:has-text('Sophie Visser')");
  await page.click("button[type=submit]:has-text('Book viewing')");
  await page.waitForURL(`${BASE}/viewings`);

  // ---- AC3: calendar groups upcoming + past ----
  body = await page.textContent("body");
  check("AC3: calendar has Upcoming + Past sections", body.includes("Upcoming") && body.includes("Past"));
  check("AC9: viewings calendar no overflow at 390px", await noOverflow());

  // ---- AC5: pipeline transitions + off-ramp (foster-driven) ----
  await partyHref("Sophie Visser");
  await page.click("button:has-text('→ Viewed')");
  await page.waitForSelector("button:has-text('→ Approved')"); // only reachable from 'viewed'
  check("AC5: viewing_booked → viewed", true);
  await page.click("button:has-text('→ Approved')");
  await page.waitForSelector("button:has-text('(link kitten)')"); // adopt only from 'approved'
  check("AC5: viewed → approved", true);
  await page.click("button:has-text('Withdrew')"); // off-ramp
  await page.waitForSelector("button:has-text('→ Enquired')"); // withdrew can only re-engage
  check("AC5: off-ramp to withdrew works", true);

  // ---- AC6: adopt links party → kitten(s), writes adopter + status_history ----
  await partyHref("Familie Bakker");
  await page.click("button:has-text('(link kitten)')");
  await page.waitForSelector("text=Link adoption");
  await page.locator("label:has-text('Pixel') button[role=checkbox]").click();
  await page.locator("label:has-text('Dot') button[role=checkbox]").click();
  await page.click("button:has-text('Confirm adoption')");
  await page.waitForSelector("text=Link adoption", { state: "detached" });

  await page.goto(`${BASE}${pixel}`);
  await page.waitForSelector("span:text-is('Adopted')");
  body = await page.textContent("body");
  check("AC6: kitten moved to adopted via pipeline", body.includes("Adopted"));
  check(
    "AC6: status_history shows the adopted move with adopter",
    body.includes("Adopted by Familie Bakker & Jan"),
  );
  check("AC6: adopter record links the party's details", body.includes("Familie Bakker & Jan"));

  // ---- AC7: an already-adopted kitten can't be double-adopted ----
  // Klaassen is linked only to Dot, which Bakker just adopted.
  await partyHref("Familie Klaassen");
  await page.click("button:has-text('(link kitten)')");
  await page.waitForSelector("text=Link adoption");
  body = await page.textContent("body");
  check(
    "AC7: adopted kitten no longer offered; clear message shown",
    /No adoptable kittens/.test(body),
  );
  await page.keyboard.press("Escape");

  // ---- AC8 (viewer): contact details omitted server-side, not just hidden ----
  await ctx.clearCookies();
  await login("viewer", "viewer-test-pass-99");
  await page.goto(`${BASE}/parties?status=all`);
  const listHtml = await page.content();
  check("AC8: viewer list omits contact details", !listHtml.includes("55510100"));

  await page.goto(`${BASE}${bakker}`);
  const detailHtml = await page.content();
  check(
    "AC8: viewer party detail omits contact (server HTML)",
    !detailHtml.includes("55510100") && !detailHtml.includes("bakker@example.nl"),
  );
  check(
    "AC8: viewer told contact is admin-only",
    detailHtml.includes("Contact details are visible to admins only"),
  );
} catch (err) {
  check("unexpected error", false, String(err && err.message ? err.message : err));
} finally {
  console.log(results.join("\n"));
  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAIL`);
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
}
