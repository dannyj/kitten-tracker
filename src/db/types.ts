import type {
  adopters,
  kittens,
  litters,
  motherHealthLogs,
  mothers,
  statusHistory,
} from "./schema";

export type Mother = typeof mothers.$inferSelect;
export type MotherHealthLog = typeof motherHealthLogs.$inferSelect;
export type Litter = typeof litters.$inferSelect;
export type Kitten = typeof kittens.$inferSelect;
export type StatusHistoryEntry = typeof statusHistory.$inferSelect;
export type Adopter = typeof adopters.$inferSelect;
