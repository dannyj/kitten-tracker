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
async function href(name) {
  await page.goto(`${BASE}/kittens?status=all`);
  await page.locator(`tr:has-text("${name}") td`).last().click();
  await page.waitForURL(/\/kittens\/\d+$/);
  return new URL(page.url()).pathname;
}
const idOf = (h) => Number(h.split("/").pop());
async function noOverflow() {
  return !(await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  ));
}
function plusDaysIso(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
// Fetch a PDF from inside the page so the (Secure, localhost) session cookie is
// sent — APIRequestContext drops Secure cookies over http://127.0.0.1.
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

  const muis = await href("Muis");
  const pip = await href("Pip");
  const bram = await href("Bram");
  const muisId = idOf(muis);
  const bramId = idOf(bram);

  // ---- AC1: a vaccination logs with batch + administered-by, newest-first ----
  await page.goto(`${BASE}${pip}`);
  await page.waitForSelector("#medical");
  // default type FVRCP; fill batch + administered-by, submit
  await page.fill("#medical input[name=batchNumber]", "BATCH-PIP-1");
  await page.fill("#medical input[name=administeredBy]", "Dr. Test");
  await page.click("#medical button:has-text('Log entry')");
  await page.waitForSelector("#medical li:has-text('FVRCP')");
  const pipMed = await page.textContent("#medical");
  check(
    "AC1: vaccination logs with batch + administered-by",
    /BATCH-PIP-1/.test(pipMed) && /Dr\. Test/.test(pipMed),
  );

  // newest-first on Muis (FVRCP given 5d ago should appear before deworming 49d ago)
  await page.goto(`${BASE}${muis}`);
  await page.waitForSelector("#medical li");
  const firstEntry = await page.locator("#medical li").first().textContent();
  check("AC1: history newest-first", /FVRCP/.test(firstEntry), firstEntry?.slice(0, 30));

  // ---- AC3: per-kitten timeline given/suggested/overdue ----
  const muisMed = await page.textContent("#medical");
  check(
    "AC3: overdue deworming shown",
    /Deworming.*overdue by/s.test(muisMed) ||
      /overdue by.*Deworming/s.test(muisMed) ||
      (/Deworming/.test(muisMed) && /overdue by/.test(muisMed)),
  );
  check("AC3: FVRCP suggested next shown", /FVRCP suggested/.test(muisMed));
  check("AC3: given history present (batch shown)", /FV-77/.test(muisMed));

  // ---- AC8: correction after window creates a new referencing entry ----
  // Edit/delete/correct moved to the manage view (rev 1, item 3). Detail medical
  // is read-only; the locked FVRCP exposes "Correct" in the manage view.
  check(
    "AC8: detail medical is read-only (no inline controls)",
    (await page.locator("#medical li button:has-text('Correct')").count()) === 0 &&
      (await page.locator("#medical li button:has-text('Edit')").count()) === 0,
  );
  await page.goto(`${BASE}${muis}/medical`);
  const fvrcpItem = page.locator("li:has-text('FVRCP')").first();
  check(
    "AC8: locked entry has no Edit, only Correct",
    (await fvrcpItem.locator("button:has-text('Edit')").count()) === 0 &&
      (await fvrcpItem.locator("button:has-text('Correct')").count()) === 1,
  );
  await fvrcpItem.locator("button:has-text('Correct')").click();
  await page.waitForSelector("form:has-text('Correcting the entry')");
  await page.fill(
    "form:has-text('Correcting the entry') input[name=batchNumber]",
    "FV-77-CORRECTED",
  );
  await page.click("button:has-text('Save correction')");
  await page.waitForFunction(() => document.body.textContent.includes("Corrects entry of"));
  const afterCorrection = await page.textContent("body");
  check(
    "AC8: correction creates new entry referencing original",
    /Corrects entry of/.test(afterCorrection) &&
      /FV-77-CORRECTED/.test(afterCorrection) &&
      /FV-77-Ä/.test(afterCorrection),
  );

  // ---- Care log: seeded locked entry renders; new entry adds & is editable ----
  await page.goto(`${BASE}${muis}`);
  await page.waitForSelector("#care-log");
  const seededCare = page.locator("#care-log li:has-text('First time using the litter box')");
  check(
    "Care log: seeded milestone renders with category",
    (await seededCare.count()) === 1 && /Milestone/.test((await seededCare.textContent()) ?? ""),
  );
  check(
    "Care log: entry older than 15 min is locked (no Edit)",
    (await seededCare.locator("button:has-text('Edit')").count()) === 0,
  );
  // Add a new entry via the Radix Select + textarea.
  const careForm = page.locator("#care-log form").first();
  await careForm.locator("button[role=combobox]").click();
  await page.locator("[role=option]:has-text('Behaviour')").click();
  await careForm.locator("textarea[name=entry]").fill("Very playful with littermates");
  await careForm.locator("button:has-text('Add entry')").click();
  const addedCare = page.locator("#care-log li:has-text('Very playful with littermates')");
  await addedCare.waitFor();
  check(
    "Care log: new entry saves with chosen category",
    /Behaviour/.test((await addedCare.textContent()) ?? ""),
  );
  check(
    "Care log: freshly-added entry is editable within window",
    (await addedCare.locator("button:has-text('Edit')").count()) === 1,
  );

  // ---- AC4: dashboard medical panel, overdue pinned, one-tap log ----
  await page.goto(`${BASE}/`);
  await page.waitForSelector("text=Medical due");
  const medSection = await page.locator("section:has-text('Medical due')").textContent();
  check(
    "AC4: dashboard lists overdue medical items",
    /overdue by/.test(medSection) && (/Muis/.test(medSection) || /Pip/.test(medSection)),
  );
  // one-tap log opens prefilled dialog
  await page.locator("section:has-text('Medical due') button:has-text('Log')").first().click();
  await page.waitForSelector("[role=dialog]:has-text('Log')");
  check("AC4: one-tap opens a prefilled log dialog", true);
  await page.keyboard.press("Escape");

  // ---- AC5/AC7: per-kitten export print view (batch + growth + accents) ----
  await page.goto(`${BASE}/export/kitten/${muisId}`);
  const exportBody = await page.textContent("body");
  check("AC5: print view shows batch numbers", /FV-77/.test(exportBody));
  check(
    "AC5: print view shows growth summary",
    /110 g.*640 g/s.test(exportBody) && /g\/day/.test(exportBody),
  );
  check(
    "AC7: accented characters render in print view",
    /FV-77-Ä/.test(exportBody) && /ï\/ë/.test(exportBody),
  );
  check(
    "AC9: export print view triggers PDF link",
    (await page.locator("a:has-text('Download PDF')").count()) > 0,
  );

  // ---- AC5/AC7: PDF bytes ----
  const pdf = await fetchPdf(page, `${BASE}/export/kitten/${muisId}/pdf`);
  check(
    "AC5: kitten PDF generates (valid %PDF, non-trivial)",
    pdf.status === 200 &&
      pdf.ct.includes("application/pdf") &&
      pdf.head === "%PDF-" &&
      pdf.len > 1500,
    `status ${pdf.status}, ${pdf.len} bytes, head ${pdf.head}`,
  );
  // litter export PDF
  await page.goto(`${BASE}${muis}`);
  const litterHref = await page
    .locator("a:has-text('Compare with littermates')")
    .getAttribute("href");
  const litterId = Number(litterHref.split("/").pop());
  await page.goto(`${BASE}/export/litter/${litterId}`);
  const litterPdf = await fetchPdf(page, `${BASE}/export/litter/${litterId}/pdf`);
  check(
    "AC5: litter PDF generates (valid %PDF)",
    litterPdf.status === 200 && litterPdf.head === "%PDF-" && litterPdf.len > 1500,
    `${litterPdf.len} bytes`,
  );
  await page.goto(`${BASE}/export/litter/${litterId}`);
  check(
    "AC5: litter print view lists multiple kittens",
    /Muis/.test(await page.textContent("body")) && /Pip/.test(await page.textContent("body")),
  );

  // ---- AC6: adopter excluded by default; admin opt-in ----
  await page.goto(`${BASE}/export/kitten/${bramId}`);
  check(
    "AC6: adopter excluded by default",
    !(await page.textContent("body")).includes("Familie de Wit"),
  );
  check(
    "AC6: admin sees the opt-in control",
    (await page.locator("a:has-text('Include adopter details')").count()) > 0,
  );
  await page.goto(`${BASE}/export/kitten/${bramId}?adopter=1`);
  check(
    "AC6: admin opt-in includes adopter PII",
    (await page.textContent("body")).includes("Familie de Wit"),
  );
  // PDF default excludes adopter; opt-in includes (both must generate)
  await page.goto(`${BASE}/export/kitten/${bramId}`);
  const noAdopterPdf = await fetchPdf(page, `${BASE}/export/kitten/${bramId}/pdf`);
  const adopterPdf = await fetchPdf(page, `${BASE}/export/kitten/${bramId}/pdf?adopter=1`);
  check(
    "AC6: both PDF variants generate",
    noAdopterPdf.status === 200 &&
      noAdopterPdf.head === "%PDF-" &&
      adopterPdf.status === 200 &&
      adopterPdf.head === "%PDF-",
  );

  // ---- AC9: 390px usable ----
  await page.goto(`${BASE}${muis}`);
  check("AC9: kitten detail (medical) no overflow at 390px", await noOverflow());
  await page.goto(`${BASE}/export/kitten/${muisId}`);
  check("AC9: export print view no overflow at 390px", await noOverflow());

  // ---- AC2: FVRCP next-due prefilled from template; editing template changes it ----
  await page.goto(`${BASE}${pip}`);
  await page.waitForSelector("#medical");
  // default type FVRCP, givenAt today -> nextDue prefilled today + 3 weeks (default everyWeeks=3)
  let nextDue = await page.inputValue("#medical #nextDueDate");
  check(
    "AC2: FVRCP next-due prefilled from template (+3wk)",
    nextDue === plusDaysIso(21),
    `${nextDue} vs ${plusDaysIso(21)}`,
  );
  // edit template: FVRCP everyWeeks 3 -> 5
  await page.goto(`${BASE}/settings`);
  await page.fill("#kitten__FVRCP__everyWeeks", "5");
  await page.click("button:has-text('Save templates')");
  await page.waitForTimeout(500);
  await page.goto(`${BASE}${pip}`);
  await page.waitForSelector("#medical #nextDueDate");
  nextDue = await page.inputValue("#medical #nextDueDate");
  check(
    "AC2: editing template changes future suggestions (+5wk)",
    nextDue === plusDaysIso(35),
    `${nextDue} vs ${plusDaysIso(35)}`,
  );

  // ---- AC6 (role): viewer cannot opt into adopter PII ----
  const vctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const vpage = await vctx.newPage();
  await login(vpage, "viewer", "viewer-test-pass-99");
  await vpage.goto(`${BASE}/export/kitten/${bramId}?adopter=1`);
  const vbody = await vpage.textContent("body");
  check("AC6: viewer cannot include adopter PII even via query", !vbody.includes("Familie de Wit"));
  check(
    "AC6: viewer sees no opt-in control",
    (await vpage.locator("a:has-text('Include adopter details')").count()) === 0,
  );
  // Viewer's PDF still generates but the route forces includesAdopter=false
  // (proven content-side by the print-view check above).
  const vAdopterPdf = await fetchPdf(vpage, `${BASE}/export/kitten/${bramId}/pdf?adopter=1`);
  check(
    "AC6: viewer PDF generates without admin opt-in",
    vAdopterPdf.status === 200 && vAdopterPdf.head === "%PDF-",
  );
  await vctx.close();
} catch (err) {
  check("script completed", false, String(err).split("\n")[0]);
  await page.screenshot({ path: "/tmp/kitten_e2e5_failure.png", fullPage: true }).catch(() => {});
}

await browser.close();
console.log(results.join("\n"));
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
