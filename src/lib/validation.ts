import { z } from "zod";
import { KEY_PATTERN } from "./envfile";
import { isIsoDate } from "./dates";

export const ENVIRONMENTS = ["development", "staging", "production"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60, "Name is too long"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[0-9]/, "Password must include a number")
    .regex(/[A-Za-z]/, "Password must include a letter"),
});

export const projectSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(40, "Name is too long"),
  description: z.string().trim().max(160, "Keep the description under 160 characters").default(""),
});

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || isIsoDate(v), "Use a valid date");

export const secretSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "Enter a key name")
    .max(64, "Key name is too long")
    .regex(KEY_PATTERN, "Use letters, numbers and underscores, starting with a letter")
    .transform((v) => v.toUpperCase()),
  value: z.string().min(1, "Enter a value").max(4000, "Value is too long"),
  environment: z.enum(ENVIRONMENTS, { message: "Pick an environment" }),
  note: z.string().trim().max(140, "Keep the note under 140 characters").default(""),
  rotationDays: z.coerce
    .number({ message: "Enter a number of days" })
    .int("Use whole days")
    .min(1, "At least 1 day")
    .max(730, "At most 730 days"),
  expiresOn: optionalDate,
});

export const shareSchema = z.object({
  secretId: z.coerce.number().int().positive("Pick a secret"),
  expiry: z.enum(["1h", "24h", "7d"], { message: "Pick an expiry" }),
  maxViews: z.coerce.number().int().min(1, "At least 1 view").max(10, "At most 10 views"),
});

export const importSchema = z.object({
  environment: z.enum(ENVIRONMENTS, { message: "Pick an environment" }),
  content: z.string().min(1, "Paste the contents of a .env file").max(50_000, "File is too large"),
  overwrite: z.coerce.boolean().default(false),
});

export type FieldErrors = Record<string, string>;

/** Flatten Zod issues into one message per field, for inline form errors. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export interface FormState {
  ok?: boolean;
  message?: string;
  errors?: FieldErrors;
  values?: Record<string, string>;
}
