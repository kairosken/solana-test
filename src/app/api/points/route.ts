import { z } from "zod";
import { getDb } from "@/lib/db";
import { awardPoints, explorerUrl, getPointsBalance, redeemPoints } from "@/lib/solana";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const customerId = Number(url.searchParams.get("customerId"));
  if (!customerId) return Response.json({ error: "customerId required" }, { status: 400 });

  const balance = await getPointsBalance(customerId);
  const history = getDb()
    .prepare(`SELECT kind, points, dollar_amount, tx_signature, merchant_note, created_at FROM ledger WHERE customer_id = ? ORDER BY id DESC LIMIT 25`)
    .all(customerId) as { kind: string; points: number; dollar_amount: number | null; tx_signature: string; merchant_note: string | null; created_at: string }[];

  return Response.json({
    balance,
    history: history.map((h) => ({
      kind: h.kind,
      points: h.points,
      dollarAmount: h.dollar_amount,
      signature: h.tx_signature,
      explorerUrl: explorerUrl(h.tx_signature),
      note: h.merchant_note,
      at: h.created_at,
    })),
  });
}

const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("award"), customerId: z.number().int().positive(), dollarAmount: z.number().positive().max(100000) }),
  z.object({ action: z.literal("redeem"), customerId: z.number().int().positive(), points: z.number().positive().max(1_000_000) }),
]);

export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const body = parsed.data;

  try {
    if (body.action === "award") {
      const rateRow = getDb().prepare(`SELECT points_per_dollar FROM business_config WHERE id = 1`).get() as { points_per_dollar: number };
      const points = Math.round(body.dollarAmount * rateRow.points_per_dollar);
      const signature = await awardPoints(body.customerId, points);
      getDb()
        .prepare(`INSERT INTO ledger (customer_id, kind, points, dollar_amount, tx_signature, created_at) VALUES (?, 'award', ?, ?, ?, ?)`)
        .run(body.customerId, points, body.dollarAmount, signature, new Date().toISOString());
      return Response.json({ ok: true, points, signature, explorerUrl: explorerUrl(signature) });
    }

    const signature = await redeemPoints(body.customerId, body.points);
    getDb()
      .prepare(`INSERT INTO ledger (customer_id, kind, points, dollar_amount, tx_signature, created_at) VALUES (?, 'redeem', ?, NULL, ?, ?)`)
      .run(body.customerId, body.points, signature, new Date().toISOString());
    return Response.json({ ok: true, points: body.points, signature, explorerUrl: explorerUrl(signature) });
  } catch (e: any) {
    console.error("points action failed:", e);
    return Response.json({ error: e?.message ?? "Solana transaction failed." }, { status: 500 });
  }
}
