import { config } from "../lib/config.js";
import type { MoneyProvider } from "./types.js";
import { PayPalProvider } from "./paypal.js";
import { MockMoneyProvider } from "./mock.js";

// Pick the provider from config. With no PayPal keys (default, DRY_RUN=true) we use
// the mock so the whole pipeline runs with zero setup — the hackathon demo path.
export function makeMoneyProvider(): MoneyProvider {
  if (config.paypal.clientId && config.paypal.clientSecret && !config.dryRun) {
    return new PayPalProvider();
  }
  return new MockMoneyProvider();
}
