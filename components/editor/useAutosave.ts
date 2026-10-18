"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "saved" | "saving" | "error" | "conflict";
type Changes = { title?: string; content?: string };

const DEBOUNCE_MS = 800;
const RETRY_MS = 3000;

/**
 * Debounced autosave with one request in flight at a time.
 * - Title and content edits are merged into a single PATCH.
 * - Each PATCH carries the version it was based on; a 409 stops autosaving and
 *   surfaces a conflict instead of overwriting someone else's work.
 * - Network / 5xx failures keep the changes and retry; other 4xx stop and explain.
 */
export function useAutosave(docId: string, initialVersion: number) {
  const [state, setState] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);

  const version = useRef(initialVersion);
  const pending = useRef<Changes>({});
  const inFlight = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocked = useRef(false);
  const skipUnloadGuard = useRef(false);
  const sendRef = useRef<() => Promise<void>>(async () => undefined);

  const url = `/api/documents/${docId}`;
  const hasPending = () => Object.keys(pending.current).length > 0;

  const schedule = useCallback((ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void sendRef.current();
    }, ms);
  }, []);

  const send = useCallback(async (): Promise<void> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (inFlight.current || blocked.current || !hasPending()) return;

    const changes = pending.current;
    pending.current = {};
    setState("saving");

    const run = (async () => {
      const restore = () => {
        pending.current = { ...changes, ...pending.current };
      };
      try {
        const res = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...changes, baseVersion: version.current }),
        });
        if (res.ok) {
          version.current = (await res.json()).version;
          setError(null);
          setState(hasPending() ? "saving" : "saved");
          return;
        }
        restore();
        const message: string = (await res.json().catch(() => null))?.error?.message ?? "Couldn't save your changes.";
        if (res.status === 409) {
          blocked.current = true;
          setState("conflict");
        } else if (res.status >= 500) {
          setError(`${message} Retrying…`);
          setState("error");
          schedule(RETRY_MS);
        } else {
          blocked.current = true;
          setError(res.status === 401 ? "Your session expired. Sign in again to keep editing." : message);
          setState("error");
        }
      } catch {
        restore();
        setError("Can't reach the server. Retrying…");
        setState("error");
        schedule(RETRY_MS);
      }
    })();

    inFlight.current = run;
    try {
      await run;
    } finally {
      inFlight.current = null;
      if (hasPending() && !blocked.current && !timer.current) schedule(DEBOUNCE_MS);
    }
  }, [url, schedule]);

  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  const queue = useCallback(
    (changes: Changes) => {
      pending.current = { ...pending.current, ...changes };
      if (blocked.current) return;
      setState("saving");
      schedule(DEBOUNCE_MS);
    },
    [schedule],
  );

  /** Save now (Ctrl/Cmd+S, before export). Resolves when everything queued so far is saved or failed. */
  const flush = useCallback(async () => {
    if (inFlight.current) await inFlight.current;
    await sendRef.current();
  }, []);

  /** Conflict resolution: discard local changes and load the latest version. */
  const reload = useCallback(() => {
    skipUnloadGuard.current = true;
    window.location.reload();
  }, []);

  /** Conflict resolution: rebase on the latest version and save our full copy over it. */
  const overwrite = useCallback(
    async (current: Required<Changes>) => {
      const res = await fetch(url).catch(() => null);
      if (!res?.ok) {
        setError("Couldn't load the latest version. Try again.");
        return;
      }
      version.current = (await res.json()).version;
      blocked.current = false;
      pending.current = { ...current };
      await sendRef.current();
    },
    [url],
  );

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!skipUnloadGuard.current && (hasPending() || inFlight.current)) event.preventDefault();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void sendRef.current();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
      // Leaving the page via client-side navigation: send what's left without waiting.
      if (timer.current) clearTimeout(timer.current);
      if (hasPending() && !blocked.current && !inFlight.current) {
        void fetch(url, {
          method: "PATCH",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...pending.current, baseVersion: version.current }),
        }).catch(() => undefined);
        pending.current = {};
      }
    };
  }, [url]);

  return { state, error, queue, flush, reload, overwrite };
}
