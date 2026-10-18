import mammoth from "mammoth";
import { marked } from "marked";
import { AppError } from "./errors";
import { sanitizeDocHtml } from "./sanitize";

/** Kept under Vercel's 4.5 MB request body limit for serverless functions. */
export const MAX_IMPORT_BYTES = 4 * 1024 * 1024;
export const IMPORT_EXTENSIONS = [".txt", ".md", ".docx"] as const;

type Extension = (typeof IMPORT_EXTENSIONS)[number];

const decodeText = (bytes: Uint8Array) => new TextDecoder().decode(bytes).replace(/^\uFEFF/, "");

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function textToHtml(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

async function docxToHtml(bytes: Uint8Array): Promise<string> {
  try {
    const result = await mammoth.convertToHtml(
      { buffer: Buffer.from(bytes) },
      { styleMap: ["u => u"] }, // mammoth drops underline unless mapped explicitly
    );
    return result.value;
  } catch {
    throw new AppError(422, "unreadable_file", "That .docx file couldn't be read. Is it a valid Word document?");
  }
}

const CONVERTERS: Record<Extension, (bytes: Uint8Array) => Promise<string> | string> = {
  ".txt": (bytes) => textToHtml(decodeText(bytes)),
  ".md": (bytes) => marked.parse(decodeText(bytes), { async: false, gfm: true }),
  ".docx": docxToHtml,
};

/** Converts an uploaded file into a title + sanitized editor HTML. */
export async function importFile(fileName: string, bytes: Uint8Array): Promise<{ title: string; html: string }> {
  const dot = fileName.lastIndexOf(".");
  const ext = (dot >= 0 ? fileName.slice(dot).toLowerCase() : "") as Extension;
  if (!IMPORT_EXTENSIONS.includes(ext)) {
    throw new AppError(415, "unsupported_file_type", "Only .txt, .md and .docx files can be imported.");
  }
  if (bytes.byteLength > MAX_IMPORT_BYTES) {
    throw new AppError(413, "file_too_large", "Files must be 4 MB or smaller.");
  }

  const html = sanitizeDocHtml(await CONVERTERS[ext](bytes));
  const title = fileName.slice(0, dot).trim().slice(0, 200) || "Imported document";
  return { title, html };
}
