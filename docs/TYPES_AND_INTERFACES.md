# Types and Interfaces

The contracts that flow through the system. Row types are **inferred from the Drizzle
schema** (`src/db/schema.ts`) — the schema is the single source of truth, and these types
update automatically when it changes. See [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for
where each lives.

## Domain enums

```typescript
// src/db/schema.ts — string-literal unions used across the app
type KittenStatus =
  | "intake" | "in_care" | "ready" | "adopted" | "returned" | "deceased";

type UserRole = "admin" | "viewer";
type FeedingQuality = "good" | "slow" | "refused";
type PhotoSubjectType = "kitten" | "mother";
type PhotoTakenAtSource = "exif" | "manual" | "upload";   // how takenAt was determined
```

## Core row types

Inferred via `typeof table.$inferSelect`. Exposed from `src/db/types.ts` and `src/db/schema.ts`.

```typescript
// A fostered kitten — the central entity.
interface Kitten {
  id: number;
  litterId: number;                 // every kitten belongs to a litter
  shelterNumber: string | null;     // unique when present
  name: string;
  sex: "male" | "female" | "unknown";
  color: string | null;
  birthDate: string | null;         // "YYYY-MM-DD"
  birthDateEstimated: boolean;
  handFeeding: boolean;             // drives the feeding log + countdown
  feedingIntervalMinutes: number;   // default 120; 30–720 when hand-feeding
  status: KittenStatus;
  coverPhotoId: number | null;      // chosen cover; falls back to most recent
  createdAt: Date;                  // stored as unix timestamp
}

// A weighing event. weighedAt may be backdated; createdAt drives the edit window.
interface WeightEntry {
  id: number;
  kittenId: number;
  weighedAt: Date;
  weightGrams: number;              // hard bounds 50–8000 (WEIGHT_MIN/MAX_G)
  note: string | null;
  createdAt: Date;
}

// A feeding event (hand-fed kittens). Same backdating/edit-window model as weights.
interface Feeding {
  id: number;
  kittenId: number;
  fedAt: Date;
  amountMl: number | null;          // hard bounds 0.1–60 (FEEDING_MIN/MAX_ML)
  formula: string | null;
  quality: FeedingQuality | null;
  note: string | null;
  createdAt: Date;
}

// Append-only medical record. A correction is a NEW row pointing back via correctsId.
interface Vaccination {
  id: number;
  kittenId: number;
  type: string;
  givenAt: string;                  // "YYYY-MM-DD", backdatable
  batchNumber: string | null;
  administeredBy: string | null;
  nextDueDate: string | null;
  note: string | null;
  correctsId: number | null;        // self-reference to the row this corrects
  createdAt: Date;
}

interface User {
  id: number;
  username: string;
  passwordHash: string;             // Argon2id; never leaves the server
  role: UserRole;
  createdAt: Date;
}

interface Session {
  id: string;                       // SHA-256/HMAC of the token; raw token only in cookie
  userId: number;
  expiresAt: Date;
}
```

Other tables follow the same pattern: `mothers`, `motherHealthLogs`, `litters`, `photos`,
`statusHistory`, `adopters`, `viewings`, `viewingKittens`, `alertSettings`, `auditLog`,
`scheduleTemplates`. Import their types from `src/db/types.ts` or infer inline.

## Form / Server Action contract

All mutating forms use React's `useActionState`. The shared state shape:

```typescript
// src/lib/forms.ts
type FormState = {
  error?: string;                       // shown to the user on validation failure
  values?: Record<string, string>;      // echoed back so the form keeps its input
} | null;

// Every server action has this signature:
type ServerAction =
  (prevState: FormState, formData: FormData) => Promise<FormState>;
```

Canonical action flow (from `src/app/(app)/kittens/actions.ts`):

```typescript
export async function createKitten(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();                                  // 1. auth guard (or requireAdmin)
  const parsed = kittenSchema.safeParse(Object.fromEntries(formData));  // 2. Zod validate
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, values: formValues(formData) };
  }
  // 3. Drizzle write (often inside db.transaction)
  // 4. revalidatePath(...) and/or redirect(...)
}
```

A successful action returns `null` (often after `redirect()`); a failed one returns a
`FormState` with `error` + `values`.

## Alert engine contract

The growth-alert engine in `src/lib/alerts.ts` is pure (no imports) — feed it weights and
settings, get back a verdict.

```typescript
type AlertLevel = "urgent" | "warning" | "ok" | "insufficient";

interface AlertSettings {
  minDailyGainG: number;     // warning floor: avg daily gain below this → warning
  targetDailyGainG: number;  // chart reference band target
  lossPctUrgent: number;     // drop ≥ this % vs previous weighing → urgent
  noGainHoursUrgent: number; // no net gain across ≥ this many hours → urgent
}

interface WeightPoint { weighedAtMs: number; weightGrams: number; }

interface AlertResult {
  level: AlertLevel;
  avgDailyGainG: number | null;   // over the 48h window, null if not computable
  trend: "up" | "flat" | "down" | null;
  reasons: string[];              // human-readable, most important first
}
```

### Example payloads

```jsonc
// AlertSettings (defaults, seeded into alert_settings table)
{ "minDailyGainG": 7, "targetDailyGainG": 10, "lossPctUrgent": 5, "noGainHoursUrgent": 24 }

// WeightPoint[] input
[
  { "weighedAtMs": 1718200000000, "weightGrams": 180 },
  { "weighedAtMs": 1718286400000, "weightGrams": 172 }
]

// AlertResult output for the above (an ~4.4% drop, below urgent threshold → warning)
{
  "level": "warning",
  "avgDailyGainG": -8,
  "trend": "down",
  "reasons": ["Average daily gain (-8 g/day) is below the 7 g/day floor"]
}
```

```jsonc
// Photo upload metadata stored after the sharp re-encode pipeline
{
  "subjectType": "kitten",
  "subjectId": 42,
  "filePath": "a3f9c1e0-....webp",   // UUID name, outside any static path
  "takenAt": 1718200000000,           // from EXIF when available
  "takenAtSource": "exif",
  "caption": null
}
```
