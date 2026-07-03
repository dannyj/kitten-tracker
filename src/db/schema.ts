import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const KITTEN_STATUSES = [
  "intake",
  "in_care",
  "ready",
  "adopted",
  "returned",
  "deceased",
] as const;
export type KittenStatus = (typeof KITTEN_STATUSES)[number];

// How a kitten is currently fed. Drives both the hand-feeding tracking module
// (only "hand") and the tailored "not gaining enough" advice in HintsPanel.
export const FEEDING_METHODS = ["mother", "hand", "weaned"] as const;
export type FeedingMethod = (typeof FEEDING_METHODS)[number];

export const MOTHER_HEALTH_CATEGORIES = ["eating", "behaviour", "medical", "other"] as const;
export const KITTEN_CARE_CATEGORIES = [
  "milestone",
  "behaviour",
  "socialisation",
  "husbandry",
  "other",
] as const;
export const FEEDING_QUALITIES = ["good", "slow", "refused"] as const;
export const PHOTO_SUBJECT_TYPES = ["kitten", "mother"] as const;
// Medical records and schedule templates are keyed to either subject, mirroring
// photos. No DB-level FK (a column can't point at two tables) — subject
// existence is checked in the server actions, as with photos.
export const MEDICAL_SUBJECT_TYPES = ["kitten", "mother"] as const;
export type MedicalSubjectType = (typeof MEDICAL_SUBJECT_TYPES)[number];
export const PHOTO_TAKEN_AT_SOURCES = ["exif", "manual", "upload"] as const;
export const USER_ROLES = ["admin", "viewer"] as const;

// Interested-party pipeline. enquired → viewing_booked → viewed → approved →
// adopted, with the off-ramps withdrew / not_suitable. Foster-driven.
export const PARTY_STATUSES = [
  "enquired",
  "viewing_booked",
  "viewed",
  "approved",
  "adopted",
  "withdrew",
  "not_suitable",
] as const;
export type PartyStatus = (typeof PARTY_STATUSES)[number];

const now = sql`(unixepoch())`;

export const mothers = sqliteTable("mothers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  shelterNumber: text("shelter_number"),
  intakeDate: text("intake_date"),
  notesBehaviour: text("notes_behaviour"),
  status: text("status").notNull().default("in_care"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
});

export const motherHealthLogs = sqliteTable("mother_health_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  motherId: integer("mother_id")
    .notNull()
    .references(() => mothers.id, { onDelete: "cascade" }),
  loggedAt: integer("logged_at", { mode: "timestamp" }).notNull().default(now),
  category: text("category", { enum: MOTHER_HEALTH_CATEGORIES }).notNull().default("other"),
  entry: text("entry").notNull(),
});

export const litters = sqliteTable("litters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  motherId: integer("mother_id").references(() => mothers.id, { onDelete: "set null" }),
  birthDate: text("birth_date"),
  birthDateEstimated: integer("birth_date_estimated", { mode: "boolean" }).notNull().default(false),
  notes: text("notes"),
});

export const kittens = sqliteTable(
  "kittens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    litterId: integer("litter_id")
      .notNull()
      .references(() => litters.id),
    shelterNumber: text("shelter_number"),
    name: text("name").notNull(),
    sex: text("sex", { enum: ["male", "female", "unknown"] })
      .notNull()
      .default("unknown"),
    color: text("color"),
    birthDate: text("birth_date"),
    birthDateEstimated: integer("birth_date_estimated", { mode: "boolean" })
      .notNull()
      .default(false),
    feedingMethod: text("feeding_method", { enum: FEEDING_METHODS }).notNull().default("mother"),
    feedingIntervalMinutes: integer("feeding_interval_minutes").notNull().default(120),
    status: text("status", { enum: KITTEN_STATUSES }).notNull().default("intake"),
    // Chosen cover photo; nulled automatically if that photo is deleted.
    // Falls back to the most recent photo when unset.
    coverPhotoId: integer("cover_photo_id").references((): AnySQLiteColumn => photos.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
  },
  (t) => [uniqueIndex("kittens_shelter_number_unique").on(t.shelterNumber)],
);

// Free-form, categorised care/observation log per kitten (milestones and
// husbandry notes that aren't weights, feeds, or medical records). Mirrors
// mother_health_logs; same 15-minute edit window enforced in the actions.
export const kittenCareLogs = sqliteTable("kitten_care_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kittenId: integer("kitten_id")
    .notNull()
    .references(() => kittens.id, { onDelete: "cascade" }),
  loggedAt: integer("logged_at", { mode: "timestamp" }).notNull().default(now),
  category: text("category", { enum: KITTEN_CARE_CATEGORIES }).notNull().default("other"),
  entry: text("entry").notNull(),
});

export const weightEntries = sqliteTable("weight_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kittenId: integer("kitten_id")
    .notNull()
    .references(() => kittens.id, { onDelete: "cascade" }),
  weighedAt: integer("weighed_at", { mode: "timestamp" }).notNull().default(now),
  weightGrams: integer("weight_grams").notNull(),
  note: text("note"),
  // Creation time, distinct from weighedAt (which may be backdated). The
  // 15-minute edit/delete window runs from this so backdated entries are
  // still correctable right after entry.
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
});

