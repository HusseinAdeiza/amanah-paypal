import { createHash, randomUUID } from "crypto";
import { z } from "zod";

// Every meaningful event in the treasury lifecycle is a receipt. The event types
// are provider-agnostic on purpose: "convert" is the old Binance word; for the
// PayPal rebuild the fund-protection action is a "payout_hold"/"rebalance" but we
// keep generic verbs so the chain logic never changes.
export const ReceiptEventType = z.enum([
  "donation_received",      // money in (PayPal order captured)
  "protection_rule_triggered",
  "action_proposed",        // the agent proposes a fund action
  "action_confirmed",       // human approves
  "action_executed",        // executed (PayPal payout / hold)
  "disbursement",           // program spend paid out
  "emergency_stop",
]);
export type ReceiptEventType = z.infer<typeof ReceiptEventType>;

export const ReceiptSchema = z.object({
  version: z.literal("1.0.0"),
  eventType: ReceiptEventType,
  timestamp: z.string().datetime(),
  nonce: z.string(),
  payload: z.record(z.unknown()),
  previousHash: z.string().nullable(),
  hash: z.string(),
});
export type Receipt = z.infer<typeof ReceiptSchema>;

export function createReceipt(
  eventType: ReceiptEventType,
  payload: Record<string, unknown>,
  previousHash: string | null
): Receipt {
  const nonce = randomUUID();
  const timestamp = new Date().toISOString();
  const hash = hashReceipt({ version: "1.0.0", eventType, timestamp, nonce, payload, previousHash });
  return { version: "1.0.0", eventType, timestamp, nonce, payload, previousHash, hash };
}

function hashReceipt(receipt: Omit<Receipt, "hash">): string {
  const data = JSON.stringify({
    version: receipt.version,
    eventType: receipt.eventType,
    timestamp: receipt.timestamp,
    nonce: receipt.nonce,
    payload: receipt.payload,
    previousHash: receipt.previousHash,
  });
  return createHash("sha256").update(data).digest("hex");
}

export function verifyReceipt(receipt: Receipt): boolean {
  return hashReceipt(receipt) === receipt.hash;
}

// Verifies each receipt's own hash AND the link to the previous receipt's hash.
export function verifyChain(receipts: Receipt[]): { valid: boolean; firstInvalidIndex: number | null } {
  for (let i = 0; i < receipts.length; i++) {
    const r = receipts[i];
    if (!verifyReceipt(r)) return { valid: false, firstInvalidIndex: i };
    if (i > 0 && r.previousHash !== receipts[i - 1].hash) return { valid: false, firstInvalidIndex: i };
    if (i === 0 && r.previousHash !== null) return { valid: false, firstInvalidIndex: 0 };
  }
  return { valid: true, firstInvalidIndex: null };
}

export { sha256 } from "./hash.js";
export * from "./ipfs.js";
