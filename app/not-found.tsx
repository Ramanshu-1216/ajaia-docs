import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight">This document isn&apos;t available</h1>
        <p className="mt-2 text-sm text-graphite">
          It may have been deleted, or it hasn&apos;t been shared with you. Ask the owner to share it with your email.
        </p>
        <Link href="/" className="mt-6 inline-block rounded-md bg-ink px-3.5 py-2 text-sm font-medium text-white">
          Back to documents
        </Link>
      </div>
    </main>
  );
}
