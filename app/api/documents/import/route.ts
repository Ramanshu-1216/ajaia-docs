import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { createDocument } from "@/lib/documents";
import { AppError, badRequest } from "@/lib/errors";
import { handle } from "@/lib/http";
import { importFile, MAX_IMPORT_BYTES } from "@/lib/importers";

/** Multipart upload (`file` field) of a .txt / .md / .docx → a new document owned by the uploader. */
export const POST = handle(async (req) => {
  const user = await requireUser();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw badRequest("Upload the file as multipart form data.");
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw badRequest("Choose a non-empty file to import.");
  if (file.size > MAX_IMPORT_BYTES) throw new AppError(413, "file_too_large", "Files must be 4 MB or smaller.");

  const { title, html } = await importFile(file.name, new Uint8Array(await file.arrayBuffer()));
  const doc = await createDocument(await getDb(), user.id, { title, content: html });
  return NextResponse.json({ id: doc.id, title: doc.title }, { status: 201 });
});
