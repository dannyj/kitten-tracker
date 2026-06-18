import "server-only";

import PDFDocument from "pdfkit";
import { formatDate } from "@/lib/dates";
import { buildChartGeometry, type ChartGeometry } from "@/lib/export-chart";
import type { ExportVaccination, KittenExport, MotherExport } from "@/lib/export-data";

const HEALTH_CATEGORY_LABELS: Record<string, string> = {
  eating: "Eating",
  behaviour: "Behaviour",
  medical: "Medical",
  other: "Other",
};

// Standard Helvetica only (WinAnsi covers accents like ë/ï); never emoji — they
// fail in standard PDF fonts. Every value is drawn via .text() as plain text,
// so user input is never interpreted as markup.

export type ExportMeta = { generatedAtIso: string; fosterName: string; includesAdopter: boolean };

/** Draw the growth chart with pdfkit vector primitives at the current cursor. */
function drawGrowthChart(doc: PDFKit.PDFDocument, g: ChartGeometry) {
  const ox = doc.page.margins.left;
  const oy = doc.y;

  // Expected-growth band.
  if (g.band && g.band.length > 0) {
    doc.save().fillColor("#16a34a").fillOpacity(0.12);
    doc.moveTo(ox + g.band[0].x, oy + g.band[0].y);
    for (const p of g.band.slice(1)) doc.lineTo(ox + p.x, oy + p.y);
    doc.closePath().fill();
    doc.restore();
  }

  // Y gridlines + labels.
  doc.font("Helvetica").fontSize(8).fillColor("#666");
  for (const t of g.yTicks) {
    doc
      .save()
      .strokeColor("#eeeeee")
      .lineWidth(1)
      .moveTo(ox + g.area.x, oy + t.y)
      .lineTo(ox + g.area.x + g.area.w, oy + t.y)
      .stroke()
      .restore();
    doc.text(t.label, ox + g.area.x - 34, oy + t.y - 4, { width: 30, align: "right" });
  }

  // Axes.
  doc
    .save()
    .strokeColor("#999999")
    .lineWidth(1)
    .moveTo(ox + g.area.x, oy + g.area.y)
    .lineTo(ox + g.area.x, oy + g.area.y + g.area.h)
    .lineTo(ox + g.area.x + g.area.w, oy + g.area.y + g.area.h)
    .stroke()
    .restore();

  // Weight line + points.
  doc.save().strokeColor("#2563eb").lineWidth(2);
  doc.moveTo(ox + g.line[0].x, oy + g.line[0].y);
  for (const p of g.line.slice(1)) doc.lineTo(ox + p.x, oy + p.y);
  doc.stroke().restore();
  doc.save().fillColor("#2563eb");
  for (const p of g.line) doc.circle(ox + p.x, oy + p.y, 2).fill();
  doc.restore();

  // X tick labels.
  doc.font("Helvetica").fontSize(8).fillColor("#666");
  for (const t of g.xTicks) {
    doc.text(t.label, ox + t.x - 15, oy + g.height - 10, { width: 30, align: "center" });
  }

  doc.fillColor("#000");
  doc.x = ox;
  doc.y = oy + g.height + 6;
}

function weightTableRow(doc: PDFKit.PDFDocument, date: string, weight: string, note: string) {
  // Explicit-coordinate columns don't advance the cursor on their own (and an
  // empty cell advances nothing), so we lay out each row at a fixed y and step
  // down by a measured row height ourselves.
  if (doc.y > doc.page.height - doc.page.margins.bottom - 24) doc.addPage();
  const ox = doc.page.margins.left;
  const y = doc.y;
  const rowH = Math.max(13, doc.heightOfString(note || " ", { width: 320 }));
  doc.text(date, ox, y, { width: 90, lineBreak: false });
  doc.text(weight, ox + 95, y, { width: 60, lineBreak: false });
  doc.text(note, ox + 160, y, { width: 320 });
  doc.x = ox;
  doc.y = y + rowH;
}

function header(doc: PDFKit.PDFDocument, title: string, meta: ExportMeta) {
  doc.font("Helvetica-Bold").fontSize(18).text(title);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#555")
    .text(
      `Generated ${formatDate(meta.generatedAtIso)} by ${meta.fosterName} · Kitten Foster Tracker`,
    );
  doc.fillColor("#000").moveDown(0.5);
}

function labelValue(doc: PDFKit.PDFDocument, label: string, value: string) {
  doc.font("Helvetica-Bold").fontSize(10).text(`${label}: `, { continued: true });
  doc.font("Helvetica").text(value || "—");
}

/** Shared medical-history block used by both kitten and mother sections. */
function medicalHistory(doc: PDFKit.PDFDocument, title: string, items: ExportVaccination[]) {
  doc.moveDown(0.4).font("Helvetica-Bold").fontSize(11).text(title);
  if (items.length === 0) {
    doc.font("Helvetica").fontSize(10).text("No entries recorded.");
    return;
  }
  for (const v of items) {
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(`${formatDate(v.givenAtIso)} — ${v.type}`);
    const parts: string[] = [];
    if (v.batchNumber) parts.push(`batch ${v.batchNumber}`);
    if (v.administeredBy) parts.push(`by ${v.administeredBy}`);
    if (v.nextDueDateIso) parts.push(`next due ${formatDate(v.nextDueDateIso)}`);
    if (v.correctsOfDateIso) parts.push(`corrects entry of ${formatDate(v.correctsOfDateIso)}`);
    if (parts.length > 0)
      doc.font("Helvetica").fontSize(9).fillColor("#555").text(parts.join(" · "));
    if (v.note) doc.font("Helvetica").fontSize(9).fillColor("#555").text(v.note);
    doc.fillColor("#000");
  }
}

