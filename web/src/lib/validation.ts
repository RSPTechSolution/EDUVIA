import { z } from "zod";

/** Mirrors the API's password rules so users see problems before submitting. */
export const newPassword = z
  .string()
  .min(8, "Use at least 8 characters")
  .refine((v) => new TextEncoder().encode(v).length <= 72, "Password is too long")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Include both letters and numbers");
