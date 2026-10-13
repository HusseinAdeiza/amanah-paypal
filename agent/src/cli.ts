import readline from "readline";
import { initSchema, all } from "./lib/db.js";
import { makeMoneyProvider } from "./money/index.js";
import { makeIpfsClient } from "@amanah/receipts";
import { RulesEngine } from "./rules/index.js";
import { AuditTrail } from "./audit/index.js";
import { config } from "./lib/config.js";

async function main() {
  await initSchema();
  const provider = makeMoneyProvider();
  const ipfs = makeIpfsClient(config.ipfs.provider, { pinataJwt: config.ipfs.pinataJwt });
  const rules = new RulesEngine("./rules.yaml");
  const audit = new AuditTrail(ipfs);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const help = () => console.log("commands: balance | value | donate <usd> | evaluate | proposals | confirm <id> | reject <id> | verify | summary | help | exit");
  console.log("Amanah CLI (type 'help'). dryRun=" + config.dryRun);
  help();
  rl.on("line", async (line) => {
    const [cmd, ...args] = line.trim().split(/\s+/);
    try {
      if (cmd === "balance" || cmd === "value") console.log(`treasury: $${(await provider.getTreasuryUsd()).toFixed(2)}`);
      else if (cmd === "donate") { const amt = Number(args[0]); if (amt > 0) { await provider.receiveDonation({ donorRef: "cli-donor", amountUsd: amt }); console.log(`donated $${amt}; treasury $${(await provider.getTreasuryUsd()).toFixed(2)}`); } }
      else if (cmd === "evaluate") { const t = await provider.getTreasuryUsd(); console.log(await rules.evaluate(t, [], config.guardrails.minReserveUsd)); }
      else if (cmd === "proposals") console.table((await rules.getPendingProposals()).map((p) => ({ ID: p.id, Program: p.toProgram, Amount: p.usdEstimate, Reason: p.reason })));
      else if (cmd === "confirm") { const r = await rules.confirmProposal(Number(args[0]), provider, ipfs, "cli-operator", config.dryRun); console.log("confirmed", r.proposal.status, r.receiptCid); }
      else if (cmd === "reject") console.log(await rules.rejectProposal(Number(args[0]), "cli"));
      else if (cmd === "verify") console.log(await audit.verifyLocalChain());
      else if (cmd === "summary") console.log(await audit.getTreasurySummary());
      else if (cmd === "help") help();
      else if (cmd === "exit") { rl.close(); process.exit(0); }
    } catch (e) { console.error(String(e)); }
  });
}
main();
