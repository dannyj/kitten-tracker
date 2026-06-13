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

async function kittenIdByName(name) {
  // Rows navigate via whole-row click (no inner <a>); click and read the URL.
  await page.goto(`${BASE}/kittens?status=all`);
  await page.locator(`tr:has-text("${name}") td`).last().click();
  await page.waitForURL(/\/kittens\/\d+$/);
  return new URL(page.url()).pathname;
}

async function noOverflow(p) {
  return !(await p.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  ));
}

try {
  await login(page, "danny", "local-test-password-123");

  // ---- AC1a: quick-add a weight on a kitten detail page ----
  const vlekHref = await kittenIdByName("Vlek");
  await page.goto(`${BASE}${vlekHref}`);
  const tsValue = await page.inputValue("#weighedAt");
  check(
    "AC1: weigh form timestamp defaults to now",
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(tsValue),
    tsValue,
  );
  await page.fill("#weightGrams", "150");
  await page.click("button:has-text('Add weight')");
  await page.waitForSelector("li:has-text('150 g')");
  check("AC1: weight recorded and listed", true);

  // edit/delete moved to the dedicated manage view (rev 1, item 3).
  await page.goto(`${BASE}${vlekHref}/weights`);
  await page.click("li:has-text('150 g') button:has-text('Edit')");
  await page.waitForSelector("li input[name=weightGrams]");
  await page.fill("li input[name=weightGrams]", "152");
  await page.click("li button:has-text('Save')");
  await page.waitForSelector("li:has-text('152 g')");
  check("weight editable within window (manage view)", true);

  page.once("dialog", (d) => d.accept());
  await page.click("li:has-text('152 g') button:has-text('Delete')");
  await page.waitForFunction(() => !document.body.textContent.includes("152 g"));
  check("weight deletable within window (manage view)", true);

  // ---- AC1b: litter weigh-in flow (bulk: enter all weights, save once) ----
  // Litter B is the orphan overview litter (4 active kittens).
  const eenHref = await kittenIdByName("Een");
  await page.goto(`${BASE}${eenHref}`);
  await page.click("a:has-text('Weigh litter')");
  await page.waitForURL(/\/litters\/\d+\/weigh/);
  // One numeric input per active kitten, plus the shared "When" field.
  await page.waitForSelector("input[aria-label^='Weight for']");
  const weightInputs = page.locator("input[aria-label^='Weight for']");
  const inputCount = await weightInputs.count();
  for (let i = 0; i < inputCount; i++) {
    await weightInputs.nth(i).fill(String(170 + i));
  }
  await page.click("button:has-text('Save all weights')");
  await page.waitForSelector("text=Weigh-in saved");
  check("AC1: litter weigh-in records all siblings at once", inputCount === 4, `inputs: ${inputCount}`);

  // ---- AC2: per-kitten chart + trend matches hand calc ----
  const okkieHref = await kittenIdByName("Okkie");
  await page.goto(`${BASE}${okkieHref}`);
  const hasChart = (await page.locator("svg.recharts-surface").count()) > 0;
  check("AC2: per-kitten growth chart renders", hasChart);
  const okkieBody = await page.textContent("body");
  // 180 -> 200 across ~44h ≈ 10.9 g/day, trending up. Allow a small band for
  // the few minutes that elapse between seeding and the test run.
  const gd = okkieBody.match(/↑ ([\d.]+) g\/day/);
  const gdVal = gd ? Number(gd[1]) : NaN;
  check(
    "AC2: trend arrow ↑ with g/day matching hand calc (~10.9)",
    gd !== null && gdVal >= 10 && gdVal <= 12,
    gd?.[0] ?? "none",
  );

  // ---- AC3: litter overview chart + % toggle + laggard ----
  await page.goto(`${BASE}${eenHref}`);
  await page.click("a:has-text('Compare with littermates')");
  await page.waitForURL(/\/litters\/\d+$/);
  await page.waitForSelector("svg.recharts-surface");
  for (const n of ["Een", "Twee", "Drie", "Vier"]) {
    const inLegend = (await page.locator(`.recharts-legend-item:has-text("${n}")`).count()) > 0;
    check(`AC3: litter chart legend includes ${n}`, inLegend);
  }
  await page.click("button:has-text('% gain from birth')");
  await page.waitForTimeout(300);
  check("AC3: %-gain toggle works", (await page.locator("svg.recharts-surface").count()) > 0);

  // ---- AC4: alert states classify correctly ----
  await page.goto(`${BASE}/alerts`);
  const alertsBody = await page.textContent("body");
  check("AC4: Bram (loss) urgent in center", /Bram/.test(alertsBody));
  check("AC4: Fleur (no-gain) urgent in center", /Fleur/.test(alertsBody));
  check("AC4: Pip (warning) in center", /Pip/.test(alertsBody));
  check("AC4: Okkie (ok) not in center", !/Okkie/.test(alertsBody));
  check("AC4: Stip (insufficient) not in center", !/Stip/.test(alertsBody));
  // urgent sorted before warning
  const order = ["Bram", "Fleur", "Pip"].map((n) => alertsBody.indexOf(n));
  check(
    "AC4: urgent sorted before warning",
    Math.max(order[0], order[1]) < order[2],
    order.join(","),
  );

  // per-detail banner level
  await page.goto(`${BASE}${await kittenIdByName("Bram")}`);
  check(
    "AC4: Bram detail shows Urgent banner",
    (await page.textContent("body")).includes("Urgent"),
  );

  // ---- AC6: hints only for warning/urgent, with escalation line ----
  const hintsText = "What to check";
  const escalate = "contact the shelter or a vet";
  await page.goto(`${BASE}${await kittenIdByName("Pip")}`);
  let body = await page.textContent("body");
  check(
    "AC6: warning shows hints + escalation",
    body.includes(hintsText) && body.includes(escalate),
  );
  await page.goto(`${BASE}${await kittenIdByName("Bram")}`);
  body = await page.textContent("body");
  check(
    "AC6: urgent shows hints + escalation-now",
    body.includes(hintsText) && body.includes("Escalate now"),
  );
  await page.goto(`${BASE}${okkieHref}`);
  check("AC6: ok kitten has no hints panel", !(await page.textContent("body")).includes(hintsText));

  // ---- AC7: insufficient state, no crash ----
  await page.goto(`${BASE}${await kittenIdByName("Stip")}`);
  body = await page.textContent("body");
  check(
    "AC7: insufficient banner shown",
    body.includes("Need data") || body.includes("Less than 24h") || body.includes("Fewer than two"),
  );
  check("AC7: chart shows need-more-data message", body.includes("Need at least two weighings"));

  // ---- AC8: adopted & deceased excluded from alerts ----
  await page.goto(`${BASE}/alerts`);
  body = await page.textContent("body");
  check("AC8: adopted kitten excluded from alert center", !body.includes("Weg"));
  check("AC8: deceased kitten excluded from alert center", !body.includes("Mortje"));
  await page.goto(`${BASE}${await kittenIdByName("Weg")}`);
  check(
    "AC8: adopted kitten detail has no alert banner/hints",
    !(await page.textContent("body")).includes(hintsText),
  );

  // ---- AC9: charts usable at 390px (no horizontal overflow) ----
  for (const path of [okkieHref, "/alerts", "/settings"]) {
    await page.goto(`${BASE}${path}`);
    check(`AC9: no horizontal overflow at 390px on ${path}`, await noOverflow(page));
  }
  // litter chart page overflow
  await page.goto(`${BASE}${eenHref}`);
  await page.click("a:has-text('Compare with littermates')");
  await page.waitForURL(/\/litters\/\d+$/);
  check("AC9: litter chart page no overflow at 390px", await noOverflow(page));

  // ---- AC5: editing a threshold re-evaluates on next load ----
  await page.goto(`${BASE}/settings`);
  await page.fill("#targetDailyGainG", "20"); // floor must stay <= target
  await page.fill("#minDailyGainG", "15");
  await page.click("button:has-text('Save thresholds')");
  await page.waitForTimeout(500);
  await page.goto(`${BASE}/alerts`);
  body = await page.textContent("body");
  check("AC5: raising floor to 15 flags Okkie (was ok at ~10.9 g/day)", body.includes("Okkie"));
  // reset
  await page.goto(`${BASE}/settings`);
  await page.click("button:has-text('Reset to defaults')");
  await page.waitForTimeout(500);
  await page.goto(`${BASE}/alerts`);
  check(
    "AC5: reset restores defaults (Okkie no longer flagged)",
    !(await page.textContent("body")).includes("Okkie"),
  );

  // ---- viewer role can read alerts/charts ----
  const vctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const vpage = await vctx.newPage();
  await login(vpage, "viewer", "viewer-test-pass-99");
  await vpage.goto(`${BASE}/alerts`);
  check("viewer can see alert center", (await vpage.textContent("body")).includes("Alert center"));
  await vctx.close();
} catch (err) {
  check("script completed", false, String(err).split("\n")[0]);
  await page.screenshot({ path: "/tmp/kitten_e2e3_failure.png", fullPage: true }).catch(() => {});
}

await browser.close();
console.log(results.join("\n"));
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
