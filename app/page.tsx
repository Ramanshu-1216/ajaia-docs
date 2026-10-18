import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { DashboardActions } from "@/components/DashboardActions";
import { DeleteDocumentButton } from "@/components/DeleteDocumentButton";
import { TopBar } from "@/components/TopBar";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listDocuments, type DocSummary } from "@/lib/documents";
import { inkFor, ROLE_LABEL, timeAgo } from "@/lib/format";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { owned, shared } = await listDocuments(await getDb(), user.id);

  return (
    <>
      <TopBar user={user} />
      <main className="mx-auto max-w-5xl px-6 pb-24 pt-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h1 className="font-display text-3xl font-bold tracking-tight">Documents</h1>
          <DashboardActions />
        </div>

        <DocumentSection
          title="Owned by you"
          docs={owned}
          empty="Nothing here yet. Create a document or import a file to get started."
        />
        <DocumentSection
          title="Shared with you"
          docs={shared}
          empty="When someone shares a document with you, it shows up here."
        />
      </main>
    </>
  );
}

function DocumentSection({ title, docs, empty }: { title: string; docs: DocSummary[]; empty: string }) {
  return (
    <section className="mt-10" aria-label={title}>
      <h2 className="flex items-baseline gap-2 text-sm font-semibold text-graphite">
        {title}
        <span className="font-mono text-xs font-normal">{docs.length}</span>
      </h2>
      {docs.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-rule px-4 py-6 text-sm text-graphite">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-sheet">
          {docs.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DocumentRow({ doc }: { doc: DocSummary }) {
  const isOwner = doc.role === "owner";
  return (
    <li className="group relative flex items-center gap-4 px-5 py-4 hover:bg-fog/60">
      {/* The spine: the owner's ink. */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: inkFor(doc.ownerEmail) }} />
      <div className="min-w-0 flex-1">
        <Link
          href={`/documents/${doc.id}`}
          className="block truncate font-medium after:absolute after:inset-0 focus-visible:outline-none"
        >
          {doc.title}
        </Link>
        <p className="mt-0.5 flex items-center gap-2 text-xs text-graphite">
          {!isOwner && (
            <>
              <Avatar name={doc.ownerName} email={doc.ownerEmail} size="sm" />
              <span>{doc.ownerName}</span>
              <span aria-hidden>·</span>
            </>
          )}
          <span className="font-mono">Edited {timeAgo(doc.updatedAt)}</span>
        </p>
      </div>
      {!isOwner && (
        <span className="rounded-full border border-rule px-2.5 py-0.5 text-xs text-graphite">
          {ROLE_LABEL[doc.role]}
        </span>
      )}
      {isOwner && <DeleteDocumentButton id={doc.id} title={doc.title} />}
    </li>
  );
}
