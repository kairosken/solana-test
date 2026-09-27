import { getDb } from "../src/lib/db";
import { createCustomerWallet, createLoyaltyMint, walletSecretJson, awardPoints } from "../src/lib/solana";

// Real Devnet setup: creates a genuine SPL token mint and genuine customer wallets, funded via
// the public Devnet faucet. Idempotent — safe to re-run; skips anything already set up.

async function main() {
  const db = getDb();

  const existing = db.prepare(`SELECT id, mint_address FROM business_config WHERE id = 1`).get() as
    | { id: number; mint_address: string | null }
    | undefined;

  if (!existing) {
    db.prepare(
      `INSERT INTO business_config (id, name, logo_url, points_per_dollar, redemption_rules, allowed_emails_json, updated_at)
       VALUES (1, ?, NULL, 1, ?, ?, ?)`,
    ).run(
      "Kopi Corner",
      "100 points = $1 off your next order. Points never expire.",
      JSON.stringify(["kairossolutions.co"]),
      new Date().toISOString(),
    );
    console.log("Seeded business_config: Kopi Corner");
  }

  const cfg = db.prepare(`SELECT mint_address FROM business_config WHERE id = 1`).get() as { mint_address: string | null };
  if (!cfg.mint_address) {
    console.log("Creating Devnet SPL loyalty-token mint (this airdrops SOL and can take a few seconds)…");
    const { mintAddress } = await createLoyaltyMint();
    console.log("Mint created:", mintAddress);
  } else {
    console.log("Mint already set up:", cfg.mint_address);
  }

  const customerCount = (db.prepare(`SELECT COUNT(*) AS n FROM customers`).get() as { n: number }).n;
  if (customerCount === 0) {
    const demoNames = ["Alex Tan", "Priya Nair", "Marcus Lee"];
    for (const name of demoNames) {
      console.log(`Creating Devnet wallet for ${name}…`);
      const kp = await createCustomerWallet();
      const result = db
        .prepare(`INSERT INTO customers (display_name, wallet_pubkey, wallet_secret_json, created_at) VALUES (?, ?, ?, ?)`)
        .run(name, kp.publicKey.toBase58(), walletSecretJson(kp), new Date().toISOString());
      const customerId = Number(result.lastInsertRowid);

      const startingPoints = 100 + Math.floor(Math.random() * 400);
      console.log(`  awarding ${startingPoints} starting points (real Devnet mint)…`);
      const sig = await awardPoints(customerId, startingPoints);
      db.prepare(`INSERT INTO ledger (customer_id, kind, points, dollar_amount, tx_signature, created_at) VALUES (?, 'award', ?, ?, ?, ?)`).run(
        customerId,
        startingPoints,
        Number((startingPoints / 1).toFixed(2)),
        sig,
        new Date().toISOString(),
      );
      console.log(`  ${name}: ${kp.publicKey.toBase58()} — tx ${sig}`);
    }
  } else {
    console.log(`${customerCount} demo customers already exist — skipping.`);
  }

  console.log("\nSeed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
