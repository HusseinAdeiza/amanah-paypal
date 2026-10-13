// The single seam that made the old build Binance-locked. In the PayPal rebuild the
// boundary is "MoneyProvider": anything that can receive donations, quote value, and
// pay out under human approval. PayPal is one implementation; a mock is another.
// The rules engine, confirm-gate, and receipts never touch provider specifics.

export interface Balance {
  asset: string;        // "USD" for PayPal-held value
  available: string;    // decimal string
  currency: string;
  usdValue?: number;
}

export interface DonationResult {
  success: boolean;
  orderId?: string;     // PayPal order id (or mock id)
  captureId?: string;
  error?: string;
}

export interface PayoutResult {
  success: boolean;
  payoutBatchId?: string;
  itemId?: string;
  error?: string;
}

export interface MoneyProvider {
  name(): string;
  // Total available treasury value in USD (what the rules engine reasons over).
  getTreasuryUsd(): Promise<number>;
  // Create + capture a donation. In sandbox/mock this simulates a donor paying.
  receiveDonation(input: { amountUsd: number; donorRef: string; note?: string }): Promise<DonationResult>;
  // Pay a program/expense out. ALWAYS behind the human confirm-gate + dry-run.
  payout(input: { to: string; amountUsd: number; note?: string }): Promise<PayoutResult>;
}
