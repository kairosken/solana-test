"use client";

import Link from "next/link";
import { useState } from "react";
import { PhoneFrame } from "./PhoneFrame";
import { CustomerAppPreview } from "./CustomerAppPreview";
import { MerchantAppPreview } from "./MerchantAppPreview";

interface Config {
  name: string;
  logoUrl: string | null;
  pointsPerDollar: number;
  redemptionRules: string;
  allowedEmails: string[];
  mintAddress: string | null;
}
interface Stats {
  customerCount: number;
  awarded: number;
  redeemed: number;
  transactions: number;
}

type MobileView = "customer" | "merchant" | null;

export function AdminConsoleClient({ email, config, stats }: { email: string; config: Config; stats: Stats }) {
  const [form, setForm] = useState({
    name: config.name,
    logoUrl: config.logoUrl ?? "",
    pointsPerDollar: config.pointsPerDollar,
    redemptionRules: config.redemptionRules,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          logoUrl: form.logoUrl || null,
          pointsPerDollar: Number(form.pointsPerDollar),
          redemptionRules: form.redemptionRules,
        }),
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

  async function signOut() {
    await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-rule bg-surface px-6 py-3">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">◈</span>
            {config.name} Admin Console
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
            <button onClick={() => setMobileView("customer")} className="rounded-lg border border-rule px-3 py-1.5 hover:bg-paper">
              Launch Customer App →
            </button>
            <button onClick={() => setMobileView("merchant")} className="rounded-lg border border-rule px-3 py-1.5 hover:bg-paper">
              Launch Merchant App →
            </button>
            <Link href="/how-it-works" className="rounded-lg border border-rule px-3 py-1.5 hover:bg-paper">
              How It Works
            </Link>
            <Link href="/settings" className="rounded-lg border border-rule px-3 py-1.5 hover:bg-paper">
              Settings
            </Link>
            <span className="text-xs text-muted">{email}</span>
            <button onClick={signOut} className="rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-paper">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label="Customers" value={stats.customerCount} />
          <Metric label="Points awarded" value={stats.awarded} />
          <Metric label="Points redeemed" value={stats.redeemed} />
          <Metric label="Transactions" value={stats.transactions} />
        </div>

        <div className="rounded-2xl border border-rule bg-surface p-5">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">Program setup</h2>
          <p className="mb-4 text-xs text-muted">Your business name, logo, points rate and redemption rules — shown to customers in the Customer App.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
            </Field>
            <Field label="Logo URL (optional)">
              <input value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://…" className="input" />
            </Field>
            <Field label="Points per $1 spent">
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={form.pointsPerDollar}
                onChange={(e) => setForm({ ...form, pointsPerDollar: Number(e.target.value) })}
                className="input"
              />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Redemption rules (shown to customers)">
              <textarea
                value={form.redemptionRules}
                onChange={(e) => setForm({ ...form, redemptionRules: e.target.value })}
                rows={3}
                className="input"
              />
            </Field>
          </div>
          {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
          <button onClick={save} disabled={saving} className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white disabled:bg-muted">
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
          </button>
        </div>

        {config.mintAddress && (
          <div className="rounded-2xl border border-rule bg-surface p-5 text-xs text-muted">
            Loyalty points token (Devnet SPL mint):{" "}
            <a
              href={`https://explorer.solana.com/address/${config.mintAddress}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-brand hover:underline"
            >
              {config.mintAddress}
            </a>
          </div>
        )}
      </main>

      {mobileView === "customer" && (
        <PhoneFrame title="Customer App" onExit={() => setMobileView(null)}>
          <CustomerAppPreview />
        </PhoneFrame>
      )}
      {mobileView === "merchant" && (
        <PhoneFrame title="Merchant App" onExit={() => setMobileView(null)}>
          <MerchantAppPreview pointsPerDollar={form.pointsPerDollar} />
        </PhoneFrame>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-rule bg-surface p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-2xl font-semibold">{value.toLocaleString()}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
