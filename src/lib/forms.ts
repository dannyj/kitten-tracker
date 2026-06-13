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
