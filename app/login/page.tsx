import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

/** Only same-site relative paths, so `?next=` can't be used as an open redirect. */
function safeNext(next: string | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <p className="font-display text-2xl font-bold tracking-tight">
          Ajaia <span className="font-normal text-graphite">Docs</span>
        </p>
        <h1 className="mt-8 text-sm font-medium text-graphite">Sign in to write and share documents with your team.</h1>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
