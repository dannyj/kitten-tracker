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
async function motherHref(name) {
  await page.goto(`${BASE}/mothers`);
  await page.locator(`a:has-text("${name}")`).first().click();
  await page.waitForURL(/\/mothers\/\d+$/);
  return new URL(page.url()).pathname;
}
const idOf = (h) => Number(h.split("/").pop());
async function noOverflow() {
  return !(await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  ));
}
function fetchPdf(p, url) {
  return p.evaluate(async (u) => {
    const r = await fetch(u);
    const b = new Uint8Array(await r.arrayBuffer());
    let head = "";
    for (let i = 0; i < 5 && i < b.length; i++) head += String.fromCharCode(b[i]);
    return { status: r.status, ct: r.headers.get("content-type") || "", len: b.length, head };
  }, url);
}

try {
  await login(page, "danny", "local-test-password-123");

  const luna = await motherHref("Luna");
  const lunaId = idOf(luna);

  // ---- AC2: mother has structured medical section, newest-first ----
  await page.goto(`${BASE}${luna}`);
  await page.waitForSelector("#medical");
  const medical = page.locator("#medical");
  const medText = await medical.textContent();
  check(
    "AC2: structured medical records present (microchip/deworming/FVRCP)",
    /microchip/.test(medText) && /deworming/.test(medText) && /FVRCP/.test(medText),
  );
  const firstEntry = await medical.locator("li").first().textContent();
  check("AC2: history newest-first (FVRCP newest)", /FVRCP/.test(firstEntry), firstEntry?.slice(0, 40));
  check("AC2: chip/batch numbers shown", /CHIP-528140004012345/.test(medText));

  // ---- AC2: log a new mother treatment via quick-add ----
  // The type control is a Radix Select (button), not a native <select>.
  await medical.locator("button[role=combobox]").click();
  await page.locator("[role=option]:has-text('flea treatment')").click();
  await page.fill("#medical input[name=batchNumber]", "FLEA-AD-1");
  await page.fill("#medical input[name=administeredBy]", "self");
  await page.click("#medical button:has-text('Log entry')");
  await page.waitForSelector("#medical li:has-text('flea treatment')");
  check(
    "AC2: new mother treatment logs with batch + administered-by",
    /FLEA-AD-1/.test(await medical.textContent()),
  );

  // ---- AC3: one-off microchip never shows as due; periodic do ----
  // Due/suggested banners live at the top of the card (overdue/upcoming).
  check("AC3: deworming shown overdue", /Deworming.*overdue by|overdue by.*Deworming/s.test(medText));
  check("AC3: FVRCP suggested upcoming", /FVRCP suggested/.test(medText));
  check(
    "AC3: microchip never appears as 'due'/'suggested'",
    !/Microchip suggested/i.test(medText) && !/Microchip.*overdue/i.test(medText),
  );

  // ---- AC5: free-text health log still works and is distinct ----
  const body = await page.textContent("body");
  check(
    "AC5: health log present & distinct from medical records",
    /Health log/.test(body) &&
      /Eet goed en zoogt/.test(body) &&
      (await page.locator("#medical").count()) === 1,
  );

  // ---- AC6: dashboard medical-due lists the mother, clearly labelled ----
  await page.goto(`${BASE}/`);
  await page.waitForSelector("text=Medical due");
  const medSection = await page.locator("section:has-text('Medical due')").textContent();
  check(
    "AC6: dashboard shows mother medical item",
    /Luna/.test(medSection) && (/overdue by/.test(medSection) || /due /.test(medSection)),
  );
  check("AC6: mother item labelled 'Mother'", /Mother/.test(medSection));
  // one-tap log opens a prefilled dialog for the mother. Target Luna's row: the
  // div holding both her link and a Log button (deepest such div = the row).
  const lunaRow = page
    .locator("section:has-text('Medical due') div")
    .filter({ has: page.locator(`a[href="${luna}"]`) })
    .filter({ has: page.getByRole("button", { name: "Log" }) })
    .last();
  await lunaRow.getByRole("button", { name: "Log" }).click();
  await page.waitForSelector("[role=dialog]:has-text('Luna')");
  check("AC6: one-tap opens a prefilled mother log dialog", true);
  await page.keyboard.press("Escape");

  // ---- AC8: manage view honours edit window; correction references original ----
  await page.goto(`${BASE}${luna}/medical`);
  const fvrcpItem = page.locator("li:has-text('FVRCP')").first();
  check(
    "AC8: locked entry has no Edit, only Correct",
    (await fvrcpItem.locator("button:has-text('Edit')").count()) === 0 &&
      (await fvrcpItem.locator("button:has-text('Correct')").count()) === 1,
  );
  await fvrcpItem.locator("button:has-text('Correct')").click();
  await page.waitForSelector("form:has-text('Correcting the entry')");
  await page.fill("form:has-text('Correcting the entry') input[name=batchNumber]", "FV-AD-9-FIXED");
  await page.click("button:has-text('Save correction')");
  await page.waitForFunction(() => document.body.textContent.includes("Corrects entry of"));
  const afterCorrection = await page.textContent("body");
  check(
    "AC8: correction creates new entry referencing original",
    /Corrects entry of/.test(afterCorrection) &&
      /FV-AD-9-FIXED/.test(afterCorrection) &&
      /FV-AD-9/.test(afterCorrection),
  );

  // ---- AC7: per-mother export (medical + health notes, no growth chart) ----
  await page.goto(`${BASE}/export/mother/${lunaId}`);
  const exportBody = await page.textContent("body");
  check("AC7: mother export shows medical history", /CHIP-528140004012345/.test(exportBody));
  check("AC7: mother export shows health-log notes", /Eet goed en zoogt/.test(exportBody));
  check("AC7: accents render in mother export", /ë\/ï/.test(exportBody));
  check("AC7: mother export has no growth chart", !/Growth/.test(exportBody) && !/g\/day/.test(exportBody));
  const mPdf = await fetchPdf(page, `${BASE}/export/mother/${lunaId}/pdf`);
  check(
    "AC7: mother PDF generates (valid %PDF, non-trivial)",
    mPdf.status === 200 && mPdf.ct.includes("application/pdf") && mPdf.head === "%PDF-" && mPdf.len > 1500,
    `status ${mPdf.status}, ${mPdf.len} bytes`,
  );

  // ---- AC7: per-litter export includes the mother's own section ----
  await page.goto(`${BASE}${luna}`);
  await page.locator("a:has-text('Saar')").first().click();
  await page.waitForURL(/\/kittens\/\d+$/);
  const litterHref = await page
    .locator("a:has-text('Compare with littermates')")
    .getAttribute("href");
  const litterId = Number(litterHref.split("/").pop());
  await page.goto(`${BASE}/export/litter/${litterId}`);
  const litBody = await page.textContent("body");
  check(
    "AC7: litter export includes mother section + kitten",
    /Luna \(mother\)/.test(litBody) && /CHIP-528140004012345/.test(litBody) && /Saar/.test(litBody),
  );
  const litPdf = await fetchPdf(page, `${BASE}/export/litter/${litterId}/pdf`);
  check(
    "AC7: litter PDF (with mother) generates",
    litPdf.status === 200 && litPdf.head === "%PDF-" && litPdf.len > 1500,
    `${litPdf.len} bytes`,
  );

  // ---- AC9: unknown mother -> 404 ----
  const resp = await page.goto(`${BASE}/mothers/999999`);
  check("AC9: unknown mother 404s", resp.status() === 404, `status ${resp.status()}`);

  // ---- AC10/responsive: no overflow at 390px ----
  await page.goto(`${BASE}${luna}`);
  check("responsive: mother detail no overflow at 390px", await noOverflow());
  await page.goto(`${BASE}/export/mother/${lunaId}`);
  check("responsive: mother export no overflow at 390px", await noOverflow());
} catch (err) {
  check("script completed", false, String(err).split("\n")[0]);
  await page.screenshot({ path: "/tmp/kitten_e2e_rev3_failure.png", fullPage: true }).catch(() => {});
}

await browser.close();
console.log(results.join("\n"));
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
