"use client";

import { useEffect, useState } from "react";

interface Customer {
  id: number;
  displayName: string;
  walletPubkey: string;
}
interface Result {
  points: number;
  signature: string;
  explorerUrl: string;
}

export function MerchantAppPreview({ pointsPerDollar }: { pointsPerDollar: number }) {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [mode, setMode] = useState<"award" | "redeem">("award");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/customers").then((r) => r.json()).then(setCustomers).catch(() => setCustomers([]));
  }, []);

  async function submit() {
    if (!selected || !amount) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body =
        mode === "award"
          ? { action: "award", customerId: selected.id, dollarAmount: Number(amount) }
          : { action: "redeem", customerId: selected.id, points: Number(amount) };
      const res = await fetch("/api/points", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Transaction failed");
      setResult(data);
      setAmount("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!customers) return <div className="p-6 text-sm text-muted">Loading…</div>;

  if (!selected) {
    return (
      <div className="p-4">
        <h2 className="mb-1 text-lg font-semibold">Scan customer</h2>
        <p className="mb-3 text-xs text-muted">Demo — no camera here, so pick who you'd scan.</p>
        <div className="space-y-2">
          {customers.map((c) => (
            <button key={c.id} onClick={() => setSelected(c)} className="w-full rounded-lg border border-rule bg-surface p-3 text-left text-sm hover:bg-paper">
              {c.displayName}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <button onClick={() => { setSelected(null); setResult(null); setError(null); }} className="mb-2 text-xs text-muted">← Scan someone else</button>
      <h2 className="mb-3 text-base font-semibold">{selected.displayName}</h2>

      <div className="mb-3 flex gap-1">
        <button
          onClick={() => { setMode("award"); setResult(null); }}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm ${mode === "award" ? "border-brand bg-brand-tint text-brand-dark" : "border-rule"}`}
        >
          Award
        </button>
        <button
          onClick={() => { setMode("redeem"); setResult(null); }}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm ${mode === "redeem" ? "border-brand bg-brand-tint text-brand-dark" : "border-rule"}`}
        >
          Redeem
        </button>
      </div>

      <label className="mb-1 block text-xs font-medium text-muted">
        {mode === "award" ? `Amount spent ($) — ${pointsPerDollar} pts / $1` : "Points to redeem"}
      </label>
      <input
        type="number"
        min="0"
        step={mode === "award" ? "0.01" : "1"}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder={mode === "award" ? "12.50" : "100"}
        className="input mb-3"
      />

      {error && <div className="mb-2 text-xs text-red-600">{error}</div>}

      <button
        onClick={submit}
        disabled={busy || !amount}
        className="w-full rounded-lg bg-ink py-2.5 text-sm font-medium text-white disabled:bg-muted"
      >
        {busy ? "Confirming on Solana Devnet…" : mode === "award" ? "Award points" : "Redeem points"}
      </button>

      {result && (
        <div className="mt-4 rounded-lg border border-go bg-go-tint p-3 text-xs">
          <div className="font-medium text-go">
            {mode === "award" ? `+${result.points} points minted` : `${result.points} points redeemed`} — confirmed on Devnet ✓
          </div>
          <a href={result.explorerUrl} target="_blank" rel="noreferrer" className="mt-1 block truncate font-mono text-[10px] text-brand hover:underline">
            {result.signature} ↗
          </a>
        </div>
      )}
    </div>
  );
}
