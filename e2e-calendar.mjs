import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3100";
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ timezoneId: process.env.TZ || "Europe/Amsterdam" });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  await page.clock.install({ time: new Date("2026-11-07T23:30:00Z") });
  await page.goto(`${BASE}/login`);
  await page.fill("#username", "danny");
  await page.fill("#password", "local-test-password-123");
  await page.click("form button[type=submit]");
  await page.waitForURL(`${BASE}/`);

  await page.goto(`${BASE}/mothers/new`);
  await page.fill("#name", "Calendar mother");
  await page.fill("#shelterNumber", "M-CALENDAR");
  await page.fill("#intakeDate", "2026-11-07");
  await page.click("button[type=submit]:has-text('Add mother')");
  await page.waitForURL(/\/mothers\/\d+$/);
  const motherUrl = page.url();

  await page.click("text=Add litter");
  await page.waitForURL(/\/litters\/new\?mother=\d+/);
  await page.fill("#birthDate", "2026-10-16");
  await page.click("button[type=submit]:has-text('Add litter')");
  await page.waitForURL(motherUrl);
  await page.click("text=Add kitten");
  await page.waitForURL(/\/kittens\/new\?litter=\d+/);
  await page.fill("#name", "Calendar kitten");
  await page.fill("#shelterNumber", "K-CALENDAR");
  await page.fill("#birthDate", "2026-10-16");
  await page.click("button[type=submit]:has-text('Add kitten')");
  await page.waitForURL(/\/kittens\/\d+$/);
  assert.match(await page.textContent("body"), /3w 2d/);
  console.log("PASS: age uses Amsterdam date while UTC is yesterday");
  const kittenUrl = page.url();

  for (const [subject, url] of [
    ["kitten", kittenUrl],
    ["mother", motherUrl],
  ]) {
    await page.goto(url);
    const form = page.locator("#medical form").first();
    await form.locator("input[name=givenAt]").waitFor();
    assert.equal(await form.locator("input[name=givenAt]").inputValue(), "2026-11-08");
    const batch = `CALENDAR-${subject}`;
    await form.locator("input[name=batchNumber]").fill(batch);
    await form.locator("button[type=submit]").click();
    await page.locator("#medical li").filter({ hasText: batch }).waitFor();
    console.log(`PASS: ${subject} treatment accepts local today before UTC midnight`);

    // Bypass browser validation to test the server's future-date guard too.
    await form.evaluate((element) => {
      element.noValidate = true;
    });
    await form.locator("input[name=givenAt]").fill("2026-11-09");
    await form.locator("input[name=nextDueDate]").fill("");
    await form.locator("button[type=submit]").click();
    await form
      .locator("[role=alert]")
      .filter({ hasText: "Given date can't be in the future" })
      .waitFor();
    console.log(`PASS: ${subject} treatment still rejects tomorrow on the server`);
  }
} finally {
  await browser.close();
}
