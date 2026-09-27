# On-chain model

This is a real Solana Devnet integration — every award and redeem is a genuine, confirmed
transaction, verifiable on [Solana Explorer](https://explorer.solana.com/?cluster=devnet).
Nothing about the blockchain part is simulated; only the surrounding business app (auth, admin
config, demo customer picker) is prototype-scoped.

## Two layers, on purpose

- **On-chain (public, tamper-proof):** wallet address X received or redeemed Y points at
  timestamp Z. Anyone can independently verify this happened and hasn't been altered.
- **Off-chain (private, in our SQLite database):** the mapping of "this wallet = this customer"
  lives only in `customers.email` / `customers.display_name`, never published on-chain. A
  Solana wallet address alone doesn't reveal a name or identity — that's what makes "secure
  ledger" and "privacy-preserving" both true at once, not a trade-off.

## Wallet custody: backend-managed keypairs

Per the brief's locked decision, this prototype generates and holds each customer's Devnet
keypair itself (`src/lib/solana.ts`, `createCustomerWallet`), encrypted at rest with
AES-256-GCM (`src/lib/crypto.ts`, key from `KS_WALLET_ENCRYPTION_KEY`). The customer never sees
a wallet, a seed phrase, or the word "Solana" — their login is their identity; the wallet is an
implementation detail. Revisit an embedded wallet provider (Privy, Dynamic, Web3Auth) only if
this becomes a real production product — the brief flags that as future work, not now.

## One fee payer, not one airdrop per wallet

A customer wallet holds **zero SOL**. Every transaction names the mint authority keypair as the
fee payer, and only asks the customer's own keypair to *sign* where that's the actual point —
burning their own tokens on redeem. Solana transactions support a distinct fee payer from other
signers, so this works cleanly:

| Action | Fee payer | Must also sign |
|---|---|---|
| Create the loyalty mint (once, at seed time) | mint authority | mint authority (as the new mint's authority) |
| Award points (mint to customer) | mint authority | mint authority (as mint authority) — **not** the customer |
| Redeem points (burn from customer) | mint authority | the customer's own keypair (proves *they* authorised it) |

This means only **one** keypair ever needs a Devnet SOL airdrop for the whole app — the mint
authority, funded once at `scripts/seed.ts` time. It also happens to match how a real production
version should work anyway: customers never think about gas fees, because the business (or a
paymaster) always covers them.

## Devnet faucet reality

The public Devnet faucet (`https://api.devnet.solana.com`'s `requestAirdrop` method) is shared
across every developer testing on Devnet globally, and is frequently rate-limited (`429`) or
briefly down. `airdropIfNeeded` in `src/lib/solana.ts` retries patiently (widely-spaced, not a
tight loop) since this congestion is normally transient. If it's persistently unavailable during
a live demo, set `KS_SOLANA_RPC` to a dedicated Devnet RPC provider (Helius, QuickNode, etc. all
offer free Devnet tiers with their own faucet allowances), or fund the mint authority's address
manually via the web UI at https://faucet.solana.com (higher limits, captcha-gated) and re-run
the seed script — it's idempotent and will pick up the funded balance.

## SPL token, not a custom on-chain program

Points are a standard **SPL fungible token** (the same token standard USDC uses) — no custom
Solana program (smart contract) was written or deployed. Awarding = minting or transferring the
token; redeeming = burning it. This is deliberate for a prototype: it's the simplest correct way
to represent "points" on-chain, reuses Solana's own well-audited token program, and is exactly
what "Suggested Build Order" step 1 in the brief calls for ("Devnet SPL loyalty-token program" —
meaning *use* the SPL Token program, not write a new one).
