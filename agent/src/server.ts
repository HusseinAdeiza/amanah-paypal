import express from "express";
import { config } from "./lib/config.js";
import { initSchema, run, all, get } from "./lib/db.js";
import { makeMoneyProvider } from "./money/index.js";
import { makeIpfsClient } from "@amanah/receipts";
import { RulesEngine } from "./rules/index.js";
import { AuditTrail } from "./audit/index.js";
import { processDonation } from "./intake/index.js";
import { reason } from "./ai/reasoner.js";

async function main() {
  await initSchema();
  const provider = makeMoneyProvider();
  const ipfs = makeIpfsClient(config.ipfs.provider, { pinataJwt: config.ipfs.pinataJwt });
  const rules = new RulesEngine("./rules.yaml");
  const audit = new AuditTrail(ipfs);

  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => { res.set("Access-Control-Allow-Origin", "*"); res.set("Access-Control-Allow-Headers", "Content-Type"); next(); });

  app.get("/api/state", async (_req, res) => {
    res.json({ provider: provider.name(), dryRun: config.dryRun, treasuryUsd: await provider.getTreasuryUsd(), guardrails: config.guardrails, summary: await audit.getTreasurySummary() });
  });
  app.get("/api/proposals", async (_req, res) => res.json(await rules.getAllProposals()));
  app.get("/api/receipts", async (_req, res) => res.json(await audit.getChain()));
  app.get("/api/verify", async (_req, res) => res.json(await audit.verifyLocalChain()));

  // Donation intake (sandbox/mock). Real deployment would use PayPal webhooks.
  app.post("/api/donate", async (req, res) => {
    const { donorRef, amountUsd } = req.body ?? {};
    if (!donorRef || !(amountUsd > 0)) return res.status(400).json({ error: "donorRef and positive amountUsd required" });
    try { const r = await processDonation(provider, ipfs, audit, { donorRef, amountUsd }); res.json(r); }
    catch (e) { res.status(500).json({ error: String(e) }); }
  });

  // Run the AI reasoner + rules without moving money.
  app.post("/api/evaluate", async (_req, res) => {
    const treasury = await provider.getTreasuryUsd();
    const programs = (await all<{ name: string; budget_usd: number; spent_usd: number }>("SELECT * FROM programs WHERE status='active'")).map((r) => ({ name: r.name, budgetUsd: r.budget_usd, spentUsd: r.spent_usd }));
    const verdict = await reason({ treasuryUsd: treasury, minReserveUsd: config.guardrails.minReserveUsd, maxSinglePayoutUsd: config.guardrails.maxSinglePayoutUsd, programs, pendingProposals: (await rules.getPendingProposals()).length, recentDonations: [] });
    const proposals = await rules.evaluate(treasury, programs, config.guardrails.minReserveUsd);
    res.json({ verdict, proposals });
  });

  // The human gate — the ONLY endpoint that can move money.
  app.post("/api/proposals/:id/confirm", async (req, res) => {
    const id = Number(req.params.id);
    const by = (req.body?.confirmedBy as string) ?? "api-operator";
    try { const r = await rules.confirmProposal(id, provider, ipfs, by, config.dryRun); res.json(r); }
    catch (e) { res.status(400).json({ error: String(e) }); }
  });
  app.post("/api/proposals/:id/reject", async (req, res) => {
    try { res.json(await rules.rejectProposal(Number(req.params.id), (req.body?.reason as string) ?? "no reason")); }
    catch (e) { res.status(400).json({ error: String(e) }); }
  });

  // Seed a couple of programs so the demo has targets (idempotent-ish for demo).
  const seed = async () => {
    const c = await get<{ c: number }>("SELECT COUNT(*) c FROM programs");
    if ((c?.c ?? 0) === 0) {
      await run("INSERT INTO programs (name, budget_usd, spent_usd) VALUES ('Education', 8000, 1000)");
      await run("INSERT INTO programs (name, budget_usd, spent_usd) VALUES ('Health', 5000, 4000)");
    }
  };
  await seed();

  app.listen(config.port, () => console.log(`Amanah agent API on http://localhost:${config.port} (dryRun=${config.dryRun})`));
}
main().catch((e) => { console.error(e); process.exit(1); });
