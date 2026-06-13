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

export const MOTHER_HEALTH_CATEGORIES = ["eating", "behaviour", "medical", "other"] as const;
export const FEEDING_QUALITIES = ["good", "slow", "refused"] as const;
export const PHOTO_SUBJECT_TYPES = ["kitten", "mother"] as const;
export const PHOTO_TAKEN_AT_SOURCES = ["exif", "manual", "upload"] as const;
export const USER_ROLES = ["admin", "viewer"] as const;

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
    handFeeding: integer("hand_feeding", { mode: "boolean" }).notNull().default(false),
    feedingIntervalMinutes: integer("feeding_interval_minutes").notNull().default(120),
    status: text("status", { enum: KITTEN_STATUSES }).notNull().default("intake"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
  },
  (t) => [uniqueIndex("kittens_shelter_number_unique").on(t.shelterNumber)],
);

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

export const vaccinations = sqliteTable("vaccinations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kittenId: integer("kitten_id")
    .notNull()
    .references(() => kittens.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  givenAt: text("given_at").notNull(),
  batchNumber: text("batch_number"),
  administeredBy: text("administered_by"),
  nextDueDate: text("next_due_date"),
  note: text("note"),
  // Medical records are append-only: after the 15-minute edit window a
  // correction becomes a NEW row pointing at the original via correctsId,
  // never a silent edit. createdAt drives that window (givenAt is backdatable).
  correctsId: integer("corrects_id").references((): AnySQLiteColumn => vaccinations.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
});

// Vaccination/deworming schedule templates — convenience defaults (NOT a
// veterinary protocol), editable in Settings. Seeded in migrate.ts.
export const scheduleTemplates = sqliteTable(
  "schedule_templates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    vaccineType: text("vaccine_type").notNull(),
    label: text("label").notNull(),
    firstWeeks: real("first_weeks").notNull(),
    everyWeeks: real("every_weeks").notNull(),
    untilWeeks: real("until_weeks").notNull(),
  },
  (t) => [uniqueIndex("schedule_templates_type_unique").on(t.vaccineType)],
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

export const viewings = sqliteTable("viewings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  visitedAt: integer("visited_at", { mode: "timestamp" }).notNull().default(now),
  visitorName: text("visitor_name").notNull(),
  phone: text("phone"),
  email: text("email"),
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