function kittenSection(doc: PDFKit.PDFDocument, k: KittenExport, meta: ExportMeta) {
  doc.font("Helvetica-Bold").fontSize(14).text(k.name);
  doc.moveDown(0.2);

  labelValue(doc, "Shelter number", k.shelterNumber ?? "—");
  labelValue(doc, "Sex", k.sex);
  labelValue(
    doc,
    "Birth date",
    k.birthDateIso
      ? `${formatDate(k.birthDateIso)}${k.birthDateEstimated ? " (estimated)" : ""}`
      : "—",
  );
  labelValue(doc, "Current age", k.ageText ?? "—");
  labelValue(doc, "Status", k.statusLabel);

  // Growth summary
  doc.moveDown(0.4).font("Helvetica-Bold").fontSize(11).text("Growth");
  if (k.growth) {
    const g = k.growth;
    labelValue(
      doc,
      "Weight",
      // ASCII "->" only: the arrow glyph (U+2192) isn't in the standard PDF font.
      `${g.birthWeightG} g (${formatDate(g.birthWeighedAtIso)}) -> ${g.latestWeightG} g (${formatDate(g.latestWeighedAtIso)})`,
    );
    labelValue(doc, "Average gain", g.avgGainPerDay !== null ? `${g.avgGainPerDay} g/day` : "—");
  } else {
    doc.font("Helvetica").fontSize(10).text("No weights recorded.");
  }

  // Growth chart (vector — no browser, no image rasterisation) + weight table.
  const geometry = buildChartGeometry(k.growthSeries, 480, 180);
  if (geometry) {
    doc.moveDown(0.3);
    drawGrowthChart(doc, geometry);
  }
  if (k.weights.length > 0) {
    doc.moveDown(0.4).font("Helvetica-Bold").fontSize(11).text("Weight history");
    doc.font("Helvetica-Bold").fontSize(9);
    weightTableRow(doc, "Date", "Weight", "Note");
    doc.font("Helvetica").fontSize(9);
    for (const w of k.weights) {
      weightTableRow(doc, formatDate(w.dateIso), `${w.grams} g`, w.note ?? "");
    }
  }

  // Vaccination / medical history
  medicalHistory(doc, "Vaccination & medical history", k.vaccinations);

  // Adopter (only present when explicitly included; admin-gated at the route)
  if (meta.includesAdopter && k.adopter) {
    doc.moveDown(0.4).font("Helvetica-Bold").fontSize(11).text("Adopter (included on request)");
    labelValue(doc, "Name", k.adopter.name);
    labelValue(doc, "Phone", k.adopter.phone ?? "—");
    labelValue(doc, "Email", k.adopter.email ?? "—");
    labelValue(doc, "Address", k.adopter.address ?? "—");
    if (k.adopter.adoptionDateIso)
      labelValue(doc, "Adoption date", formatDate(k.adopter.adoptionDateIso));
    if (k.adopter.shelterReference)
      labelValue(doc, "Shelter reference", k.adopter.shelterReference);
  }
}

function motherSection(doc: PDFKit.PDFDocument, m: MotherExport) {
  doc.font("Helvetica-Bold").fontSize(14).text(`${m.name} (mother)`);
  doc.moveDown(0.2);

  labelValue(doc, "Shelter number", m.shelterNumber ?? "—");
  labelValue(doc, "Intake date", m.intakeDateIso ? formatDate(m.intakeDateIso) : "—");
  labelValue(doc, "Status", m.statusLabel);

  medicalHistory(doc, "Medical history", m.vaccinations);

  doc.moveDown(0.4).font("Helvetica-Bold").fontSize(11).text("Health-log notes");
  if (m.healthNotes.length === 0) {
    doc.font("Helvetica").fontSize(10).text("No notes recorded.");
  } else {
    for (const n of m.healthNotes) {
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#555")
        .text(`${formatDate(n.dateIso)} (${HEALTH_CATEGORY_LABELS[n.category] ?? n.category}): ${n.entry}`);
      doc.fillColor("#000");
    }
  }
}

function footerNote(doc: PDFKit.PDFDocument) {
  doc
    .moveDown(0.8)
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#777")
    .text(
      "Record-keeping summary generated from live foster data. Schedule suggestions are general guidance, not a veterinary protocol — the shelter's and vet's records take precedence.",
    );
  doc.fillColor("#000");
}

function render(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

export function kittenPdf(k: KittenExport, meta: ExportMeta): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  header(doc, `Medical summary — ${k.name}`, meta);
  kittenSection(doc, k, meta);
  footerNote(doc);
  return render(doc);
}

export function motherPdf(m: MotherExport, meta: ExportMeta): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  header(doc, `Medical summary — ${m.name}`, meta);
  motherSection(doc, m);
  footerNote(doc);
  return render(doc);
}

export function litterPdf(
  title: string,
  mother: MotherExport | null,
  kittenList: KittenExport[],
  meta: ExportMeta,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  header(doc, `Medical summary — ${title}`, meta);
  // Mother first (her own section), then one page per kitten.
  if (mother) motherSection(doc, mother);
  kittenList.forEach((k, i) => {
    if (mother || i > 0) doc.addPage();
    kittenSection(doc, k, meta);
  });
  if (kittenList.length === 0)
    doc.font("Helvetica").fontSize(10).text("No kittens in this litter.");
  footerNote(doc);
  return render(doc);
}
