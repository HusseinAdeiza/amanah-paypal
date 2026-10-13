import { z } from "zod";

// Rules are declarative guardrails. In the PayPal rebuild the "protection" is simpler
// and more honest than the old convert-volatile-to-stable logic: the treasury IS
// already USD (fiat via PayPal), so protection = controlled, reserve-respecting
// disbursement + a surplus-hold rule. The engine still produces PROPOSALS only.
export const RuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean().default(true),
  condition: z.object({
    type: z.enum(["treasury_above", "program_underfunded", "reserve_floor"]),
    minUsd: z.number().optional(),
    program: z.string().optional(),
  }),
  action: z.object({
    type: z.literal("disburse"),
    toProgram: z.string(),
    amount: z.enum(["need", "all_above_reserve", "fixed"]),
    fixedUsd: z.number().optional(),
  }),
});
export type Rule = z.infer<typeof RuleSchema>;
export const RulesConfigSchema = z.object({ version: z.string(), rules: z.array(RuleSchema) });
export type RulesConfig = z.infer<typeof RulesConfigSchema>;
