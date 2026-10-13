import { initSchema, run, all, get } from "./lib/db.js";
import { logger } from "./lib/logger.js";
import { config } from "./lib/config.js";
import { makeMoneyProvider } from "./money/index.js";
import { makeIpfsClient } from "@amanah/receipts";
import { RulesEngine } from "./rules/index.js";
import { AuditTrail } from "./audit/index.js";
import { processDonation } from "./intake/index.js";
import { reason } from "./ai/reasoner.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const banner = (t: string) => console.log(`\n${"=".repeat(64)}\n  ${t}\n${"=".repeat(64)}`);

async function runDemo() {
  banner("AMANAH — Autonomous Treasury Agent for Charities (PayPal + AI)");
  console.log(`  mode: ${config.dryRun ? "DRY-RUN (no keys, no real money)" : "LIVE"}`);
  await initSchema();

  // Seed programs so the AI reasoner + rules have real disbursement targets.
  const pc = await get<{ c: number }>("SELECT COUNT(*) c FROM programs");
  if ((pc?.c ?? 0) === 0) {
    await run("INSERT INTO programs (name, budget_usd, spent_usd) VALUES ('Education', 8000, 1000)");
    await run("INSERT INTO programs (name, budget_usd, spent_usd) VALUES ('Health', 5000, 4800)");
    console.log("  (seeded demo programs: Education $8k budget, Health $5k budget)");
  }

  const provider = makeMoneyProvider();
  const ipfs = makeIpfsClient(config.ipfs.provider, { pinataJwt: config.ipfs.pinataJwt });
  const rules = new RulesEngine("./rules.yaml");
  const audit = new AuditTrail(ipfs);

  console.log("\n[1] Treasury state:");
  let treasury = await provider.getTreasuryUsd();
  console.log(`    Provider: ${provider.name()}   Treasury: $${treasury.toFixed(2)}`);

  console.log("\n[2] Donations arrive (PayPal orders captured):");
  const donations = [
    { donorRef: "donor-alpha", amountUsd: 500 },
    { donorRef: "donor-beta", amountUsd: 250 },
    { donorRef: "donor-gamma", amountUsd: 1200 },
  ];
  for (const d of donations) {
    const res = await processDonation(provider, ipfs, audit, d);
    console.log(`    ✓ $${d.amountUsd} from ${d.donorRef} → order ${res.orderId} · receipt ${res.receiptCid.slice(0, 20)}...`);
    await sleep(150);
  }
  treasury = await provider.getTreasuryUsd();
  console.log(`    Treasury now: $${treasury.toFixed(2)}`);

  console.log("\n[3] AI reasoner evaluates disbursement (load-bearing AI):");
  const programs = (await all<{ name: string; budget_usd: number; spent_usd: number }>("SELECT * FROM programs WHERE status='active'")).map((r) => ({ name: r.name, budgetUsd: r.budget_usd, spentUsd: r.spent_usd }));
  const recent = (await all<{ amount: string; donor_ref: string }>("SELECT * FROM donations ORDER BY id DESC LIMIT 5")).map((r) => ({ amountUsd: Number(r.amount), donorRef: r.donor_ref }));
  const verdict = await reason({ treasuryUsd: treasury, minReserveUsd: config.guardrails.minReserveUsd, maxSinglePayoutUsd: config.guardrails.maxSinglePayoutUsd, programs, pendingProposals: (await rules.getPendingProposals()).length, recentDonations: recent });
  console.log(`    source=${verdict.source}  recommend=${verdict.recommendDisbursement}  program=${verdict.targetProgram ?? "-"}  amount=${verdict.suggestedAmountUsd ? "$" + verdict.suggestedAmountUsd.toFixed(2) : "-"}`);
  console.log(`    rationale: ${verdict.rationale}`);

  console.log("\n[4] Protection rules evaluate → proposals (NOT auto-sent):");
  const proposals = await rules.evaluate(treasury, programs, config.guardrails.minReserveUsd);
  for (const p of proposals) console.log(`    - #${p.id} ${p.toProgram} ← $${p.usdEstimate.toFixed(2)} (${p.reason})`);
  if (proposals.length === 0) console.log("    (none triggered)");

  const pending = await rules.getPendingProposals();
  console.log("\n[5] Human gate — operator confirms proposal #" + (pending[0]?.id ?? "n/a") + ":");
  if (pending.length > 0) {
    const confirmed = await rules.confirmProposal(pending[0].id, provider, ipfs, "operator-sam", config.dryRun);
    console.log(`    ✓ confirmed & ${config.dryRun ? "simulated" : "executed"} → receipt ${confirmed.receiptCid.slice(0, 20)}...`);
  }

  console.log("\n[6] Audit trail — hash-chained receipts:");
  const chain = await audit.getChain();
  for (const e of chain) console.log(`    ${e.eventType.padEnd(22)} ${e.hash.slice(0, 16)}... ← ${(e.previousHash ?? "genesis").slice(0, 16)}`);
  const v = await audit.verifyLocalChain();
  console.log(`    Chain integrity: ${v.valid ? "✓ VALID" : "✗ INVALID at " + v.firstInvalidIndex}`);

  console.log("\n[7] Summary:");
  const summary = await audit.getTreasurySummary();
  console.log(`    Donations: $${summary.totalDonationsUsd.toFixed(2)}  Proposals: ${summary.totalProposals} (${summary.pendingProposals} pending, ${summary.executedProposals} executed)`);
  console.log(`    Treasury remaining: $${(await provider.getTreasuryUsd()).toFixed(2)}`);

  banner("DEMO COMPLETE — money only moved through the human-confirmed gate");
  console.log("\nNext: `pnpm run dev` → dashboard http://localhost:5173 · `pnpm run cli` for REPL\n");
}

runDemo().catch((err) => { logger.error({ err }, "Demo failed"); process.exit(1); });
