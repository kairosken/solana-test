import { getDb } from "@/lib/db";

// No login required for the Customer/Merchant app *previews* — like kfleet's mobile-app
// previews, these are a demo picker (pick a seeded demo customer), not real per-customer
// self-signup. The Admin Console itself is the one thing behind real OTP + allowlist auth.

export async function GET() {
  const rows = getDb()
    .prepare(`SELECT id, display_name, wallet_pubkey FROM customers ORDER BY id`)
    .all() as { id: number; display_name: string; wallet_pubkey: string }[];
  return Response.json(rows.map((r) => ({ id: r.id, displayName: r.display_name, walletPubkey: r.wallet_pubkey })));
}
