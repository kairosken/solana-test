"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function call(body: unknown) {
  const res = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong");
  return data;
}

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestOtp() {
    setError(null);
    setBusy(true);
    try {
      await call({ action: "request-otp", email: email.trim() });
      setStep("otp");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setError(null);
    setBusy(true);
    try {
      await call({ action: "verify-otp", email: email.trim(), code: code.trim() });
      router.push("/");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-paper">
      <div className="w-80 rounded-2xl border border-rule bg-surface p-6 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">◈</span>
          <h1 className="text-lg font-semibold">Loyalty Admin</h1>
        </div>
        <p className="mb-4 text-xs text-muted">Sign in with an email your admin has allowed.</p>

        {step === "email" && (
          <form onSubmit={(e) => { e.preventDefault(); if (email) requestOtp(); }}>
            <input
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@business.com"
              className="w-full rounded-lg border border-rule px-3 py-2 text-sm"
            />
            {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
            <button
              type="submit"
              disabled={busy || !email}
              className="mt-3 w-full rounded-lg bg-ink py-2 text-sm font-medium text-white disabled:bg-muted"
            >
              {busy ? "Sending…" : "Send code"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={(e) => { e.preventDefault(); if (code) verify(); }}>
            <p className="mb-2 text-xs text-muted">Code sent to {email}.</p>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6-digit code"
              className="w-full rounded-lg border border-rule px-3 py-2 text-sm"
            />
            {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
            <button
              type="submit"
              disabled={busy || !code}
              className="mt-3 w-full rounded-lg bg-ink py-2 text-sm font-medium text-white disabled:bg-muted"
            >
              {busy ? "Checking…" : "Verify"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("email"); setCode(""); setError(null); }}
              className="mt-2 w-full text-xs text-muted hover:text-ink"
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
