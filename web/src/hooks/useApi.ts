import { useEffect, useState } from "react";
export function useApi<T>(path: string, refreshMs = 4000): { data: T | null; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reload = () => setTick((t) => t + 1);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try { const r = await fetch(path); if (!r.ok) throw new Error(String(r.status)); const j = await r.json(); if (alive) { setData(j); setError(null); } }
      catch (e) { if (alive) setError(String(e)); }
    };
    load();
    const id = setInterval(load, refreshMs);
    return () => { alive = false; clearInterval(id); };
  }, [path, tick]);
  return { data, error, reload };
}
