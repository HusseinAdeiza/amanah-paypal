# Amanah — Autonomous, Auditable Treasury Agent for Charities

**PayPal AI Hackathon 2026** · An AI agent that guards a charity's money: it receives
donations through PayPal, an AI reasoner decides *whether and how much* to disburse to
programs under hard guardrails, a human approves every payout, and every single event is
written to a **hash-chained, IPFS-pinnable audit trail** anyone can verify.

> The core safety idea: **the AI recommends, the rules constrain, but money only moves
> when a human confirms — and every movement is provable.** No autonomous transfer, ever.

## 🔗 Try it live (no setup)

**Live demo:** https://arnold-incurred-based-survival.trycloudflare.com

Open it in any browser — the dashboard and API run together on one service, no keys or
install needed. It runs in **DRY-RUN** mode (simulated PayPal, real mechanics), so it's
safe to click through. Try this:

1. **Donate** — enter a donor name + amount, click **Receive**. Watch the treasury climb
   and a new row appear in the audit trail.
2. **Run AI + rules** — click it. The AI reasoner evaluates the treasury against program
   budgets and a reserve floor, and the rules engine files **proposals** (with reasons).
   Nothing moves yet.
3. **Confirm & pay** — click it on a proposal. This is the **only** path that executes a
   payout. Watch the proposal flip to *executed* and a new receipt land in the chain.
4. **Verify** — the audit trail is hash-chained; every receipt links to the previous one.

*(The tunnel URL is ephemeral — if it's down, run it locally with the 3 commands below.)*

---

## The 30-second version

1. Donations arrive → captured as PayPal orders (or simulated in dry-run).
2. An **AI reasoner** evaluates the treasury against program budgets and reserve floors,
   and recommends a disbursement — capped by code-enforced guardrails it cannot override.
3. Declarative **protection rules** (YAML) turn that into concrete **proposals**.
4. A **human gate** is the only path that executes a payout. Confirm or reject.
5. Every step is a **receipt**, SHA-256 linked to the previous, pinned to IPFS. The chain
   verifies itself: tamper with any receipt and verification fails at that index.

## Why this is genuinely "PayPal + AI" (not a relabel)

- **PayPal is load-bearing.** Donations come in via PayPal Orders; disbursements go out
  via PayPal Payouts. The `MoneyProvider` seam has a real PayPal sandbox implementation
  and a mock for zero-setup demos. PayPal moves the money; Amanah decides *when* and
  *proves* it.
- **AI is load-bearing.** The reasoner picks the target program and amount from live
  treasury/budget state. Remove the AI and the agent can't decide *what* to disburse —
  it would only be a rules engine. (Heuristic fallback keeps demos running with no key,
  but the LLM path is the real one.)

## Features mapped to the judging criteria

| Criterion | How Amanah satisfies it |
|---|---|
| **Technological Implementation** | Real PayPal Orders + Payouts (sandbox), typed TS monorepo, SQLite ledger, OpenAI-compatible LLM reasoner with code-enforced guardrails, IPFS receipt pinning (Pinata). Runs end-to-end in dry-run with zero keys. |
| **Design** | One clear screen: treasury value, live proposals with reasons, and the hash-chain audit trail. Dark dashboard, `pnpm run dev`. |
| **Potential Impact** | Grassroots charities/NGOs lose donor trust to opaque, manual books and staff can't guard against volatility/error. Amanah gives a tiny org an auditable, human-supervised treasury agent for the cost of a PayPal account. |
| **Innovation/Idea** | The differentiator is the **confirm-before-execute + hash-chained receipts** combination: an agent that is *structurally forbidden* from moving money without a human, and that leaves a tamper-evident trail a donor can verify independently. |
| **Presentation** | `pnpm run demo` prints the whole loop in ~10s with a real, verifiable hash-chain. `docs/demo-script.md` narrates it. |

## Architecture

```
Donors ──► PayPal Orders (capture) ──►┐
                                       ├─► Amanah Agent (Node/TS)
Programs ◄── PayPal Payouts ◄── Human gate (confirm/reject)
                                       │        ▲
                    AI Reasoner ────────┤        │ (proposals, never auto-execute)
                    Rules Engine (YAML) ┘        │
                    Hash-chained receipts ──► IPFS (Pinata) ──► public verify
```

- `receipts/` — hash-chain + IPFS clients (the audit spine)
- `agent/src/money/` — `MoneyProvider` seam: `paypal.ts` (real sandbox) + `mock.ts` (demos)
- `agent/src/ai/reasoner.ts` — the load-bearing AI, guardrail-capped
- `agent/src/rules/` — declarative protection rules → proposals
- `agent/src/server.ts` — read-only API + the ONLY money-moving endpoint (`/api/proposals/:id/confirm`)
- `web/` — React dashboard

## Security model

- **Human-in-the-loop:** the only endpoint that pays is `POST /api/proposals/:id/confirm`,
  with a required `confirmedBy`. No autonomous payout path exists.
- **Guardrails in code, not prompts:** `maxSinglePayoutUsd` and `minReserveUsd` clamp the
  AI's suggestion in `reasoner.ts` — the model cannot exceed them.
- **Dry-run by default:** `DRY_RUN=true` (no keys) simulates the entire pipeline. Real
  execution needs `DRY_RUN=false` + PayPal sandbox creds, and *still* requires human confirm.
- **Keys via `.env`** only, never committed. See `.env.example`.
- **Tamper-evident audit:** each receipt's hash covers the previous hash; `verifyChain`
  fails closed at the first tampered receipt.

## Setup (runs with zero keys)

```bash
pnpm install
pnpm run build
pnpm run demo          # full loop in ~10s, dry-run, no keys needed
# single service (API + dashboard on one port):
pnpm --filter @amanah/agent run dev   # http://localhost:4000
```

The agent serves the built dashboard from the same port, so `pnpm --filter @amanah/agent
run dev` is all you need — API and UI together on :4000.

To go live (PayPal sandbox): copy `.env.example` to `agent/.env`, set
`PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET` and `DRY_RUN=false`. Get sandbox creds at
developer.paypal.com (5 min). Optional: `PINATA_JWT` for real IPFS pinning, and
`AI_BASE_URL`/`AI_API_KEY`/`AI_MODEL` for the live LLM reasoner.

## What is real vs simulated in the default demo

| Component | Default (dry-run) | With keys |
|---|---|---|
| Donation capture | Simulated PayPal order id | Real PayPal Orders (sandbox) |
| Payout | Simulated | Real PayPal Payouts (sandbox) |
| AI reasoner | Deterministic heuristic | Real LLM (OpenAI-compatible) |
| Receipts / hash-chain | Real (SHA-256, in-memory IPFS) | Real + Pinata-pinned |
| Human gate | Enforced | Enforced |

The hash-chain, the guardrails, and the human gate are real in every mode.

## License

MIT.
