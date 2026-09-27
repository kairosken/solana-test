import { z } from "zod";
import { getDb } from "@/lib/db";
import { requireSessionEmail } from "@/lib/auth";

function readConfig() {
  const row = getDb().prepare(`SELECT * FROM business_config WHERE id = 1`).get() as any;
  return {
    name: row.name,
    logoUrl: row.logo_url,
    pointsPerDollar: row.points_per_dollar,
    redemptionRules: row.redemption_rules,
    allowedEmails: JSON.parse(row.allowed_emails_json) as string[],
    mintAddress: row.mint_address,
  };
}

export async function GET() {
  const email = await requireSessionEmail();
  if (!email) return Response.json({ error: "Not signed in" }, { status: 401 });

  const config = readConfig();
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

  return Response.json({ config, stats: { customerCount, ...totals } });
}

const UpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  logoUrl: z.string().url().max(500).nullable().optional(),
  pointsPerDollar: z.number().positive().max(1000).optional(),
  redemptionRules: z.string().max(2000).optional(),
  allowedEmails: z.array(z.string().max(200)).max(200).optional(),
});

export async function POST(req: Request) {
  const email = await requireSessionEmail();
  if (!email) return Response.json({ error: "Not signed in" }, { status: 401 });

  const parsed = UpdateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const b = parsed.data;

  const current = readConfig();
  getDb()
    .prepare(
      `UPDATE business_config SET
         name = ?, logo_url = ?, points_per_dollar = ?, redemption_rules = ?, allowed_emails_json = ?, updated_at = ?
       WHERE id = 1`,
    )
    .run(
      b.name ?? current.name,
      b.logoUrl !== undefined ? b.logoUrl : current.logoUrl,
      b.pointsPerDollar ?? current.pointsPerDollar,
      b.redemptionRules ?? current.redemptionRules,
      JSON.stringify(b.allowedEmails ?? current.allowedEmails),
      new Date().toISOString(),
    );

  return Response.json({ ok: true, config: readConfig() });
}
