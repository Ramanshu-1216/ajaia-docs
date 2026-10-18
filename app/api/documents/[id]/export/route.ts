import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getDocument } from "@/lib/documents";
import { htmlToMarkdown, markdownFileName } from "@/lib/exporters";
import { handle } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

/** Downloads the document as Markdown. Anyone with read access can export. */
export const GET = handle(async (_req, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const doc = await getDocument(await getDb(), user.id, id);

  const body = htmlToMarkdown(doc.content);
  const markdown = body.startsWith("# ") ? body : `# ${doc.title}\n\n${body}`;
  const fileName = markdownFileName(doc.title);

  return new Response(`${markdown}\n`, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
});
