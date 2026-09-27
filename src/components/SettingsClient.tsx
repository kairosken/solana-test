"use client";

import Link from "next/link";
import { useState } from "react";

export function SettingsClient({ allowedEmails }: { allowedEmails: string[] }) {
  const [text, setText] = useState(allowedEmails.join("\n"));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const list = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const res = await fetch("/api/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowedEmails: list }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Link href="/" className="mb-4 inline-block text-xs text-muted hover:text-ink">← Back to Admin Console</Link>
      <h1 className="mb-1 text-xl font-semibold">Settings</h1>
      <p className="mb-4 text-sm text-muted">
        Who can sign in to this Admin Console. One email address or domain per line — e.g. <code>owner@business.com</code> or <code>business.com</code>.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder={"owner@business.com\nbusiness.com"}
        className="input font-mono"
      />
      {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
      <button onClick={save} disabled={saving} className="mt-3 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white disabled:bg-muted">
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
      </button>
    </div>
  );
}
