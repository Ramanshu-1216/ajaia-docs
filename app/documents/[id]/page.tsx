import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DocumentEditor } from "@/components/editor/DocumentEditor";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getDocument } from "@/lib/documents";
import { AppError } from "@/lib/errors";

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/documents/${id}`)}`);
  try {
    return { user, doc: await getDocument(await getDb(), user.id, id) };
  } catch (err) {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { doc } = await load((await params).id);
  return { title: doc.title };
}

export default async function DocumentPage({ params }: Props) {
  const { user, doc } = await load((await params).id);
  // key: remount the editor (and its autosave state) when switching documents.
  return <DocumentEditor key={doc.id} doc={doc} user={user} />;
}
