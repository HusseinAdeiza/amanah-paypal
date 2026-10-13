import { readFileSync } from "fs";
import { parse } from "yaml";
import { z } from "zod";
import { createReceipt, type IpfsClient } from "@amanah/receipts";
import { run, get, all } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { RulesConfigSchema, type Rule } from "./schema.js";

export interface Proposal {
  id: number; ruleId: string; action: string; toProgram: string;
  amount: string; usdEstimate: number; reason: string;
  status: "pending" | "confirmed" | "rejected" | "executed";
}

function mapProposalRow(row: Record<string, unknown>): Proposal {
  return {
    id: row.id as number, ruleId: row.rule_id as string, action: row.action as string,
    toProgram: row.to_program as string, amount: row.amount as string,
    usdEstimate: row.usd_estimate as number, reason: row.reason as string,
    status: row.status as Proposal["status"],
  };
}

export class RulesEngine {
  private rules: Rule[] = [];
  constructor(private configPath: string) { this.loadConfig(); }

  loadConfig(): void {
    try {
      const parsed = parse(readFileSync(this.configPath, "utf-8"));
      this.rules = RulesConfigSchema.parse(parsed).rules.filter((r) => r.enabled);
      logger.info({ count: this.rules.length }, "Rules loaded");
    } catch (err) { logger.error({ err }, "Failed to load rules"); this.rules = []; }
  }

  async evaluate(treasuryUsd: number, programs: Array<{ name: string; budgetUsd: number; spentUsd: number }>, minReserveUsd: number): Promise<Proposal[]> {
    const proposals: Proposal[] = [];
    for (const rule of this.rules) {
      const match = this.evaluateRule(rule, treasuryUsd, programs, minReserveUsd);
      if (!match) continue;
      const existing = await get<{ id: number }>("SELECT id FROM proposals WHERE rule_id = ? AND status = 'pending'", [rule.id]);
      if (existing) continue;
      const result = await run(
        `INSERT INTO proposals (rule_id, action, to_program, amount, usd_estimate, reason, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [rule.id, rule.action.type, match.toProgram, match.amount, match.usdEstimate, match.reason, new Date().toISOString()]
      );
      proposals.push({ id: result.lastID, ruleId: rule.id, action: rule.action.type, toProgram: match.toProgram, amount: match.amount, usdEstimate: match.usdEstimate, reason: match.reason, status: "pending" });
      logger.info({ proposalId: result.lastID, ruleId: rule.id }, "Proposal created");
    }
    return proposals;
  }

  private evaluateRule(rule: Rule, treasuryUsd: number, programs: Array<{ name: string; budgetUsd: number; spentUsd: number }>, minReserveUsd: number): { toProgram: string; amount: string; usdEstimate: number; reason: string } | null {
    const cond = rule.condition;
    if (cond.type === "program_underfunded" && cond.program) {
      const p = programs.find((x) => x.name === cond.program);
      const remaining = p ? Math.max(0, p.budgetUsd - p.spentUsd) : 0;
      const spendable = Math.max(0, treasuryUsd - minReserveUsd);
      if (p && remaining > 0 && spendable > 0) {
        const amt = Math.min(remaining, spendable);
        return { toProgram: p.name, amount: "need", usdEstimate: amt, reason: `Program "${p.name}" needs $${remaining.toFixed(2)}; treasury has $${spendable.toFixed(2)} spendable above the $${minReserveUsd} reserve.` };
      }
    }
    if (cond.type === "treasury_above" && cond.minUsd !== undefined) {
      const surplus = treasuryUsd - cond.minUsd;
      if (surplus > 0) {
        return { toProgram: rule.action.toProgram, amount: "all_above_reserve", usdEstimate: surplus, reason: `Treasury $${treasuryUsd.toFixed(2)} exceeds $${cond.minUsd}; proposing to disburse $${surplus.toFixed(2)} surplus (human must confirm).` };
      }
    }
    return null;
  }

  async getPendingProposals(): Promise<Proposal[]> {
    const rows = await all<Record<string, unknown>>("SELECT * FROM proposals WHERE status = 'pending' ORDER BY created_at DESC");
    return rows.map(mapProposalRow);
  }
  async getAllProposals(): Promise<Proposal[]> {
    const rows = await all<Record<string, unknown>>("SELECT * FROM proposals ORDER BY created_at DESC");
    return rows.map(mapProposalRow);
  }

  // The human gate. Records confirm, hash-chains a receipt, then (only if not dry-run)
  // executes the payout through the MoneyProvider. Money NEVER moves without this call.
  async confirmProposal(proposalId: number, provider: { payout: (i: { to: string; amountUsd: number; note?: string }) => Promise<{ success: boolean; payoutBatchId?: string; itemId?: string; error?: string }> }, ipfs: IpfsClient, confirmedBy: string, dryRun: boolean): Promise<{ proposal: Proposal; receiptCid: string }> {
    const row = await get<Record<string, unknown>>("SELECT * FROM proposals WHERE id = ?", [proposalId]);
    if (!row) throw new Error("Proposal not found");
    const proposal = mapProposalRow(row);
    if (proposal.status !== "pending") throw new Error(`Proposal already ${proposal.status}`);

    await run("UPDATE proposals SET status = 'confirmed', confirmed_by = ?, confirmed_at = ? WHERE id = ?", [confirmedBy, new Date().toISOString(), proposalId]);
    proposal.status = "confirmed";

    const last = await get<{ hash: string }>("SELECT hash FROM receipts ORDER BY id DESC LIMIT 1");
    const linked = createReceipt("action_confirmed", { proposalId, ruleId: proposal.ruleId, toProgram: proposal.toProgram, amountUsd: proposal.usdEstimate, confirmedBy, dryRun }, last?.hash ?? null);
    const { cid } = await ipfs.pinReceipt(linked);
    await run("INSERT INTO receipts (nonce, event_type, cid, hash, previous_hash, timestamp, payload) VALUES (?, ?, ?, ?, ?, ?, ?)", [linked.nonce, linked.eventType, cid, linked.hash, linked.previousHash, linked.timestamp, JSON.stringify(linked.payload)]);

    if (!dryRun) {
      const result = await provider.payout({ to: proposal.toProgram, amountUsd: proposal.usdEstimate, note: `Amanah disbursement for ${proposal.toProgram}` });
      if (result.success) {
        await run("UPDATE proposals SET status = 'executed' WHERE id = ?", [proposalId]);
        proposal.status = "executed";
        logger.info({ proposalId, batch: result.payoutBatchId }, "Payout executed");
      } else {
        logger.error({ proposalId, error: result.error }, "Payout failed");
      }
    } else {
      await run("UPDATE proposals SET status = 'executed' WHERE id = ?", [proposalId]);
      proposal.status = "executed";
      logger.info({ proposalId }, "Dry-run: payout simulated");
    }
    await run("UPDATE proposals SET receipt_cid = ? WHERE id = ?", [cid, proposalId]);
    return { proposal, receiptCid: cid };
  }

  async rejectProposal(proposalId: number, reason: string): Promise<Proposal> {
    const row = await get<Record<string, unknown>>("SELECT * FROM proposals WHERE id = ?", [proposalId]);
    if (!row) throw new Error("Proposal not found");
    await run("UPDATE proposals SET status = 'rejected' WHERE id = ?", [proposalId]);
    const proposal = mapProposalRow(row);
    proposal.status = "rejected";
    logger.info({ proposalId, reason }, "Proposal rejected");
    return proposal;
  }
}
