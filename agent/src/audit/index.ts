import { createReceipt, verifyChain, type IpfsClient, type Receipt } from "@amanah/receipts";
import { run, get, all } from "../lib/db.js";
import { logger } from "../lib/logger.js";

export class AuditTrail {
  constructor(private ipfs: IpfsClient) {}
  async append(eventType: Parameters<typeof createReceipt>[0], payload: Record<string, unknown>): Promise<{ cid: string; hash: string }> {
    const last = await get<{ hash: string }>("SELECT hash FROM receipts ORDER BY id DESC LIMIT 1");
    const receipt = createReceipt(eventType, payload, last?.hash ?? null);
    const { cid } = await this.ipfs.pinReceipt(receipt);
    await run("INSERT INTO receipts (nonce, event_type, cid, hash, previous_hash, timestamp, payload) VALUES (?, ?, ?, ?, ?, ?, ?)", [receipt.nonce, receipt.eventType, cid, receipt.hash, receipt.previousHash, receipt.timestamp, JSON.stringify(receipt.payload)]);
    logger.info({ eventType, cid }, "Receipt appended");
    return { cid, hash: receipt.hash };
  }
  async getChain(): Promise<Array<Receipt & { cid: string }>> {
    const rows = await all<Record<string, unknown>>("SELECT * FROM receipts ORDER BY id ASC");
    return rows.map((r) => ({ version: "1.0.0", eventType: r.event_type as Receipt["eventType"], timestamp: r.timestamp as string, nonce: r.nonce as string, payload: JSON.parse((r.payload as string) ?? "{}"), previousHash: (r.previous_hash as string) ?? null, hash: r.hash as string, cid: r.cid as string }));
  }
  async verifyLocalChain(): Promise<{ valid: boolean; firstInvalidIndex: number | null }> {
    return verifyChain(await this.getChain());
  }
  async getTreasurySummary(): Promise<{ totalDonationsUsd: number; totalProposals: number; pendingProposals: number; executedProposals: number }> {
    const d = await get<{ s: number }>("SELECT COALESCE(SUM(usd_estimate),0) s FROM donations");
    const p = await get<{ c: number }>("SELECT COUNT(*) c FROM proposals");
    const pend = await get<{ c: number }>("SELECT COUNT(*) c FROM proposals WHERE status='pending'");
    const exec = await get<{ c: number }>("SELECT COUNT(*) c FROM proposals WHERE status='executed'");
    return { totalDonationsUsd: d?.s ?? 0, totalProposals: p?.c ?? 0, pendingProposals: pend?.c ?? 0, executedProposals: exec?.c ?? 0 };
  }
}
