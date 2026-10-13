import { config } from "../lib/config.js";
import { logger } from "../lib/logger.js";
import type { MoneyProvider, Balance, DonationResult, PayoutResult } from "./types.js";

const BASE = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com",
}[config.paypal.env] ?? "https://api-m.sandbox.paypal.com";

// Minimal PayPal REST client: OAuth token -> Orders (receive) + Payouts (disburse).
// Uses only the free sandbox; no keys => callers should use the mock instead.
export class PayPalProvider implements MoneyProvider {
  private token?: { value: string; expiresAt: number };

  private async auth(): Promise<string> {
    if (!config.paypal.clientId || !config.paypal.clientSecret) {
      throw new Error("PayPal credentials not set (PAYPAL_CLIENT_ID/SECRET). Use mock mode or set them.");
    }
    if (this.token && this.token.expiresAt > Date.now() + 30_000) return this.token.value;
    const basic = Buffer.from(`${config.paypal.clientId}:${config.paypal.clientSecret}`).toString("base64");
    const res = await fetch(`${BASE}/v1/oauth2/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) throw new Error(`PayPal auth failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return this.token.value;
  }

  private async api(path: string, init: RequestInit = {}): Promise<unknown> {
    const token = await this.auth();
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`PayPal ${path} failed: ${res.status} ${body}`);
    return body ? JSON.parse(body) : {};
  }

  name(): string { return `paypal:${config.paypal.env}`; }

  async getTreasuryUsd(): Promise<number> {
    // PayPal has no public "wallet balance" REST endpoint; the treasury value is
    // tracked from captured donations minus payouts in our own ledger. The provider
    // reports captured-but-unpaid value via the reporting API when available.
    try {
      const data = (await this.api("/v1/reporting/transactions?start_date=&end_date=&fields=all")) as Record<string, unknown>;
      // Sum credited transactions as an upper bound; real product would reconcile.
      let total = 0;
      for (const t of (data.transaction_details ?? []) as Array<{ transaction_info?: { transaction_amount?: { value?: string } } }>) {
        total += Number(t.transaction_info?.transaction_amount?.value ?? 0);
      }
      return total;
    } catch {
      return 0;
    }
  }

  async receiveDonation(input: { amountUsd: number; donorRef: string; note?: string }): Promise<DonationResult> {
    if (config.dryRun) return { success: true, orderId: `dryrun-order-${Date.now()}` };
    const order = (await this.api("/v2/checkout/orders", {
      method: "POST",
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{ amount: { currency_code: "USD", value: input.amountUsd.toFixed(2) }, custom_id: input.donorRef, description: input.note ?? "Amanah donation" }],
      }),
    })) as { id: string };
    const capture = (await this.api(`/v2/checkout/orders/${order.id}/capture`, { method: "POST" })) as {
      purchase_units?: Array<{ payments?: { captures?: Array<{ id: string }> } }>;
    };
    return { success: true, orderId: order.id, captureId: capture.purchase_units?.[0]?.payments?.captures?.[0]?.id };
  }

  async payout(input: { to: string; amountUsd: number; note?: string }): Promise<PayoutResult> {
    if (config.dryRun) return { success: true, payoutBatchId: `dryrun-batch-${Date.now()}`, itemId: `dryrun-item-${Date.now()}` };
    // Payouts require the Payouts product enabled on the account; sandbox supports it.
    const batch = (await this.api("/v1/payments/payouts", {
      method: "POST",
      body: JSON.stringify({
        sender_batch_header: { sender_batch_id: `amanah-${Date.now()}`, email_subject: "You have a payout from Amanah" },
        items: [{ recipient_type: "EMAIL", amount: { value: input.amountUsd.toFixed(2), currency: "USD" }, receiver: input.to, note: input.note ?? "Program disbursement", sender_item_id: `item-${Date.now()}` }],
      }),
    })) as { batch_header: { payout_batch_id: string }; items?: Array<{ payout_item_id: string }> };
    logger.info({ batch }, "PayPal payout submitted");
    return { success: true, payoutBatchId: batch.batch_header.payout_batch_id, itemId: batch.items?.[0]?.payout_item_id };
  }
}
