import { run } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import type { MoneyProvider } from "../money/types.js";
import type { IpfsClient } from "@amanah/receipts";

export interface DonationEvent { donorRef: string; amountUsd: number; note?: string; }

export async function processDonation(provider: MoneyProvider, ipfs: IpfsClient, audit: { append: (t: "donation_received", p: Record<string, unknown>) => Promise<{ cid: string }> }, event: DonationEvent): Promise<{ donationId: number; receiptCid: string; orderId?: string }> {
  const result = await provider.receiveDonation(event);
  if (!result.success) throw new Error(result.error ?? "donation failed");
  const r = await run(
    `INSERT INTO donations (donor_ref, amount, currency, usd_estimate, paypal_order_id, timestamp, receipt_cid)
     VALUES (?, ?, 'USD', ?, ?, ?, '')`,
    [event.donorRef, event.amountUsd.toFixed(2), event.amountUsd, result.orderId ?? null, new Date().toISOString()]
  );
  const donationId = r.lastID;
  const { cid } = await audit.append("donation_received", { donationId, donorRef: event.donorRef, amountUsd: event.amountUsd, provider: provider.name(), orderId: result.orderId, note: event.note });
  await run("UPDATE donations SET receipt_cid = ? WHERE id = ?", [cid, donationId]);
  logger.info({ donationId, amountUsd: event.amountUsd, orderId: result.orderId, cid }, "Donation processed");
  return { donationId, receiptCid: cid, orderId: result.orderId };
}
