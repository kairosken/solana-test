# ksolana — Solana Loyalty App (prototype)

A clickable, presentable demo of a Solana-based loyalty program: an Admin Console for a
business to configure their program, plus web-based previews of the Customer and Merchant
mobile apps. Hosted at **ksolana.ksol.ai**. See the original brief for the product intent.

**This is a prototype, but the blockchain part is completely real** — every award/redeem is a
genuine, confirmed transaction on Solana **Devnet** (a free public test network, identical
mechanics to mainnet, no real money at risk), verifiable on
[Solana Explorer](https://explorer.solana.com/?cluster=devnet). See
[`docs/on-chain-model.md`](docs/on-chain-model.md) for exactly how wallet custody, fee payment
and the public/private split work.

## Run it

Needs Node 22.5+ (24 recommended, for `node:sqlite`).

```bash
npm install
cp .env.example .env
#   KS_WALLET_ENCRYPTION_KEY=<output of: openssl rand -hex 32>
#   SMTP_* — reuses the same Office 365 sender already working for kfleet's OTP emails
npm run seed     # creates the Devnet SPL mint + 3 demo customer wallets (real, on-chain)
npm run dev      # http://localhost:3000
```

Sign in to the Admin Console with an email on the allowlist (seeded to `kairossolutions.co` by
default — edit in Settings once signed in, or in `scripts/seed.ts` before first run).

## What's built

- **Admin Console** (`/`) — business name/logo/points-rate/redemption-rules setup, live stats
  (customers, points awarded/redeemed, transactions), links to launch the two app previews.
- **Settings** (`/settings`) — the allowed sign-in emails/domains, admin-editable.
- **Customer App preview** — phone-frame overlay from the Admin Console (like kfleet's mobile
  app previews): pick a demo customer, see their real on-chain balance, transaction history
  (each linking to a real Explorer transaction), and a QR code identifying their account.
- **Merchant App preview** — same phone-frame pattern: pick a customer (standing in for a QR
  scan, since there's no camera here), award points for a dollar amount or redeem points —
  both are real Devnet transactions, confirmed and shown with their signature.
- **How It Works** (`/how-it-works`) — the on-chain-proof page: the most recent real
  transaction plus the public/private security & privacy explanation.

Auth is email + OTP (no password), restricted to an admin-configurable allowlist — the Admin
Console is the one thing behind real login. The Customer/Merchant previews use a demo picker
instead (same convention as kfleet's mobile-app previews), since they're demonstrating what the
real app would show, not re-implementing customer self-signup in a prototype shell.

## Stack

Next.js 16 (App Router) + React 19 + TypeScript, `node:sqlite`, Tailwind v4. `@solana/web3.js` +
`@solana/spl-token` for the real Devnet integration. Single Docker container (`output:
"standalone"`), bound to `127.0.0.1:3400` behind an externally-managed nginx + Let's Encrypt
reverse proxy (not Caddy — unlike KFastTrack, TLS termination lives outside this box).

## Deploying

```bash
docker compose build
docker compose up -d
```

Data (SQLite + the encrypted wallet keys) lives in `./data`, bind-mounted so it survives
rebuilds. Run `npm run seed` **on the host** (not inside the container) before first start, so
`./data/app.db` exists before the container's volume mount picks it up.
