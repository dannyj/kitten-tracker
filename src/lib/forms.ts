import { z } from "zod";

// Light phone validation: accept +31/06 styles, don't force a mask. Shared by
// the adopter, interested-party and any other contact forms.
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+0-9][0-9 ()/-]{4,24}$/, "That doesn't look like a phone number")
  .optional()
  .or(z.literal(""));

/** Shared shape for useActionState-based forms. */
export type FormState = {
  error?: string;
  /** Submitted values, echoed back so the form keeps state on error. */
  values?: Record<string, string>;
} | null;

export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$")) {
      values[key] = value;
    }
  }
  return values;
}
