import { z } from "zod";

export const MATRIC_RE = /^\d{9}$/;
export const REG_RE = /^\d{12}[A-Za-z]{2}$/;
export const IDENTIFIER_HINT =
  "Matric number: 9 digits (e.g. 220703012). Registration number: 12 digits + 2 letters (e.g. 202650372846LA).";

/** Same normalisation as the backend: strip spaces, upper-case reg numbers. */
export function normalizeIdentifier(raw: string): string {
  return raw.trim().replace(/\s+/g, "").toUpperCase();
}

export function identifierType(raw: string): "matric" | "reg" | null {
  const v = normalizeIdentifier(raw);
  if (MATRIC_RE.test(v)) return "matric";
  if (REG_RE.test(v)) return "reg";
  return null;
}

export const identifier = z
  .string()
  .refine((v) => identifierType(v) !== null, { message: "Enter a valid Matric or Registration number." });

export const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (v: string) => v.length >= 8 && v.length <= 128 },
  { label: "At least one letter", test: (v: string) => /[A-Za-z]/.test(v) },
  { label: "At least one number", test: (v: string) => /\d/.test(v) },
];

export const password = z
  .string()
  .min(8, "Password must be at least 8 characters long.")
  .max(128, "Password must be at most 128 characters long.")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Password must contain at least one letter and one number.");

export const email = z.string().trim().toLowerCase().email("Enter a valid email address.");

export const registerSchema = z
  .object({ identifier, password, confirm_password: z.string() })
  .refine((d) => d.password === d.confirm_password, { message: "Passwords do not match.", path: ["confirm_password"] });

export const studentLoginSchema = z.object({ identifier, password: z.string().min(1, "Enter your password.") });

export const staffLoginSchema = z.object({ email, password: z.string().min(1, "Enter your password.") });

export const adminOnboardingSchema = z
  .object({
    full_name: z.string().trim().min(2, "Full name must be at least 2 characters.").max(120),
    current_password: z.string().min(1, "Enter the temporary password you were given."),
    new_password: password,
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, { message: "Passwords do not match.", path: ["confirm_password"] })
  .refine((d) => d.new_password !== d.current_password, {
    message: "New password must be different from the temporary password.",
    path: ["new_password"],
  });

export const studentCreateSchema = z.object({
  identifier,
  full_name: z.string().trim().min(2, "Full name must be at least 2 characters.").max(120),
  level: z.string().trim().min(1, "Level is required.").max(20),
});

export const studentUpdateSchema = z.object({
  full_name: z.string().trim().min(2, "Full name must be at least 2 characters.").max(120),
  level: z.string().trim().min(1, "Level is required.").max(20),
});

export const electionSchema = z
  .object({
    title: z.string().trim().min(3, "Title must be at least 3 characters.").max(150),
    description: z.string().trim().max(2000),
    start_time: z.string().min(1, "Choose a start time."),
    end_time: z.string().min(1, "Choose an end time."),
  })
  .refine((d) => d.start_time < d.end_time, { message: "The end time must be after the start time.", path: ["end_time"] });

export const positionSchema = z.object({ name: z.string().trim().min(2, "Name must be at least 2 characters.").max(100) });

export const candidateNameSchema = z.object({
  full_name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120),
});

export const messageSchema = z
  .object({
    to_all: z.boolean(),
    recipient_ids: z.array(z.string()),
    subject: z.string().trim().min(1, "Enter a subject.").max(200),
    body: z.string().trim().min(1, "Write a message.").max(10_000),
  })
  .refine((d) => d.to_all || d.recipient_ids.length > 0, {
    message: "Choose at least one admin, or send to all admins.",
    path: ["recipient_ids"],
  });

export const stopReasonSchema = z.object({
  reason: z.string().trim().min(3, "Give a reason (at least 3 characters).").max(500),
});

export type FieldErrors = Record<string, string>;

/** Validate and return either the parsed data or a map of field → first error message. */
export function check<T>(schema: z.ZodType<T>, values: unknown): { data: T; errors: null } | { data: null; errors: FieldErrors } {
  const result = schema.safeParse(values);
  if (result.success) return { data: result.data, errors: null };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.length ? String(issue.path[0]) : "_form";
    if (!errors[key]) errors[key] = issue.message;
  }
  return { data: null, errors };
}

// ---- files ----------------------------------------------------------------------------------------
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_CSV_BYTES = 2 * 1024 * 1024;

export function checkImage(file: File | null | undefined): string | null {
  if (!file) return "Choose an image.";
  if (!IMAGE_TYPES.includes(file.type)) return "Only JPEG, PNG or WebP images are allowed.";
  if (file.size > MAX_IMAGE_BYTES) return "Images must be at most 5 MB.";
  return null;
}