export const feedings = sqliteTable("feedings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kittenId: integer("kitten_id")
    .notNull()
    .references(() => kittens.id, { onDelete: "cascade" }),
  fedAt: integer("fed_at", { mode: "timestamp" }).notNull().default(now),
  amountMl: real("amount_ml"),
  formula: text("formula"),
  quality: text("quality", { enum: FEEDING_QUALITIES }),
  note: text("note"),
  // Creation time, distinct from fedAt (which may be backdated). The 15-minute
  // edit/delete window runs from this. Mirrors weight_entries.created_at.
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
});

// Structured medical/treatment records for both kittens and mothers. Despite
// the table name (kept from when only kittens had them), this now covers
// microchip, deworming, flea, vaccinations etc. for either subject.
export const vaccinations = sqliteTable("vaccinations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  subjectType: text("subject_type", { enum: MEDICAL_SUBJECT_TYPES }).notNull(),
  subjectId: integer("subject_id").notNull(),
  type: text("type").notNull(),
  givenAt: text("given_at").notNull(),
  batchNumber: text("batch_number"),
  administeredBy: text("administered_by"),
  nextDueDate: text("next_due_date"),
  note: text("note"),
  // Medical records are append-only: after the 15-minute edit window a
  // correction becomes a NEW row pointing at the original via correctsId,
  // never a silent edit. createdAt drives that window (givenAt is backdatable).
  // No DB-level self-FK (matches the FK-less subject model above); the actions
  // validate that a corrected entry belongs to the same subject.
  correctsId: integer("corrects_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
});

// Treatment schedule templates — convenience defaults (NOT a veterinary
// protocol), editable in Settings. Kitten and adult-cat (mother) templates are
// distinct rows keyed by subjectType. Seeded in migrate.ts.
export const scheduleTemplates = sqliteTable(
  "schedule_templates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    subjectType: text("subject_type", { enum: MEDICAL_SUBJECT_TYPES }).notNull().default("kitten"),
    vaccineType: text("vaccine_type").notNull(),
    label: text("label").notNull(),
    firstWeeks: real("first_weeks").notNull(),
    everyWeeks: real("every_weeks").notNull(),
    untilWeeks: real("until_weeks").notNull(),
  },
  (t) => [uniqueIndex("schedule_templates_subject_type_unique").on(t.subjectType, t.vaccineType)],
);

export const photos = sqliteTable("photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  subjectType: text("subject_type", { enum: PHOTO_SUBJECT_TYPES }).notNull(),
  subjectId: integer("subject_id").notNull(),
  filePath: text("file_path").notNull(),
  takenAt: integer("taken_at", { mode: "timestamp" }),
  takenAtSource: text("taken_at_source", { enum: PHOTO_TAKEN_AT_SOURCES })
    .notNull()
    .default("upload"),
  caption: text("caption"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
});

export const statusHistory = sqliteTable("status_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kittenId: integer("kitten_id")
    .notNull()
    .references(() => kittens.id, { onDelete: "cascade" }),
  status: text("status", { enum: KITTEN_STATUSES }).notNull(),
  changedAt: integer("changed_at", { mode: "timestamp" }).notNull().default(now),
  note: text("note"),
});

export const adopters = sqliteTable("adopters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kittenId: integer("kitten_id")
    .notNull()
    .references(() => kittens.id),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  adoptionDate: text("adoption_date"),
  shelterReference: text("shelter_reference"),
  note: text("note"),
});

// Reusable contact record for someone interested in adopting — linkable to many
// viewings and many kittens without retyping. PII; full contact detail is
// admin-gated in the actions/pages (mirrors the adopters rules).
export const interestedParties = sqliteTable("interested_parties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  partnerName: text("partner_name"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  source: text("source"),
  status: text("status", { enum: PARTY_STATUSES }).notNull().default("enquired"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
});

export const viewings = sqliteTable("viewings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // notNull in Drizzle + always set by the actions; the DB column is nullable
  // because migration 0007 added it via ALTER TABLE on a populated table.
  interestedPartyId: integer("interested_party_id")
    .notNull()
    .references(() => interestedParties.id),
  visitedAt: integer("visited_at", { mode: "timestamp" }).notNull().default(now),
  location: text("location"),
  // The foster's read on the viewing (fit, living situation, other pets, general
  // impression). Editable working judgement, not an audit record.
  notes: text("notes"),
});

export const viewingKittens = sqliteTable(
  "viewing_kittens",
  {
    viewingId: integer("viewing_id")
      .notNull()
      .references(() => viewings.id, { onDelete: "cascade" }),
    kittenId: integer("kitten_id")
      .notNull()
      .references(() => kittens.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.viewingId, t.kittenId] })],
);

export const alertSettings = sqliteTable(
  "alert_settings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (t) => [uniqueIndex("alert_settings_key_unique").on(t.key)],
);

// Durable security/audit trail: logins, adopter-PII access, exports.
export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  at: integer("at", { mode: "timestamp" }).notNull().default(now),
  action: text("action").notNull(),
  username: text("username"),
  ip: text("ip"),
  detail: text("detail"),
});

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: USER_ROLES }).notNull().default("viewer"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
  },
  (t) => [uniqueIndex("users_username_unique").on(t.username)],
);

export const sessions = sqliteTable("sessions", {
  // SHA-256 hash of the session token; the raw token only ever lives in the cookie
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
});

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
