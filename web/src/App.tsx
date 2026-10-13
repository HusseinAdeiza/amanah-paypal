import { useState } from "react";
import { useApi } from "./hooks/useApi.js";

interface State { provider: string; dryRun: boolean; treasuryUsd: number; guardrails: { maxSinglePayoutUsd: number; minReserveUsd: number }; summary: any; }
interface Proposal { id: number; toProgram: string; usdEstimate: number; reason: string; status: string; }
interface Receipt { eventType: string; hash: string; previousHash: string | null; cid: string; }

export function App() {
  const state = useApi<State>("/api/state");
  const proposals = useApi<{ } & Proposal[]>("/api/proposals");
  const receipts = useApi<Receipt[]>("/api/receipts");
  const [donor, setDonor] = useState("donor-web");
  const [amt, setAmt] = useState("100");

  const donate = async () => {
    await fetch("/api/donate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ donorRef: donor, amountUsd: Number(amt) }) });
    state.reload(); proposals.reload(); receipts.reload();
  };
  const evaluate = async () => {
    await fetch("/api/evaluate", { method: "POST" });
    proposals.reload();
  };
  const confirm = async (id: number) => {
    await fetch(`/api/proposals/${id}/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmedBy: "dashboard-operator" }) });
    state.reload(); proposals.reload(); receipts.reload();
  };

  const s = state.data;
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 960, margin: "0 auto", padding: 24, color: "#e8eaed", background: "#0d1117", minHeight: "100vh" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid #30363d", paddingBottom: 12 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Amanah <span style={{ color: "#8b949e", fontWeight: 400, fontSize: 14 }}>auditable charity treasury</span></h1>
        <span style={{ fontSize: 12, color: s?.dryRun ? "#d29922" : "#3fb950" }}>{s?.dryRun ? "● DRY-RUN (no real money)" : "● LIVE"}</span>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, margin: "20px 0" }}>
        <Card label="Treasury" value={s ? `$${s.treasuryUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"} />
        <Card label="Donations received" value={s ? `$${(s.summary?.totalDonationsUsd ?? 0).toLocaleString()}` : "—"} />
        <Card label="Provider" value={s?.provider ?? "—"} />
      </section>

      <section style={{ margin: "20px 0" }}>
        <h2 style={{ fontSize: 16 }}>Simulate a donation (PayPal sandbox)</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={donor} onChange={(e) => setDonor(e.target.value)} style={input} placeholder="donor" />
          <input value={amt} onChange={(e) => setAmt(e.target.value)} style={{ ...input, width: 100 }} placeholder="USD" />
          <button onClick={donate} style={btn}>Receive</button>
          <button onClick={evaluate} style={{ ...btn, background: "#21262d" }}>Run AI + rules</button>
        </div>
      </section>

      <section style={{ margin: "20px 0" }}>
        <h2 style={{ fontSize: 16 }}>Proposals <span style={{ color: "#8b949e", fontSize: 12 }}>(money only moves when a human confirms)</span></h2>
        {(proposals.data ?? []).length === 0 && <p style={{ color: "#8b949e" }}>No proposals. Click “Run AI + rules”.</p>}
        {(proposals.data ?? []).map((p: Proposal) => (
          <div key={p.id} style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: 12, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>#{p.id} → {p.toProgram}</strong> · ${p.usdEstimate.toFixed(2)} · <span style={{ color: "#8b949e" }}>{p.status}</span>
              <div style={{ color: "#8b949e", fontSize: 13 }}>{p.reason}</div>
            </div>
            {p.status === "pending" && <button onClick={() => confirm(p.id)} style={btn}>Confirm & pay</button>}
          </div>
        ))}
      </section>

      <section style={{ margin: "20px 0" }}>
        <h2 style={{ fontSize: 16 }}>Hash-chained audit trail</h2>
        <div style={{ fontFamily: "monospace", fontSize: 12, background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: 12, maxHeight: 260, overflow: "auto" }}>
          {(receipts.data ?? []).map((r, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              <span style={{ color: "#58a6ff" }}>{r.eventType}</span> {r.hash.slice(0, 12)}… ← {(r.previousHash ?? "genesis").slice(0, 12)}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const input: React.CSSProperties = { background: "#0d1117", border: "1px solid #30363d", color: "#e8eaed", borderRadius: 6, padding: "8px 10px" };
const btn: React.CSSProperties = { background: "#238636", color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", cursor: "pointer" };
function Card({ label, value }: { label: string; value: string }) {
  return <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: 16 }}><div style={{ color: "#8b949e", fontSize: 12 }}>{label}</div><div style={{ fontSize: 22, marginTop: 4 }}>{value}</div></div>;
}
