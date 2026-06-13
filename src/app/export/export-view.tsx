import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";
import type { KittenExport } from "@/lib/export-data";
import { PrintButton } from "./print-button";

export function ExportHeader({
  title,
  generatedAtIso,
  fosterName,
  isAdmin,
  includesAdopter,
  selfHref,
  pdfHref,
}: {
  title: string;
  generatedAtIso: string;
  fosterName: string;
  isAdmin: boolean;
  includesAdopter: boolean;
  selfHref: string;
  pdfHref: string;
}) {
  const adopterQuery = includesAdopter ? "?adopter=1" : "";
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground text-sm">
          Generated {formatDate(generatedAtIso)} by {fosterName} · Kitten Foster Tracker
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <PrintButton />
        <Button asChild size="sm" variant="outline">
          <a href={`${pdfHref}${adopterQuery}`}>Download PDF</a>
        </Button>
        {isAdmin ? (
          includesAdopter ? (
            <Link
              href={selfHref}
              className="text-muted-foreground text-sm underline underline-offset-2"
            >
              Remove adopter details
            </Link>
          ) : (
            <Link
              href={`${selfHref}?adopter=1`}
              className="text-muted-foreground text-sm underline underline-offset-2"
            >
              Include adopter details
            </Link>
          )
        ) : null}
      </div>
      {includesAdopter ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 print:border-0 print:bg-transparent print:p-0">
          This export includes adopter contact details (PII).
        </p>
      ) : null}
    </div>
  );
}

/** Presentational, print-friendly rendering of one kitten's medical summary. */
export function KittenSummary({
  k,
  includesAdopter,
}: {
  k: KittenExport;
  includesAdopter: boolean;
}) {
  return (
    <section className="flex flex-col gap-3 break-inside-avoid border-t pt-4 first:border-t-0 first:pt-0">
      <h2 className="text-xl font-semibold">{k.name}</h2>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <Field label="Shelter number" value={k.shelterNumber ?? "—"} />
        <Field label="Sex" value={k.sex} />
        <Field
          label="Birth date"
          value={
            k.birthDateIso
              ? `${formatDate(k.birthDateIso)}${k.birthDateEstimated ? " (estimated)" : ""}`
              : "—"
          }
        />
        <Field label="Current age" value={k.ageText ?? "—"} />
        <Field label="Status" value={k.statusLabel} />
      </dl>

      <div>
        <h3 className="text-sm font-semibold">Growth</h3>
        {k.growth ? (
          <p className="text-sm">
            {k.growth.birthWeightG} g ({formatDate(k.growth.birthWeighedAtIso)}) →{" "}
            {k.growth.latestWeightG} g ({formatDate(k.growth.latestWeighedAtIso)})
            {k.growth.avgGainPerDay !== null ? ` · avg ${k.growth.avgGainPerDay} g/day` : ""}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">No weights recorded.</p>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold">Vaccination &amp; medical history</h3>
        {k.vaccinations.length === 0 ? (
          <p className="text-muted-foreground text-sm">No entries recorded.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {k.vaccinations.map((v, i) => {
              const parts = [
                v.batchNumber ? `batch ${v.batchNumber}` : null,
                v.administeredBy ? `by ${v.administeredBy}` : null,
                v.nextDueDateIso ? `next due ${formatDate(v.nextDueDateIso)}` : null,
                v.correctsOfDateIso ? `corrects entry of ${formatDate(v.correctsOfDateIso)}` : null,
              ].filter(Boolean);
              return (
                <li key={i}>
                  <span className="font-medium">
                    {formatDate(v.givenAtIso)} — {v.type}
                  </span>
                  {parts.length > 0 ? (
                    <span className="text-muted-foreground"> · {parts.join(" · ")}</span>
                  ) : null}
                  {v.note ? <span className="text-muted-foreground"> · {v.note}</span> : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {includesAdopter && k.adopter ? (
        <div>
          <h3 className="text-sm font-semibold">Adopter (included on request)</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <Field label="Name" value={k.adopter.name} />
            <Field label="Phone" value={k.adopter.phone ?? "—"} />
            <Field label="Email" value={k.adopter.email ?? "—"} />
            <Field label="Address" value={k.adopter.address ?? "—"} />
            {k.adopter.adoptionDateIso ? (
              <Field label="Adoption date" value={formatDate(k.adopter.adoptionDateIso)} />
            ) : null}
            {k.adopter.shelterReference ? (
              <Field label="Shelter reference" value={k.adopter.shelterReference} />
            ) : null}
          </dl>
        </div>
      ) : null}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs uppercase">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function ExportDisclaimer() {
  return (
    <p className="text-muted-foreground mt-6 border-t pt-3 text-xs">
      Record-keeping summary generated from live foster data. Schedule suggestions are general
      guidance, not a veterinary protocol — the shelter&apos;s and vet&apos;s records take
      precedence.
    </p>
  );
}
