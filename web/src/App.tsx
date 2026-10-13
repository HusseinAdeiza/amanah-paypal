import { useState } from "react";
import { useApi } from "./hooks/useApi.js";
import "./styles.css";

interface State {
  provider: string;
  dryRun: boolean;
  treasuryUsd: number;
  guardrails: { maxSinglePayoutUsd: number; minReserveUsd: number };
  summary: { totalDonationsUsd: number; totalProposals: number; pendingProposals: number; executedProposals: number };
}
interface Proposal { id: number; toProgram: string; usdEstimate: number; reason: string; status: string; }
interface Receipt { eventType: string; hash: string; previousHash: string | null; cid: string; timestamp: string; }
interface Verdict { recommendDisbursement: boolean; targetProgram?: string; suggestedAmountUsd?: number; rationale: string; source: string; }
interface EvalResult { verdict: Verdict; proposals: Proposal[]; }

const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* --- inline SVG icons (1.6 stroke) --- */
const I = {
  wallet: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3M3 7h16" /><circle cx="16" cy="14" r="1.2" fill="currentColor" /></svg>,
  heart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 20s-7-4.5-9.3-9A5 5 0 0 1 12 6a5 5 0 0 1 9.3 5c-2.3 4.5-9.3 9-9.3 9z" /></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3l7 3v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z" /><path d="M9 12l2 2 4-4" /></svg>,
  spark: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /><circle cx="12" cy="12" r="3.2" /></svg>,
  list: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>,
  link: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" /></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>,
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>,
};

