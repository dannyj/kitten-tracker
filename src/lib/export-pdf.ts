import "server-only";

import PDFDocument from "pdfkit";
import { formatDate } from "@/lib/dates";
import type { KittenExport } from "@/lib/export-data";

// Standard Helvetica only (WinAnsi covers accents like ë/ï); never emoji — they
// fail in standard PDF fonts. Every value is drawn via .text() as plain text,
// so user input is never interpreted as markup.

export type ExportMeta = { generatedAtIso: string; fosterName: string; includesAdopter: boolean };

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

  // Vaccination / medical history
  doc.moveDown(0.4).font("Helvetica-Bold").fontSize(11).text("Vaccination & medical history");
  if (k.vaccinations.length === 0) {
    doc.font("Helvetica").fontSize(10).text("No entries recorded.");
  } else {
    for (const v of k.vaccinations) {
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

export function litterPdf(
  title: string,
  kittenList: KittenExport[],
  meta: ExportMeta,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  header(doc, `Medical summary — ${title}`, meta);
  kittenList.forEach((k, i) => {
    if (i > 0) doc.addPage();
    kittenSection(doc, k, meta);
  });
  if (kittenList.length === 0)
    doc.font("Helvetica").fontSize(10).text("No kittens in this litter.");
  footerNote(doc);
  return render(doc);
}
