# Amanah demo video — beat script (~95s, narrated)

Reference format: Explainer Cut — real screen capture of a real working app,
hard cuts between beats, narration over the capture, minimal motion design.
No fabricated UI, no simulated state presented as live — every number on screen
comes from the running agent.

## Beats

**B1 — Hook / problem (0:00–0:12)** · Dashboard, empty-ish state (treasury $12k, no proposals)
- VO: "Small charities take digital donations but have no finance staff and no way to
  prove the money went where it was promised. Amanah is an AI agent that guards the
  treasury — it recommends, a human approves, and every move is provable."
- On screen: dashboard hero, treasury card, DRY-RUN badge.

**B2 — Donations arrive (0:12–0:28)** · Trigger 3 donations via the UI; watch treasury climb
- VO: "Donations come in through PayPal. Each one is captured and written straight to
  the audit trail — nothing is trusted, everything is recorded."
- On screen: click "Receive" a few times; treasury value ticks up; audit trail gains rows.

**B3 — The AI decides (0:28–0:44)** · Click "Run AI + rules"; proposals appear with reasons
- VO: "An AI reasoner looks at the live treasury against each program's budget and a
  reserve floor, and recommends what to disburse — capped by guardrails set in code,
  not by asking the model nicely. The rules turn that into concrete proposals."
- On screen: proposal cards appear with the rationale text.

**B4 — Human gate (0:44–1:00)** · Click "Confirm & pay" on one proposal
- VO: "The agent cannot move money on its own. This confirm button is the only path
  that executes a payout — a human has to approve it, every time."
- On screen: click Confirm; proposal status flips to executed; new receipt row appears.

**B5 — The proof (1:00–1:20)** · Scroll to the audit trail; show the hash chain + verify
- VO: "Every event is a receipt, linked to the one before it and pinned to IPFS. Tamper
  with any line and the chain stops verifying. A donor can check this themselves — that's
  the whole point."
- On screen: hash-chain rows, each hash ← previous hash; final "integrity: valid".

**B6 — Close (1:20–1:32)** · Hold on dashboard
- VO: "PayPal moves the money. AI decides when. Humans approve. And the audit trail proves
  it. That's Amanah."
- On screen: full dashboard, DRY-RUN badge visible (honest scope).

## Honesty notes for the cut
- DRY-RUN badge stays visible throughout — the demo is real code, simulated money. Say so
  in the VO if asked; the mechanics (AI, rules, gate, hash-chain) are all real.
- Every number on screen is produced live by the running agent, not typed in.