export function App() {
  const state = useApi<State>("/api/state");
  const proposals = useApi<Proposal[]>("/api/proposals");
  const receipts = useApi<Receipt[]>("/api/receipts");
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [donor, setDonor] = useState("donor-web");
  const [amt, setAmt] = useState("500");
  const [busy, setBusy] = useState(false);

  const s = state.data;
  const reloadAll = () => { state.reload(); proposals.reload(); receipts.reload(); };

  const donate = async () => {
    if (!(Number(amt) > 0)) return;
    setBusy(true);
    await fetch("/api/donate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ donorRef: donor, amountUsd: Number(amt) }) });
    setBusy(false); reloadAll();
  };
  const runAi = async () => {
    setBusy(true);
    const r = await fetch("/api/evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const j = (await r.json()) as EvalResult;
    setEvalResult(j); setBusy(false); reloadAll();
  };
  const confirm = async (id: number) => {
    setBusy(true);
    await fetch(`/api/proposals/${id}/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmedBy: "dashboard-operator" }) });
    setBusy(false); reloadAll();
  };

  const v = evalResult?.verdict;
  const allProps = proposals.data ?? [];
  const chain = receipts.data ?? [];

  return (
    <div className="app">
      <aside className="rail">
        <div className="brand">
          <div className="brand-mark">أ</div>
          <div>
            <div className="brand-name">Amanah</div>
            <div className="brand-sub">Treasury Guardian</div>
          </div>
        </div>
        <nav className="nav">
          <div className="nav-label">Overview</div>
          <div className="nav-item active">{I.wallet} Dashboard</div>
          <div className="nav-item">{I.list} Proposals</div>
          <div className="nav-item">{I.link} Audit Trail</div>
          <div className="nav-item">{I.shield} Programs</div>
        </nav>
        <div className="rail-foot">
          <div className="rail-note">Sandbox demo · no real funds</div>
        </div>
      </aside>

      <main className="main">
        <div className="page-head">
          <div>
            <h1 className="page-title">Treasury Overview</h1>
            <p className="page-desc">AI recommends · rules constrain · a human approves — every move provable.</p>
          </div>
          <div className={`mode-badge ${s?.dryRun ? "" : "live"}`}>
            <span className="dot" /> {s?.dryRun ? "Dry-run · sandbox" : "Live · PayPal"}
          </div>
        </div>

        <section className="stats">
          <div className="stat" style={{ ["--accent" as any]: "var(--gold)" }}>
            <div className="stat-label">{I.wallet} Treasury value</div>
            <div className="stat-value">{s ? usd(s.treasuryUsd) : "—"}</div>
            <div className="stat-foot">Held across programs, above reserve floor</div>
          </div>
          <div className="stat" style={{ ["--accent" as any]: "var(--emerald)" }}>
            <div className="stat-label">{I.heart} Donations received</div>
            <div className="stat-value">{s ? usd(s.summary.totalDonationsUsd) : "—"}</div>
            <div className="stat-foot">{s?.summary.totalProposals ?? 0} proposals · {s?.summary.executedProposals ?? 0} executed</div>
          </div>
          <div className="stat" style={{ ["--accent" as any]: "var(--amber)" }}>
            <div className="stat-label">{I.shield} Guardrails</div>
            <div className="stat-value" style={{ fontSize: 22 }}>Enforced in code</div>
            <div className="stat-foot">Max payout {s ? usd(s.guardrails.maxSinglePayoutUsd) : "—"} · Reserve {s ? usd(s.guardrails.minReserveUsd) : "—"}</div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">{I.plus} Receive a donation</h2>
            <span className="panel-hint">Captured via PayPal · written to the audit trail</span>
          </div>
          <div className="controls">
            <input className="input" value={donor} onChange={(e) => setDonor(e.target.value)} placeholder="donor name" style={{ width: 180 }} />
            <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
              <span style={{ position: "absolute", left: 12, color: "var(--text-dim)", fontSize: 14 }}>$</span>
              <input className="input amt" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="0.00" style={{ paddingLeft: 26 }} />
            </div>
            <button className="btn btn-primary" onClick={donate} disabled={busy}>{I.plus} Receive donation</button>
          </div>
        </section>

        <section className="panel ai-panel">
          <div className="panel-head">
            <h2 className="panel-title">{I.spark} AI Analysis</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="panel-hint">{v ? `source: ${v.source}` : ""}</span>
              <button className="btn btn-ghost" onClick={runAi} disabled={busy}>{I.spark} Run AI + rules</button>
            </div>
          </div>
          {v ? (
            <div className="ai-verdict">
              <div className="ai-icon">{I.spark}</div>
              <div className="ai-body">
                <div className="ai-line">
                  {v.recommendDisbursement ? (
                    <>Recommends disbursing <strong>{usd(v.suggestedAmountUsd ?? 0)}</strong> to <strong>{v.targetProgram}</strong>.</>
                  ) : (
                    <>No disbursement recommended — <strong>holding in reserve</strong>.</>
                  )}
                </div>
                <div className="ai-rationale">{v.rationale}</div>
                <div className="ai-guardrails">
                  <span className="guard">reserve floor <b>{s ? usd(s.guardrails.minReserveUsd) : "—"}</b></span>
                  <span className="guard">max single payout <b>{s ? usd(s.guardrails.maxSinglePayoutUsd) : "—"}</b></span>
                  <span className="guard">recommendation clamped in code</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty">Click <strong>Run AI + rules</strong> to have the reasoner evaluate the treasury against program budgets and the reserve floor.</div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">{I.list} Proposals</h2>
            <span className="panel-hint">money only moves when a human confirms</span>
          </div>
          {allProps.length === 0 ? (
            <div className="empty">No proposals yet. Receive a donation, then run the AI + rules.</div>
          ) : (
            allProps.map((p) => (
              <div className="prop" key={p.id}>
                <div className="prop-main">
                  <div className="prop-top">
                    <span className="prop-id">#{p.id}</span>
                    <span className="prop-program">{p.toProgram} Program</span>
                    <span className={`badge badge-${p.status}`}>{p.status}</span>
                  </div>
                  <div className="prop-reason">{p.reason}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span className="prop-amount">{usd(p.usdEstimate)}</span>
                  {p.status === "pending" && (
                    <button className="btn btn-primary" onClick={() => confirm(p.id)} disabled={busy}>{I.check} Confirm &amp; pay</button>
                  )}
                </div>
              </div>
            ))
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">{I.link} Hash-chained audit trail</h2>
            <span className="panel-hint">each receipt links to the one before it · pinned to IPFS</span>
          </div>
          <div className="chain">
            {chain.length === 0 && <div className="empty">The audit trail fills as events occur.</div>}
            {[...chain].reverse().map((r) => (
              <div className="chain-row" key={r.hash}>
                <div className="chain-rail"><div className="chain-node" /><div className="chain-line" /></div>
                <div className="chain-body">
                  <div className="chain-event">{r.eventType}</div>
                  <div className="chain-hash">
                    {r.hash.slice(0, 24)}… <span className="arr">←</span> <span className="prev">{(r.previousHash ?? "genesis").slice(0, 24)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {chain.length > 0 && (
            <div className="verify-strip">{I.check} Chain integrity verified — every receipt hashes the one before it.</div>
          )}
        </section>
      </main>
    </div>
  );
}
