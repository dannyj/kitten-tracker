import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3100";
const results = [];
let failures = 0;

function check(name, ok, extra = "") {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
}

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); // phone width per AC8
const page = await ctx.newPage();
page.setDefaultTimeout(15000);

try {
  // ---- login ----
  await page.goto(`${BASE}/login`);
  await page.fill("#username", "danny");
  await page.fill("#password", "local-test-password-123");
  await page.click("form button[type=submit]");
  await page.waitForURL(`${BASE}/`);
  check("login as admin", true);

  // ---- AC1: mother -> litter -> 4 kittens, ages correct ----
  await page.goto(`${BASE}/mothers/new`);
  await page.fill("#name", "Saar");
  await page.fill("#shelterNumber", "M-2026-001");
  await page.fill("#intakeDate", isoDaysAgo(30));
  await page.fill("#notesBehaviour", "Sweet, protective of kittens.");
  await page.click("button[type=submit]:has-text('Add mother')");
  await page.waitForURL(/\/mothers\/\d+$/);
  const motherUrl = page.url();
  check("create mother", true, motherUrl);

  // add litter from mother page (birth 23 days ago => 3w 2d)
  await page.click("text=Add litter");
  await page.waitForURL(/\/litters\/new\?mother=\d+/);
  await page.fill("#birthDate", isoDaysAgo(23));
  await page.click("button[type=submit]:has-text('Add litter')");
  await page.waitForURL(motherUrl);
  check("create litter from mother", true);

  // add 4 kittens via the litter's Add kitten link
  const names = ["Muis", "Pip", "Bram", "Fleur"];
  for (let i = 0; i < names.length; i++) {
    await page.goto(motherUrl);
    await page.click("text=Add kitten");
    await page.waitForURL(/\/kittens\/new\?litter=\d+/);
    // birth date should be pre-filled from the litter
    const prefilled = await page.inputValue("#birthDate");
    if (i === 0)
      check("birth date pre-filled from litter", prefilled === isoDaysAgo(23), prefilled);
    await page.fill("#name", names[i]);
    await page.fill("#shelterNumber", `K-2026-00${i + 1}`);
    if (i === 0) {
      // hand-feeding toggle reveals interval
      await page.click("#handFeeding");
      await page.waitForSelector("#feedingIntervalMinutes");
      await page.fill("#feedingIntervalMinutes", "120");
    }
    await page.click("button[type=submit]:has-text('Add kitten')");
    await page.waitForURL(/\/kittens\/\d+$/);
  }
  check("create 4 kittens", true);

  // ages on the list
  await page.goto(`${BASE}/kittens`);
  const ageCells = await page.locator("td:has-text('3w 2d')").count();
  check("AC1: ages show 3w 2d for all 4", ageCells === 4, `found ${ageCells}`);

  // ---- AC2: duplicate shelter number ----
  await page.goto(`${BASE}/kittens/new`);
  await page.fill("#name", "Dup");
  await page.fill("#shelterNumber", "K-2026-001");
  await page.click("button[type=submit]:has-text('Add kitten')");
  await page.waitForSelector("p[role=alert]");
  const dupError = await page.textContent("p[role=alert]");
  const namePreserved = (await page.inputValue("#name")) === "Dup";
  check(
    "AC2: duplicate shelter number readable error",
    /already in use/.test(dupError ?? ""),
    dupError ?? "",
  );
  check("AC2: form state preserved", namePreserved);

  // ---- AC3: orphan litter ----
  await page.goto(`${BASE}/litters/new`);
  await page.fill("#birthDate", isoDaysAgo(10));
  await page.click("#birthDateEstimated");
  await page.click("button[type=submit]:has-text('Add litter')");
  await page.waitForURL(/\/kittens\/new\?litter=\d+/);
  await page.fill("#name", "Wees");
  await page.click("button[type=submit]:has-text('Add kitten')");
  await page.waitForURL(/\/kittens\/\d+$/);
  const orphanUrl = page.url();
  const orphanBody = await page.textContent("body");
  check("AC3: orphan litter + kitten, estimated age", orphanBody.includes("~1w 3d"), orphanUrl);

  // ---- AC4: status pipeline ----
  // kitten 1 (Muis): intake -> in_care (forward, no note needed)
  await page.goto(`${BASE}/kittens/1`);
  await page.click("button:has-text('→ In care')");
  await page.click("button:has-text('Mark as in care')");
  await page.waitForSelector("span:text-is('In care')");
  check("AC4: forward intake→in_care", true);

  // backwards in_care -> intake without note: HTML required blocks; remove required to test server validation
  await page.click("button:has-text('↩ Intake')");
  await page.waitForSelector("#note");
  await page.evaluate(() => document.querySelector("#note").removeAttribute("required"));
  await page.click("button:has-text('Mark as intake')");
  await page.waitForSelector("p[role=alert]");
  const backError = await page.textContent("p[role=alert]");
  check(
    "AC4: backwards without note rejected server-side",
    /requires a note/.test(backError ?? ""),
    backError ?? "",
  );
  // now with note
  await page.fill("#note", "Logged status too early, correcting.");
  await page.click("button:has-text('Mark as intake')");
  await page.waitForSelector("span:text-is('Intake')");
  check("AC4: backwards with note accepted", true);

  // forward again: intake -> in_care -> ready
  await page.click("button:has-text('→ In care')");
  await page.click("button:has-text('Mark as in care')");
  await page.waitForSelector("span:text-is('In care')");
  await page.click("button:has-text('→ Ready')");
  await page.click("button:has-text('Mark as ready')");
  await page.waitForSelector("span:text-is('Ready for adoption')");

  // history timeline shows all changes
  const historyCount = await page.locator("ol li").count();
  check("AC4: history timeline has all entries", historyCount >= 5, `entries: ${historyCount}`);

  // ---- AC5: adoption requires adopter details ----
  await page.click("button:has-text('→ Adopted')");
  await page.waitForSelector("#adopterName");
  // try submitting without name (remove required to exercise server validation)
  await page.evaluate(() => document.querySelector("#adopterName").removeAttribute("required"));
  await page.click("button:has-text('Mark as adopted')");
  await page.waitForSelector("p[role=alert]");
  const adoptError = await page.textContent("p[role=alert]");
  check(
    "AC5: adoption without details rejected",
    /required/i.test(adoptError ?? ""),
    adoptError ?? "",
  );
  await page.fill("#adopterName", "Familie Jansen");
  await page.fill("#adopterPhone", "06 12345678");
  await page.fill("#adopterEmail", "jansen@example.nl");
  await page.fill("#adopterAddress", "Dorpsstraat 1, Utrecht");
  await page.fill("#shelterReference", "REF-7788");
  await page.click("button:has-text('Mark as adopted')");
  await page.waitForSelector("span:text-is('Adopted')");
  const detailBody = await page.textContent("body");
  check(
    "AC5: adopter info on detail page (admin)",
    detailBody.includes("Familie Jansen") && detailBody.includes("06 12345678"),
  );

  // dd-mm-yyyy date format spot check (adoption date today)
  const t = new Date();
  const ddmmyyyy = `${String(t.getDate()).padStart(2, "0")}-${String(t.getMonth() + 1).padStart(2, "0")}-${t.getFullYear()}`;
  check("dates shown dd-mm-yyyy", detailBody.includes(ddmmyyyy), ddmmyyyy);

  // ---- AC7: default filter hides adopted ----
  await page.goto(`${BASE}/kittens`);
  const bodyDefault = await page.textContent("body");
  check("AC7: default filter hides adopted Muis", !bodyDefault.includes("Muis"));
  await page.goto(`${BASE}/kittens?status=all`);
  const bodyAll = await page.textContent("body");
  check("AC7: status=all shows Muis", bodyAll.includes("Muis"));
  await page.goto(`${BASE}/kittens?status=adopted`);
  const bodyAdopted = await page.textContent("body");
  check("AC7: status=adopted filter", bodyAdopted.includes("Muis") && !bodyAdopted.includes("Pip"));
  await page.goto(`${BASE}/kittens?litter=2`);
  const bodyLitter = await page.textContent("body");
  check("AC7: litter filter", bodyLitter.includes("Wees") && !bodyLitter.includes("Pip"));

  // ---- AC6: mother health log ----
  await page.goto(motherUrl);
  await page.fill("#new-entry", "Eet goed, verzorgt alle kittens.");
  await page.click("button:has-text('Add entry')");
  await page.waitForSelector("text=Eet goed");
  await page.fill("#new-entry", "Tweede observatie.");
  await page.click("button:has-text('Add entry')");
  await page.waitForTimeout(500);
  await page.reload();
  const entries = await page.locator("li:has(button:has-text('Edit'))").allTextContents();
  check(
    "AC6: entries newest first",
    entries.length >= 2 && entries[0].includes("Tweede"),
    entries[0]?.slice(0, 60),
  );

  // edit within window works
  await page.locator("button:has-text('Edit')").first().click();
  await page.waitForSelector("li form textarea[name=entry]");
  await page.fill("li form textarea[name=entry]", "Tweede observatie (gecorrigeerd).");
  await page.click("li button:has-text('Save')");
  await page.waitForSelector("text=gecorrigeerd");
  check("AC6: edit within 15-min window works", true);

  await page.screenshot({ path: "/tmp/kitten_mobile_mother.png", fullPage: true });

  // ---- AC8 spot check: no horizontal overflow at 390px on key pages ----
  for (const path of ["/kittens", motherUrl.replace(BASE, ""), "/kittens/1", "/kittens/new"]) {
    await page.goto(`${BASE}${path}`);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    check(`AC8: no horizontal overflow at 390px on ${path}`, !overflow);
  }

  // ---- viewer role: adopter PII hidden, no adopted button ----
  const vctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const vpage = await vctx.newPage();
  await vpage.goto(`${BASE}/login`);
  await vpage.fill("#username", "viewer");
  await vpage.fill("#password", "viewer-test-pass-99");
  await vpage.click("form button[type=submit]");
  await vpage.waitForURL(`${BASE}/`);
  await vpage.goto(`${BASE}/kittens/1`);
  const viewerBody = await vpage.textContent("body");
  check(
    "viewer: adopter PII hidden",
    !viewerBody.includes("Familie Jansen") && !viewerBody.includes("06 12345678"),
  );
  await vctx.close();
} catch (err) {
  check("script completed", false, String(err).split("\n")[0]);
  await page.screenshot({ path: "/tmp/kitten_e2e_failure.png", fullPage: true }).catch(() => {});
}

await browser.close();
console.log(results.join("\n"));
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
