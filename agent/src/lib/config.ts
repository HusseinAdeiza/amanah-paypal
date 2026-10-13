import "dotenv/config";

function num(v: string | undefined, dflt: number): number {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : dflt;
}

export const config = {
  dryRun: (process.env.DRY_RUN ?? "true").toLowerCase() !== "false",
  port: num(process.env.PORT, 4000),
  currency: process.env.AMANAH_CURRENCY ?? "USD",
  ipfs: {
    provider: process.env.IPFS_PROVIDER ?? "mock",
    pinataJwt: process.env.PINATA_JWT,
  },
  paypal: {
    env: process.env.PAYPAL_ENV ?? "sandbox",
    clientId: process.env.PAYPAL_CLIENT_ID,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET,
  },
  ai: {
    baseUrl: process.env.AI_BASE_URL,
    apiKey: process.env.AI_API_KEY,
    model: process.env.AI_MODEL,
    enabled: Boolean(process.env.AI_BASE_URL && process.env.AI_MODEL),
  },
  // Volatility protection thresholds (the "rules" defaults live in rules.yaml).
  // These are the human-set guardrails the AI reasoner must respect.
  guardrails: {
    maxSinglePayoutUsd: num(process.env.MAX_SINGLE_PAYOUT_USD, 5000),
    minReserveUsd: num(process.env.MIN_RESERVE_USD, 2000),
  },
};

export type Config = typeof config;
