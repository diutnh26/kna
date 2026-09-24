import { z } from "zod";

/** What a password must be, at sign-up and when an admin sets one. */
export const passwordPolicy = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .regex(/[A-Za-z]/, "Password must include a letter.")
  .regex(/\d/, "Password must include a digit.");
