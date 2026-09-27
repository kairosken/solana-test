import { redirect } from "next/navigation";
import { requireSessionEmail } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { AdminConsoleClient } from "@/components/AdminConsoleClient";

export default async function AdminConsolePage() {
  const email = await requireSessionEmail();
  if (!email) redirect("/login");

  const row = getDb().prepare(`SELECT * FROM business_config WHERE id = 1`).get() as any;
  const config = {
    name: row.name,
    logoUrl: row.logo_url as string | null,
    pointsPerDollar: row.points_per_dollar as number,
    redemptionRules: row.redemption_rules as string,
    allowedEmails: JSON.parse(row.allowed_emails_json) as string[],
    mintAddress: row.mint_address as string | null,
  };
  const customerCount = (getDb().prepare(`SELECT COUNT(*) AS n FROM customers`).get() as { n: number }).n;
  const totals = getDb()
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN kind = 'award' THEN points ELSE 0 END), 0) AS awarded,
         COALESCE(SUM(CASE WHEN kind = 'redeem' THEN points ELSE 0 END), 0) AS redeemed,
         COUNT(*) AS transactions
       FROM ledger`,
    )
    .get() as { awarded: number; redeemed: number; transactions: number };

  return <AdminConsoleClient email={email} config={config} stats={{ customerCount, ...totals }} />;
}
