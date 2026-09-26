import type { z } from "zod";

// Server function validators: surface the first readable message instead of
// the raw zod issue list.
export function parseInput<T extends z.ZodTypeAny>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? "ورودی نامعتبر است.");
  return result.data;
}
