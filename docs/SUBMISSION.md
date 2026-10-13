# PayPal AI Hackathon — Submission Form Text (ready to paste)

**Project name:** Amanah

**One-line description (≤ ~120 chars):**
An AI agent that guards a charity's money: it receives PayPal donations, an AI decides
what to disburse under hard guardrails, a human approves every payout, and every move is
written to a tamper-evident, IPFS-pinned audit trail.

**Inspiration (problem):**
Grassroots charities and NGOs increasingly take digital donations, but the smallest ones
have no finance staff, no treasury discipline, and no way to prove to donors that money
went where it was promised. Manual books are error-prone and unauditable; "we'll just
watch the balance" fails the moment there's volatility, a mistake, or a skeptical donor.

**What it does:**
Amanah is an autonomous treasury guardian. Donations arrive as captured PayPal orders. An
AI reasoner evaluates live treasury value against program budgets and a reserve floor, and
recommends *whether and how much* to disburse — clamped by guardrails set in code, not by
asking the model nicely. Declarative protection rules turn that into concrete proposals.
A human confirms or rejects; **the confirm step is the only code path that can move money**.
Every event — donation, recommendation, proposal, confirmation, payout — is a SHA-256
receipt linked to the previous one and pinned to IPFS, so anyone can independently verify
the chain and detect any tampering.

**How we built it (PayPal + AI):**
- **PayPal is load-bearing:** donations in via PayPal Orders (checkout + capture),
  disbursements out via PayPal Payouts. A `MoneyProvider` seam has a real sandbox
  implementation and a zero-key mock, so the demo runs with no credentials.
- **AI is load-bearing:** the reasoner picks the target program and amount from live
  state. A deterministic heuristic fallback keeps the demo keyless, but the LLM path
  (any OpenAI-compatible endpoint) is the real one. Guardrails (`maxSinglePayoutUsd`,
  `minReserveUsd`) are enforced in code after the model responds.
- **Audit spine:** a hash-chained receipt ledger (SQLite) with IPFS pinning (Pinata).
  `verifyChain` fails closed at the first tampered receipt.
- Stack: TypeScript monorepo (pnpm), Node/Express API, React + Vite dashboard, SQLite.

**What we learned:**
The hard part wasn't the AI or the payments — it was making the agent *safe by
construction*. The model must never be trusted to move money, so the human gate is the
only execution path and the guardrails live in code, not in a prompt. That constraint is
what makes an autonomous agent deployable by an organization that can't afford a finance
team or a security incident.

**Tools / AI used:**
OpenAI-compatible LLM (reasoner, guardrail-capped); PayPal Developer Platform (Orders,
Payouts, sandbox); IPFS/Pinata (receipt pinning); TypeScript/Node/React/SQLite.

**Repo:** https://github.com/HusseinAdeiza/amanah-paypal
**Run it (zero keys):** `pnpm install && pnpm run build && pnpm run demo`
