"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface Customer {
  id: number;
  displayName: string;
  walletPubkey: string;
}
interface HistoryItem {
  kind: "award" | "redeem";
  points: number;
  dollarAmount: number | null;
  signature: string;
  explorerUrl: string;
  at: string;
}

export function CustomerAppPreview() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [signedInAs, setSignedInAs] = useState<Customer | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryItem[] | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/customers").then((r) => r.json()).then(setCustomers).catch(() => setCustomers([]));
  }, []);

  async function signIn(c: Customer) {
    setSignedInAs(c);
    setBalance(null);
    setHistory(null);
    const res = await fetch(`/api/points?customerId=${c.id}`);
    const data = await res.json();
    setBalance(data.balance);
    setHistory(data.history);
    const dataUrl = await QRCode.toDataURL(`ksolana:customer:${c.id}`, { width: 220, margin: 1 });
    setQr(dataUrl);
  }

  if (!customers) return <div className="p-6 text-sm text-muted">Loading…</div>;

  if (!signedInAs) {
    return (
      <div className="p-4">
        <h2 className="mb-1 text-lg font-semibold">Sign in</h2>
        <p className="mb-3 text-xs text-muted">Demo — pick a customer to see their real balance and history.</p>
        <div className="space-y-2">
          {customers.map((c) => (
            <button key={c.id} onClick={() => signIn(c)} className="w-full rounded-lg border border-rule bg-surface p-3 text-left text-sm hover:bg-paper">
              {c.displayName}
            </button>
          ))}
          {customers.length === 0 && <div className="text-xs text-muted">No demo customers yet — run the seed script.</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">{signedInAs.displayName}</h2>
        <button onClick={() => setSignedInAs(null)} className="text-xs text-muted">Sign out</button>
      </div>

      <div className="mb-4 rounded-2xl bg-brand p-5 text-white">
        <div className="text-xs uppercase tracking-wide opacity-80">Points balance</div>
        <div className="text-4xl font-bold">{balance === null ? "…" : balance.toLocaleString()}</div>
      </div>

      {qr && (
        <div className="mb-4 rounded-2xl border border-rule bg-surface p-4 text-center">
          <img src={qr} alt="Your QR code" className="mx-auto" />
          <p className="mt-2 text-[11px] text-muted">Show this to staff to award or redeem points</p>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase text-muted">History</h3>
        <div className="space-y-2">
          {history?.length === 0 && <div className="text-xs text-muted">No activity yet.</div>}
          {history?.map((h, i) => (
            <a
              key={i}
              href={h.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="block rounded-lg border border-rule bg-surface p-2.5 text-xs hover:bg-paper"
            >
              <div className="flex items-center justify-between">
                <span className={h.kind === "award" ? "font-medium text-go" : "font-medium text-warn"}>
                  {h.kind === "award" ? "+" : "-"}
                  {h.points} pts
                </span>
                <span className="text-muted">{new Date(h.at).toLocaleDateString()}</span>
              </div>
              {h.dollarAmount != null && <div className="text-muted">${h.dollarAmount.toFixed(2)} spent</div>}
              <div className="mt-1 truncate font-mono text-[10px] text-brand">{h.signature} ↗</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
