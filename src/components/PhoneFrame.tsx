"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

export function PhoneFrame({
  title,
  exitLabel = "Back to Admin Console",
  onExit,
  footer,
  children,
}: {
  title: string;
  exitLabel?: string;
  onExit: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onExit();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60" onClick={onExit}>
      <div
        className="relative flex h-[720px] w-[380px] flex-col overflow-hidden rounded-[2rem] border-8 border-ink bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onExit}
          title="Close (Esc)"
          className="absolute -right-3 -top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink bg-white text-sm font-bold text-ink shadow-lg hover:bg-paper"
        >
          ✕
        </button>
        <div className="flex items-center gap-2 bg-ink px-3 py-2 text-white">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-brand text-[10px] font-bold">◈</span>
          <span className="min-w-0 flex-1 truncate text-xs">{title}</span>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col bg-paper text-ink">
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer && <div className="shrink-0 space-y-2 border-t border-rule bg-surface p-3">{footer}</div>}
        </div>
        <button onClick={onExit} className="shrink-0 border-t border-rule bg-surface py-2 text-xs font-medium text-muted hover:bg-paper">
          ← {exitLabel}
        </button>
      </div>
    </div>
  );
}
