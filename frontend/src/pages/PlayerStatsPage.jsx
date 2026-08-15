import { useEffect, useState, useCallback } from "react";
import { api, STAT_KEYS, STAT_META, upgradeCost } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Coins, ArrowUp, Heart, Sword, Wind, Crown, Lock } from "lucide-react";

const STAT_ICON = { vigor: Heart, strength: Sword, agility: Wind, status: Crown };

export default function PlayerStatsPage() {
  const { refresh } = useAuth();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/stats");
      setData(data);
    } catch { /* noop */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const onUpgrade = async (stat) => {
    setBusy(stat);
    try {
      const { data: res } = await api.post("/stats/upgrade", { stat });
      toast.success(`${STAT_META[stat].label} → Lv ${res.new_level} (−${res.cost} coins)`);
      load();
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upgrade failed");
    }
    setBusy(null);
  };

  if (!data) return <div className="py-16 text-center font-mono text-sky-400/60 animate-pulse">[ LOADING STATUS WINDOW... ]</div>;

  return (
    <div className="space-y-8 animate-boot">
      <div>
        <div className="inline-block px-3 py-1 rounded-full glass-panel text-[9px] tracking-[0.3em] uppercase text-sky-300 mb-3">
          [ INCARNATION STATUS WINDOW ]
        </div>
        <h1 className="font-display font-black text-4xl sm:text-5xl text-sky-100 tracking-tight">
          Character Sheet
        </h1>
        <p className="font-mono text-xs text-sky-400/70 mt-3">
          &gt; Total Points: <span className="text-sky-200 font-bold">{data.total}</span>
          <span className="ml-4">Cost Formula: <span className="text-yellow-300">100 + (L × 50) + (T × 20)</span></span>
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {STAT_KEYS.map((k) => {
          const meta = STAT_META[k];
          const Icon = STAT_ICON[k];
          const level = data.stats[k];
          const cost = data.upgrade_costs[k];
          const cap = data.stat_caps?.[k];
          const capped = cap?.max != null && level >= cap.max;
          const canAfford = data.coins >= cost;
          const disabled = capped || !canAfford || busy === k;

          return (
            <div
              key={k}
              data-testid={`stat-card-${k}`}
              className="glass-panel rounded-2xl p-6 relative overflow-hidden"
              style={{ borderLeft: `4px solid ${meta.color}` }}
            >
              <div
                className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-25 pointer-events-none"
                style={{ background: meta.color }}
              />
              <div className="relative flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ background: `${meta.color}25`, color: meta.color }}
                  >
                    <Icon size={24} />
                  </div>
                  <div>
                    <div className="font-display font-black text-2xl text-sky-50 tracking-tight leading-none">
                      {meta.label}
                    </div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-sky-400/70 mt-1">
                      {meta.desc}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-sky-400/60">Lv</div>
                  <div className="font-display font-black text-4xl text-sky-100 leading-none" data-testid={`stat-level-${k}`}>
                    {level}
                  </div>
                </div>
              </div>

              {cap?.max != null && (
                <div className="mt-4 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-red-300">
                  <Lock size={10} />
                  Capped at Lv {cap.max}{cap.note ? ` — ${cap.note}` : ""}
                </div>
              )}

              <div className="mt-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  <Coins size={14} className="text-yellow-300" />
                  <span className={`font-mono font-bold ${canAfford ? "text-sky-100" : "text-red-300"}`} data-testid={`stat-cost-${k}`}>
                    {cost}
                  </span>
                  <span className="text-[9px] uppercase tracking-widest text-sky-400/60">next lv</span>
                </div>
                <button
                  onClick={() => onUpgrade(k)}
                  disabled={disabled}
                  data-testid={`upgrade-btn-${k}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-sky-950 font-display font-bold uppercase text-xs tracking-widest disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowUp size={12} />
                  {capped ? "Locked" : !canAfford ? "Need coins" : busy === k ? "..." : "Upgrade"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="glass-panel rounded-xl p-4 font-mono text-[10px] uppercase tracking-widest text-sky-400/70">
        &gt; Upgrading any stat also increases the cost of the others (Global Drag Coefficient: 20).
      </div>
    </div>
  );
}
