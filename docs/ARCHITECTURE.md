# Amanah architecture

## The seam: MoneyProvider

The old build was locked to Binance MCP. The rebuild generalizes the boundary to a
`MoneyProvider` interface (`agent/src/money/types.ts`):

```ts
interface MoneyProvider {
  name(): string;
  getTreasuryUsd(): Promise<number>;
  receiveDonation(input): Promise<DonationResult>;
  payout(input): Promise<PayoutResult>;
}
```

Two implementations: `PayPalProvider` (real sandbox: OAuth → Orders → Payouts) and
`MockMoneyProvider` (in-memory, deterministic, zero keys). The rules engine, reasoner,
confirm-gate, and receipts never touch provider specifics — so swapping in Stripe, a
bank API, or a testnet is a one-file change.

## The safety invariant

Money moves on exactly one code path: `RulesEngine.confirmProposal` → (dry-run check) →
`provider.payout`. Everything else produces *proposals*. The AI reasoner's output is
clamped by `config.guardrails` before it can become a proposal. There is no endpoint,
no cron, and no code path that calls `provider.payout` without passing through the human
confirm step.

## The audit spine

`receipts/` implements a hash chain: each receipt's SHA-256 covers its own fields plus
`previousHash`. `verifyChain` checks each receipt's self-hash and the link to its
predecessor, failing at the first break. Receipts are pinned to IPFS (Pinata) so the
chain is verifiable off-box. This is provider-agnostic and unchanged across the rebuild.
