import type { MoneyProvider, Balance, DonationResult, PayoutResult } from "./types.js";
import { sha256 } from "@amanah/receipts";

// In-memory, deterministic provider for demos, CI, and judges without PayPal keys.
// Tracks a treasury balance so the rules engine + demo have real numbers to reason over.
export class MockMoneyProvider implements MoneyProvider {
  private treasuryUsd: number;
  private txCounter = 0;
  readonly seedBalances: Balance[] = [
    { asset: "USD", available: "12000.00", currency: "USD", usdValue: 12000 },
  ];

  constructor(seedUsd = 12000) { this.treasuryUsd = seedUsd; }

  name(): string { return "mock"; }

  async getTreasuryUsd(): Promise<number> { return this.treasuryUsd; }

  async receiveDonation(input: { amountUsd: number; donorRef: string; note?: string }): Promise<DonationResult> {
    this.treasuryUsd += input.amountUsd;
    this.txCounter += 1;
    const orderId = `mock-order-${this.txCounter}-${sha256(input.donorRef + input.amountUsd).slice(0, 8)}`;
    return { success: true, orderId, captureId: `mock-capture-${this.txCounter}` };
  }

  async payout(input: { to: string; amountUsd: number; note?: string }): Promise<PayoutResult> {
    if (input.amountUsd > this.treasuryUsd) return { success: false, error: "insufficient treasury" };
    this.treasuryUsd -= input.amountUsd;
    this.txCounter += 1;
    return { success: true, payoutBatchId: `mock-batch-${this.txCounter}`, itemId: `mock-item-${this.txCounter}` };
  }

  // Test helper: simulate a market/target-budget shock the rules engine reacts to.
  adjustTreasury(deltaUsd: number): void { this.treasuryUsd += deltaUsd; }
}
