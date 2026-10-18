import Link from "next/link";
import type { User } from "@/lib/auth";
import { Avatar } from "./Avatar";
import { SignOutButton } from "./SignOutButton";

export function Wordmark() {
  return (
    <Link href="/" className="font-display text-lg font-bold tracking-tight text-ink">
      Ajaia <span className="font-normal text-graphite">Docs</span>
    </Link>
  );
}

export function UserMenu({ user }: { user: User }) {
  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-right text-sm leading-tight sm:block">
        <span className="block font-medium">{user.name}</span>
        <span className="block font-mono text-xs text-graphite">{user.email}</span>
      </span>
      <Avatar name={user.name} email={user.email} />
      <SignOutButton />
    </div>
  );
}

export function TopBar({ user }: { user: User }) {
  return (
    <header className="border-b border-rule bg-sheet/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Wordmark />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
