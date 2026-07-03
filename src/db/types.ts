import type {
  adopters,
  interestedParties,
  kittenCareLogs,
  kittens,
  litters,
  motherHealthLogs,
  mothers,
  statusHistory,
  viewings,
} from "./schema";

export type Mother = typeof mothers.$inferSelect;
export type MotherHealthLog = typeof motherHealthLogs.$inferSelect;
export type Litter = typeof litters.$inferSelect;
export type Kitten = typeof kittens.$inferSelect;
export type KittenCareLog = typeof kittenCareLogs.$inferSelect;
export type StatusHistoryEntry = typeof statusHistory.$inferSelect;
export type Adopter = typeof adopters.$inferSelect;
export type InterestedParty = typeof interestedParties.$inferSelect;
export type Viewing = typeof viewings.$inferSelect;
