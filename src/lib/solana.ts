import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  burn,
  getAccount,
} from "@solana/spl-token";
import { getDb } from "./db";
import { decryptSecret, encryptSecret } from "./crypto";

// Everything here talks to Solana Devnet — a free public test network with identical
// mechanics to mainnet, but the tokens have no real value. Every award/redeem is a real,
// confirmed on-chain transaction you can look up on a public explorer; nothing here is
// simulated. See docs/on-chain-model.md for the public/private split this relies on.

const DEVNET_RPC = process.env.KS_SOLANA_RPC?.trim() || clusterApiUrl("devnet");
const DECIMALS = 0; // points are whole numbers

let connection: Connection | null = null;
export function getConnection(): Connection {
  if (!connection) connection = new Connection(DEVNET_RPC, "confirmed");
  return connection;
}

export function explorerUrl(signatureOrAddress: string, kind: "tx" | "address" = "tx"): string {
  return `https://explorer.solana.com/${kind}/${signatureOrAddress}?cluster=devnet`;
}

function keypairFromJson(json: string): Keypair {
  const secret = decryptSecret(json);
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function keypairToJson(kp: Keypair): string {
  return encryptSecret(Array.from(kp.secretKey));
}

/** Requests a Devnet SOL airdrop (free faucet) so a fresh keypair can pay transaction fees.
 * The public faucet is shared and rate-limited, so "Internal error" is common under load —
 * retried with backoff rather than treated as fatal on the first failure. */
async function airdropIfNeeded(pubkey: PublicKey, minLamports = 1_000_000_000): Promise<void> {
  const conn = getConnection();
  const balance = await conn.getBalance(pubkey);
  if (balance >= minLamports) return;

  // Only the mint authority ever needs this (see createCustomerWallet/redeemPoints), so it's a
  // one-time cost — patient, widely-spaced retries rather than a tight loop that itself looks
  // like abuse to the shared public faucet.
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const sig = await conn.requestAirdrop(pubkey, minLamports);
      await conn.confirmTransaction(sig, "confirmed");
      return;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 15_000));
    }
  }
  throw new Error(
    `Devnet faucet airdrop failed after retries — the public faucet is rate-limited/shared. ` +
      `Set KS_SOLANA_RPC to a dedicated Devnet RPC provider, or fund ${pubkey.toBase58()} manually at https://faucet.solana.com. Last error: ${lastErr}`,
  );
}

export interface MintAuthorityInfo {
  mintAddress: string;
  authorityKeypair: Keypair;
}

/** One-time setup (run by scripts/seed.ts): creates the SPL token mint for loyalty points.
 * Persists the authority keypair *before* attempting the airdrop, not after — so if the
 * public faucet is out of quota (a real, common failure — see docs/on-chain-model.md), a
 * re-run (or a manual fund-then-retry) reuses the same address instead of generating and
 * silently discarding a new throwaway keypair on every failed attempt. */
export async function createLoyaltyMint(): Promise<MintAuthorityInfo> {
  const conn = getConnection();
  const db = getDb();

  const existing = db.prepare(`SELECT mint_authority_json FROM business_config WHERE id = 1`).get() as
    | { mint_authority_json: string | null }
    | undefined;
  let authority: Keypair;
  if (existing?.mint_authority_json) {
    authority = keypairFromJson(existing.mint_authority_json);
    console.log("Reusing previously-generated mint authority:", authority.publicKey.toBase58());
  } else {
    authority = Keypair.generate();
    db.prepare(`UPDATE business_config SET mint_authority_json = ? WHERE id = 1`).run(keypairToJson(authority));
    console.log("Generated new mint authority:", authority.publicKey.toBase58(), "— fund this address if the airdrop below fails.");
  }

  await airdropIfNeeded(authority.publicKey, 1_000_000_000);
  const mint = await createMint(conn, authority, authority.publicKey, authority.publicKey, DECIMALS);
  db.prepare(`UPDATE business_config SET mint_address = ? WHERE id = 1`).run(mint.toBase58());
  return { mintAddress: mint.toBase58(), authorityKeypair: authority };
}

function loadMintAuthority(): { mint: PublicKey; authority: Keypair } {
  const row = getDb().prepare(`SELECT mint_address, mint_authority_json FROM business_config WHERE id = 1`).get() as
    | { mint_address: string | null; mint_authority_json: string | null }
    | undefined;
  if (!row?.mint_address || !row.mint_authority_json) {
    throw new Error("Loyalty token mint isn't set up yet — run the seed script first.");
  }
  return { mint: new PublicKey(row.mint_address), authority: keypairFromJson(row.mint_authority_json) };
}

/** Creates a new backend-managed customer wallet (a Devnet keypair). No airdrop needed — the
 * mint authority acts as fee payer on every transaction, so a customer wallet only ever needs
 * to be *able to sign*, never to hold any SOL itself. This also matches how a real production
 * version should work: customers never think about gas. */
export async function createCustomerWallet(): Promise<Keypair> {
  return Keypair.generate();
}

export function walletSecretJson(kp: Keypair): string {
  return keypairToJson(kp);
}

/** Mints `points` loyalty tokens to a customer's associated token account — a real, confirmed
 * Devnet transaction. The mint authority both pays the fee and signs the mint; the customer's
 * own keypair isn't needed at all for an award. */
export async function awardPoints(customerId: number, points: number): Promise<string> {
  const conn = getConnection();
  const { mint, authority } = loadMintAuthority();
  const customer = getCustomer(customerId);
  const owner = new PublicKey(customer.wallet_pubkey);
  const ata = await getOrCreateAssociatedTokenAccount(conn, authority, mint, owner);
  const sig = await mintTo(conn, authority, mint, ata.address, authority, Math.round(points));
  return sig;
}

/** Burns `points` from the customer's own token account — a real, confirmed Devnet
 * transaction. The customer's own (backend-held) keypair signs to authorise the burn — that's
 * the part that has to be genuinely theirs — but the mint authority pays the network fee, so
 * the customer wallet needs zero SOL of its own. */
export async function redeemPoints(customerId: number, points: number): Promise<string> {
  const conn = getConnection();
  const { mint, authority } = loadMintAuthority();
  const customer = getCustomer(customerId);
  const customerKeypair = keypairFromJson(customer.wallet_secret_json);
  const ata = await getOrCreateAssociatedTokenAccount(conn, authority, mint, customerKeypair.publicKey);
  const sig = await burn(conn, authority, ata.address, mint, customerKeypair, Math.round(points));
  return sig;
}

/** Live on-chain balance for a customer — read straight from Devnet, not the local ledger
 * mirror, so what's shown is always exactly what the chain says. */
export async function getPointsBalance(customerId: number): Promise<number> {
  const conn = getConnection();
  const { mint, authority } = loadMintAuthority();
  const customer = getCustomer(customerId);
  const owner = new PublicKey(customer.wallet_pubkey);
  try {
    const ata = await getOrCreateAssociatedTokenAccount(conn, authority, mint, owner);
    const account = await getAccount(conn, ata.address);
    return Number(account.amount);
  } catch {
    return 0;
  }
}

function getCustomer(customerId: number): { wallet_pubkey: string; wallet_secret_json: string } {
  const row = getDb()
    .prepare(`SELECT wallet_pubkey, wallet_secret_json FROM customers WHERE id = ?`)
    .get(customerId) as { wallet_pubkey: string; wallet_secret_json: string } | undefined;
  if (!row) throw new Error("Customer not found.");
  return row;
}

export { DEVNET_RPC };
