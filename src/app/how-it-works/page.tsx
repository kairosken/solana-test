import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionEmail } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { explorerUrl } from "@/lib/solana";

export default async function HowItWorksPage() {
  const email = await requireSessionEmail();
  if (!email) redirect("/login");

  const row = getDb()
    .prepare(
      `SELECT l.kind, l.points, l.tx_signature, l.created_at, c.display_name
       FROM ledger l JOIN customers c ON c.id = l.customer_id
       ORDER BY l.id DESC LIMIT 1`,
    )
    .get() as { kind: string; points: number; tx_signature: string; created_at: string; display_name: string } | undefined;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Link href="/" className="mb-4 inline-block text-xs text-muted hover:text-ink">← Back to Admin Console</Link>
      <h1 className="mb-2 text-xl font-semibold">How it works</h1>
      <p className="mb-6 text-sm text-muted">
        A real, tamper-proof ledger — and your customers' privacy — at the same time. It takes two layers, not a trade-off.
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-rule bg-surface p-4">
          <h2 className="mb-1 text-sm font-semibold">On-chain layer (public, tamper-proof)</h2>
          <p className="text-xs text-muted">
            A wallet address received or redeemed a number of points at a timestamp. Anyone can independently verify this happened and hasn't been altered — that's the "secure ledger" claim, and it's genuinely true.
          </p>
        </div>
        <div className="rounded-2xl border border-rule bg-surface p-4">
          <h2 className="mb-1 text-sm font-semibold">Off-chain layer (private, in our database)</h2>
          <p className="text-xs text-muted">
            The mapping of "this wallet = this customer" lives only in our backend, never published on-chain. A public wallet address alone doesn't reveal a name or identity.
          </p>
        </div>
      </div>

      {row ? (
        <div className="rounded-2xl border border-rule bg-surface p-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Most recent real transaction</h2>
          <p className="mb-3 text-sm">
            {row.display_name} {row.kind === "award" ? "earned" : "redeemed"} <strong>{row.points} points</strong> on {new Date(row.created_at).toLocaleString()}.
          </p>
          <a
            href={explorerUrl(row.tx_signature)}
            target="_blank"
            rel="noreferrer"
            className="inline-block rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/90"
          >
            View the real transaction on Solana Explorer ↗
          </a>
          <p className="mt-3 text-xs text-muted">
            This is the actual, tamper-proof record. Only {row.display_name.split(" ")[0]}'s balance shows up here — nothing on this public page says who they are.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-rule bg-surface p-5 text-sm text-muted">
          No transactions yet — award or redeem points in the Merchant App to see a real one here.
        </div>
      )}
    </div>
  );
}
