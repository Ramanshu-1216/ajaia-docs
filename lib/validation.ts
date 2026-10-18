import { z } from "zod";
import type { ShareRole } from "./access";

export const MAX_TITLE_LENGTH = 200;
export const MAX_CONTENT_LENGTH = 1_000_000;

const title = z
  .string()
  .trim()
  .min(1, "Title can't be empty.")
  .max(MAX_TITLE_LENGTH, `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`);

const content = z.string().max(MAX_CONTENT_LENGTH, "This document is too large to save (1 MB max).");

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Enter your email."),
  password: z.string().min(1, "Enter your password."),
});

export const createDocumentSchema = z.object({
  title: title.optional(),
  content: content.optional(),
});

export const updateDocumentSchema = z
  .object({
    title: title.optional(),
    content: content.optional(),
    baseVersion: z.number().int().positive(),
  })
  .refine((v) => v.title !== undefined || v.content !== undefined, "Nothing to update.");

export const shareSchema = z.object({
  email: z.string().trim().min(1, "Enter an email address.").max(320),
  role: z.enum(["viewer", "editor"] satisfies ShareRole[], "Role must be viewer or editor."),
});
