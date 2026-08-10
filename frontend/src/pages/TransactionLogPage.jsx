import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function TransactionLogPage() {
  const { user } = useAuth();
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/transactions");
        setTxs(data);
      } catch { /* noop */ }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6 animate-boot">
      <div>
        <div className="inline-block px-3 py-1 rounded-full glass-panel text-[9px] tracking-[0.3em] uppercase text-sky-300 mb-3">
          [ SYSTEM LEDGER // TX LOG ]
        </div>
        <h1 className="font-display font-black text-4xl text-sky-100 tracking-tight">Transaction Log</h1>
        <p className="font-mono text-xs text-sky-400/70 mt-2">
          &gt; {user?.role === "admin" ? "All coin flows across the story." : "Your history of gains and expenditures."}
        </p>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-sky-400/20 font-mono text-[10px] uppercase tracking-widest text-sky-400 grid grid-cols-12 gap-3">
          <div className="col-span-3">Time</div>
          {user?.role === "admin" && <div className="col-span-2">Player</div>}
          <div className={user?.role === "admin" ? "col-span-5" : "col-span-7"}>Reason</div>
          <div className="col-span-2 text-right">Amount</div>
        </div>
        {loading ? (
          <div className="p-8 text-center font-mono text-sm text-sky-400/60 animate-pulse">
            [ FETCHING LOG... ]
          </div>
        ) : txs.length === 0 ? (
          <div className="p-8 text-center font-mono text-sm text-sky-400/70">
            No transactions yet.
          </div>
        ) : (
          <div className="divide-y divide-sky-400/10">
            {txs.map((t) => {
              const positive = t.amount > 0;
              const date = new Date(t.created_at);
              return (
                <div
                  key={t.id}
                  data-testid={`tx-row-${t.id}`}
                  className="p-4 grid grid-cols-12 gap-3 items-center font-mono text-xs hover:bg-sky-500/5"
                >
                  <div className="col-span-3 text-sky-400/70">
                    {date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                  {user?.role === "admin" && (
                    <div className="col-span-2 text-sky-100 truncate">{t.player_name}</div>
                  )}
                  <div className={user?.role === "admin" ? "col-span-5" : "col-span-7"}>
                    <span className={`inline-block text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded mr-2 ${
                      t.type === "grant" ? "bg-sky-500/20 text-sky-300" : "bg-purple-500/20 text-purple-300"
                    }`}>
                      {t.type}
                    </span>
                    <span className="text-sky-200/90">{t.reason}</span>
                  </div>
                  <div className={`col-span-2 text-right font-bold ${positive ? "text-emerald-300" : "text-red-300"}`}>
                    {positive ? "+" : ""}{t.amount}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
