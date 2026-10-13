# Amanah demo script (~60–90 seconds narrated)

**Run:** `pnpm install && pnpm run build && pnpm run demo` (no keys needed).

1. **Hook (0:00–0:10).** "Charities take crypto and cash donations, but small NGOs have
   no treasury staff and donors don't trust manual books. Amanah is an AI agent that
   guards the money — it recommends, a human approves, and every move is provable."

2. **Donations in (0:10–0:25).** Point at [2]: three donations captured, each with an
   order id and a receipt id. "Money comes in through PayPal. Nothing is trusted."

3. **The AI decides (0:25–0:40).** Point at [3]: the AI reasoner recommends disbursing
   $5,000 to Education, capped by the reserve floor and single-payout cap. "The AI picks
   the program and the amount — but it cannot exceed the guardrails we set in code."

4. **Proposals, not payments (0:40–0:55).** Point at [4] and [5]: rules generate
   proposals; the operator confirms one. "The agent cannot move money on its own. A
   human confirms, and only then does it execute."

5. **The proof (0:55–1:15).** Point at [6]: the hash-chained trail, ending in
   "Chain integrity: ✓ VALID". "Every event is linked to the one before it and pinned to
   IPFS. Tamper with any line and verification fails. A donor can check this themselves."

6. **Close (1:15–1:25).** "PayPal moves the money, AI decides when, humans approve, and
   the audit trail proves it. That's Amanah."
