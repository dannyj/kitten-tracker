/** Mother health log entries are editable this long after creation, then locked. */
export const HEALTH_LOG_EDIT_WINDOW_MS = 15 * 60 * 1000;

/** Weight entries can be edited/deleted this long after creation, then locked. */
export const WEIGHT_EDIT_WINDOW_MS = 15 * 60 * 1000;

/** Hard bounds for a weight in grams — anything outside is rejected. */
export const WEIGHT_MIN_G = 50;
export const WEIGHT_MAX_G = 8000;

/** Soft range for neonate weighing — outside this triggers a confirm, not a reject. */
export const WEIGHT_SOFT_MIN_G = 70;
export const WEIGHT_SOFT_MAX_G = 2000;

/** Feed log entries can be edited/deleted this long after creation, then locked. */
export const FEEDING_EDIT_WINDOW_MS = 15 * 60 * 1000;

/** Hard bounds for a feed amount in ml — anything outside is rejected. */
export const FEEDING_MIN_ML = 0.1;
export const FEEDING_MAX_ML = 60;

/** Soft range for a typical neonate feed — outside this triggers a confirm, not a reject. */
export const FEEDING_SOFT_MIN_ML = 1;
export const FEEDING_SOFT_MAX_ML = 30;

/** Rough per-feed intake guide: ~8 ml formula per 30 g body weight. Guidance only. */
export const FEEDING_ML_PER_30G = 8;

/** Vaccination/medical log entries can be edited/deleted this long after creation. */
export const VACCINATION_EDIT_WINDOW_MS = 15 * 60 * 1000;
