import { config } from "../lib/config.js";

export interface ReasonerInput {
  treasuryUsd: number;
  minReserveUsd: number;
  maxSinglePayoutUsd: number;
  programs: Array<{ name: string; budgetUsd: number; spentUsd: number }>;
  pendingProposals: number;
  recentDonations: Array<{ amountUsd: number; donorRef: string }>;
}

export interface ReasonerVerdict {
  // A recommendation the human gate turns into a proposal. The AI NEVER moves money.
  recommendDisbursement: boolean;
  targetProgram?: string;
  suggestedAmountUsd?: number;
  rationale: string;
  source: "llm" | "heuristic";
}

// The AI is load-bearing: it decides WHETHER and HOW MUCH to disburse to a program,
// subject to hard guardrails it cannot override. With no AI key it falls back to a
// deterministic heuristic so the demo always runs — but the LLM path is the real one.
export async function reason(input: ReasonerInput): Promise<ReasonerVerdict> {
  if (config.ai.enabled) {
    try {
      return await llmVerdict(input);
    } catch (e) {
      // fall through to heuristic
    }
  }
  return heuristicVerdict(input);
}

async function llmVerdict(input: ReasonerInput): Promise<ReasonerVerdict> {
  const res = await fetch(`${config.ai.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.ai.apiKey ?? ""}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.ai.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are Amanah, a treasury guardian AI for a charity. You recommend a disbursement to a program. You may NEVER exceed the reserve floor or the single-payout cap. Respond as JSON: {recommendDisbursement:boolean, targetProgram?:string, suggestedAmountUsd?:number, rationale:string}." },
        { role: "user", content: JSON.stringify(input) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  const parsed = JSON.parse(data.choices[0].message.content) as ReasonerVerdict;
  // HARD GUARDRAILS — enforced in code, not by asking the model nicely.
  const spendable = Math.max(0, input.treasuryUsd - input.minReserveUsd);
  let amt = parsed.suggestedAmountUsd ?? 0;
  amt = Math.min(amt, input.maxSinglePayoutUsd, spendable);
  const rec = parsed.recommendDisbursement && amt > 0 && Boolean(parsed.targetProgram);
  return { recommendDisbursement: rec, targetProgram: parsed.targetProgram, suggestedAmountUsd: rec ? amt : undefined, rationale: parsed.rationale, source: "llm" };
}

function heuristicVerdict(input: ReasonerInput): ReasonerVerdict {
  const spendable = Math.max(0, input.treasuryUsd - input.minReserveUsd);
  if (spendable <= 0) {
    return { recommendDisbursement: false, rationale: `Treasury $${input.treasuryUsd.toFixed(2)} is at or below the $${input.minReserveUsd} reserve floor; nothing to disburse.`, source: "heuristic" };
  }
  // Disburse to the program with the most unspent budget need, capped by guardrails.
  const need = input.programs
    .map((p) => ({ p, remaining: Math.max(0, p.budgetUsd - p.spentUsd) }))
    .sort((a, b) => b.remaining - a.remaining)[0];
  if (!need || need.remaining <= 0) {
    return { recommendDisbursement: false, rationale: "All programs are fully funded; holding surplus in reserve.", source: "heuristic" };
  }
  const amt = Math.min(need.remaining, input.maxSinglePayoutUsd, spendable);
  return {
    recommendDisbursement: amt > 0,
    targetProgram: need.p.name,
    suggestedAmountUsd: amt > 0 ? amt : undefined,
    rationale: `Program "${need.p.name}" has $${need.remaining.toFixed(2)} unspent of budget; disbursing $${amt.toFixed(2)} (within $${input.maxSinglePayoutUsd} cap and $${input.minReserveUsd} reserve floor).`,
    source: "heuristic",
  };
}
