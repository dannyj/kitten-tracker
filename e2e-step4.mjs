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

async function login() {
  await page.goto(`${BASE}/login`);
  await page.fill("#username", "danny");
  await page.fill("#password", "local-test-password-123");
  await page.click("form button[type=submit]");
  await page.waitForURL(`${BASE}/`);
}

async function kittenHref(name) {
  await page.goto(`${BASE}/kittens?status=all`);
  return page.locator(`tr:has-text("${name}") a[href^="/kittens/"]`).first().getAttribute("href");
}

async function noOverflow() {
  return !(await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  ));
}

try {
  await login();

  const hidde = await kittenHref("Hidde");
  const mauw = await kittenHref("Mauw");
  const bonk = await kittenHref("Bonk");
  const stil = await kittenHref("Stil");

  // ---- AC1: section only for hand-fed; toggle off hides + preserves; toggle on restores ----
  await page.goto(`${BASE}${stil}`);
  check(
    "AC1: non-hand-fed kitten has no feeding section",
    !(await page.textContent("body")).includes("Hand-feeding"),
  );

  await page.goto(`${BASE}${hidde}`);
  await page.waitForSelector("#feeding");
  const feedsBefore = await page.locator("#feeding li:has-text('ml')").count();
  check(
    "AC1: hand-fed kitten shows feeding section with feeds",
    feedsBefore >= 3,
    `feeds: ${feedsBefore}`,
  );

  // toggle OFF
  await page.goto(`${BASE}${hidde}/edit`);
  if (await page.locator("#handFeeding[data-state=checked]").count()) {
    await page.click("#handFeeding");
  }
  await page.click("button:has-text('Save changes')");
  await page.waitForURL(new RegExp(`${hidde}$`));
  check(
    "AC1: toggling hand-feeding off hides the section",
    !(await page.textContent("body")).includes("Hand-feeding"),
  );

  // toggle ON again
  await page.goto(`${BASE}${hidde}/edit`);
  if (!(await page.locator("#handFeeding[data-state=checked]").count())) {
    await page.click("#handFeeding");
  }
  await page.click("button:has-text('Save changes')");
  await page.waitForURL(new RegExp(`${hidde}$`));
  await page.waitForSelector("#feeding");
  const feedsAfter = await page.locator("#feeding li:has-text('ml')").count();
  check(
    "AC1: feed history survives a toggle round-trip",
    feedsAfter === feedsBefore,
    `before ${feedsBefore}, after ${feedsAfter}`,
  );

  // ---- AC2: log a feed in one action; timestamp defaults to now; time-since-previous ----
  await page.goto(`${BASE}${mauw}`);
  await page.waitForSelector("#feeding");
  // expand details to verify the timestamp default
  await page.click("button:has-text('Add time, formula, quality')");
  const ts = await page.inputValue("#fedAt");
  check("AC2: feed time defaults to now", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(ts), ts);
  await page.fill("#amountMl", "9");
  await page.click("#feeding button:has-text('Log feed')");
  await page.waitForSelector("#feeding li:has-text('9 ml')");
  check("AC2: feed logged and listed", true);
  // it should show "after previous" relative to Mauw's seeded feed
  check(
    "AC2: shows time since previous feed",
    (await page.textContent("#feeding")).includes("after previous"),
  );

  // ---- AC3: countdown overdue vs upcoming; inline interval recomputes ----
  await page.goto(`${BASE}${hidde}`);
  check(
    "AC3: overdue kitten shows overdue countdown",
    (await page.textContent("#feeding")).includes("overdue by"),
  );
  await page.goto(`${BASE}${mauw}`);
  let feedingText = await page.textContent("#feeding");
  check("AC3: upcoming kitten shows 'Next feed in'", /Next feed in/.test(feedingText));
  // change interval to 30 min inline -> last feed was just now (the 9ml), due in ~30; set to 30 -> recompute
  await page.click("#feeding button:has-text('change')");
  await page.fill("#feedingIntervalMinutes", "30");
  await page.click("#feeding button:has-text('Save')");
  await page.waitForFunction(() =>
    document.querySelector("#feeding")?.textContent.includes("every 30 min"),
  );
  check(
    "AC3: inline interval edit persists & recomputes",
    (await page.textContent("#feeding")).includes("every 30 min"),
  );

  // ---- AC5: intake total + target from weight; nudge when no weight ----
  await page.goto(`${BASE}${hidde}`);
  feedingText = await page.textContent("#feeding");
  check(
    "AC5: daily intake total shown",
    /Today: \d+ feeds? · [\d.]+ ml/.test(feedingText),
    feedingText.match(/Today:[^·]*·[^G]*/)?.[0]?.trim(),
  );
  // Hidde weight 90 g -> ~24 ml/feed target
  check(
    "AC5: per-feed target derived from weight",
    /~24 ml\/feed/.test(feedingText),
    feedingText.match(/Guide:[^R]*/)?.[0]?.trim(),
  );
  await page.goto(`${BASE}${mauw}`);
  check(
    "AC5: no-weight kitten shows the nudge",
    (await page.textContent("#feeding")).includes("Add a weight to see intake targets"),
  );

  // ---- AC6: hand-fed, no feeds -> empty state ----
  await page.goto(`${BASE}${bonk}`);
  feedingText = await page.textContent("#feeding");
  check(
    "AC6: no-feeds kitten shows empty state, no broken countdown",
    feedingText.includes("No feeds yet") && !feedingText.includes("overdue by"),
  );

  // ---- AC7: edit/delete honor the 15-min window (the just-added 9ml on Mauw is fresh) ----
  await page.goto(`${BASE}${mauw}`);
  await page.click("#feeding li:has-text('9 ml') button:has-text('Edit')");
  await page.waitForSelector("#feeding li input[name=amountMl]");
  await page.fill("#feeding li input[name=amountMl]", "10");
  await page.click("#feeding li button:has-text('Save')");
  await page.waitForSelector("#feeding li:has-text('10 ml')");
  check("AC7: feed editable within window", true);
  page.once("dialog", (d) => d.accept());
  await page.click("#feeding li:has-text('10 ml') button:has-text('Delete')");
  await page.waitForFunction(
    () => !document.querySelector("#feeding")?.textContent.includes("10 ml"),
  );
  check("AC7: feed deletable within window", true);
  // seeded (locked) feeds on Hidde show no edit/delete
  await page.goto(`${BASE}${hidde}`);
  check(
    "AC7: locked feeds have no edit button",
    (await page.locator("#feeding li button:has-text('Edit')").count()) === 0,
  );

  // ---- AC4: dashboard panel sorted soonest-due, overdue pinned, one-tap log prefilled ----
  await page.goto(`${BASE}/`);
  await page.waitForSelector("text=Feeding due");
  const firstRow = await page
    .locator("section:has-text('Feeding due') > div > div")
    .first()
    .textContent();
  check(
    "AC4: overdue kitten pinned at top of dashboard",
    /Hidde/.test(firstRow) && /overdue by/.test(firstRow),
    firstRow?.slice(0, 60),
  );
  // one-tap log prefilled for the right kitten
  await page.click("div:has-text('Hidde') >> button:has-text('Log feed')");
  await page.waitForSelector("text=Log feed — Hidde");
  check("AC4: one-tap log opens dialog for the right kitten", true);
  await page.fill("[role=dialog] #amountMl", "8");
  await page.click("[role=dialog] button:has-text('Log feed')");
  await page.waitForSelector("text=Log feed — Hidde", { state: "detached" });
  check("AC4: dashboard log feed submits & closes", true);

  // ---- AC8: 390px usable ----
  check("AC8: dashboard no overflow at 390px", await noOverflow());
  await page.goto(`${BASE}${hidde}`);
  check("AC8: feeding detail no overflow at 390px", await noOverflow());
} catch (err) {
  check("script completed", false, String(err).split("\n")[0]);
  await page.screenshot({ path: "/tmp/kitten_e2e4_failure.png", fullPage: true }).catch(() => {});
}

await browser.close();
console.log(results.join("\n"));
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
