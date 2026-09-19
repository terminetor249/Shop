import { useEffect, useState, useCallback } from "react";
import { api, STAT_KEYS, STAT_META } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  Coins, ArrowUp, Heart, Sword, Wind, Crown, Eye, Lock, Plus, Minus, RotateCw, Sparkles,
} from "lucide-react";

const STAT_ICON = {
  vigor: Heart, strength: Sword, agility: Wind, status: Crown, acuity: Eye,
};

const VITAL_META = {
  hp: { label: "Health", color: "#ef4444", from: "from-red-500", to: "to-rose-600", ring: "ring-red-400/40" },
  mp: { label: "Mana", color: "#38bdf8", from: "from-sky-500", to: "to-cyan-500", ring: "ring-sky-400/40" },
  stamina: { label: "Stamina", color: "#22c55e", from: "from-emerald-500", to: "to-lime-500", ring: "ring-emerald-400/40" },
};

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
    setBusy("upgrade:" + stat);
    try {
      const { data: res } = await api.post("/stats/upgrade", { stat });
      const newLevel = res.stats[stat];
      toast.success(`${STAT_META[stat].label} → Lv ${newLevel}`);
      setData(res);
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upgrade failed");
    }
    setBusy(null);
  };

  const onAllocate = async (stat) => {
    setBusy("alloc:" + stat);
    try {
      const { data: res } = await api.post("/stats/allocate", { stat });
      toast.success(`+1 ${STAT_META[stat].label} (free)`);
      setData(res);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Allocate failed");
    }
    setBusy(null);
  };

  const onVital = async (which, delta) => {
    if (!data) return;
    const cur = data.vitals[which].current;
    const max = data.vitals[which].max;
    const nextVal = Math.max(0, Math.min(max, cur + delta));
    setBusy("vital:" + which);
    try {
      const { data: res } = await api.post("/stats/vitals", { [which]: nextVal });
      setData(res);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Update failed");
    }
    setBusy(null);
  };

  const restoreAll = async () => {
    if (!data) return;
    setBusy("restore");
    try {
      const { data: res } = await api.post("/stats/vitals", {
        hp: data.vitals.hp.max,
        mp: data.vitals.mp.max,
        stamina: data.vitals.stamina.max,
      });
      setData(res);
      toast.success("Vitals restored to max");
    } catch { /* noop */ }
    setBusy(null);
  };

  if (!data) return <div className="py-16 text-center font-mono text-sky-400/60 animate-pulse">[ LOADING STATUS WINDOW... ]</div>;

  const unallocated = data.unallocated_points;

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
          <span className="ml-4">Cost Formula: <span className="text-yellow-300">100 + (L × 20) + (T × 10)</span></span>
        </p>
      </div>

      {/* Vitals */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="font-mono text-[10px] uppercase tracking-widest text-sky-400">[ Vitals ]</div>
          <button
            onClick={restoreAll}
            data-testid="restore-vitals"
            disabled={busy === "restore"}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/30 text-sky-200 font-mono text-[10px] uppercase tracking-widest transition-colors"
          >
            <RotateCw size={11} /> Restore to Max
          </button>
        </div>
        <div className="space-y-4">
          {["hp", "mp", "stamina"].map((v) => (
            <VitalBar
              key={v}
              which={v}
              current={data.vitals[v].current}
              max={data.vitals[v].max}
              onDelta={(d) => onVital(v, d)}
              disabled={busy === "vital:" + v}
            />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[9px] uppercase tracking-widest text-sky-400/60">
          <div>&gt; HP = 10 + Vigor</div>
          <div>&gt; MP = 400 + (Status − 1) × 50</div>
          <div>&gt; Stamina = 4·Vigor + 6·Agility</div>
        </div>
      </div>

      {/* Free points banner */}
      {unallocated > 0 && (
        <div className="glass-panel rounded-2xl p-5 border-l-4 border-yellow-400/70 ring-1 ring-yellow-400/30 shadow-[0_0_40px_-10px_rgba(250,204,21,0.5)]">
          <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-yellow-400/20 text-yellow-300 flex items-center justify-center">
                <Sparkles size={20} />
              </div>
              <div>
                <div className="font-display font-black text-xl text-sky-50 leading-none">
                  {unallocated} Free Point{unallocated === 1 ? "" : "s"} Available
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-sky-400/70 mt-1">
                  Allocate directly to any stat — no coins required
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STAT_KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => onAllocate(k)}
                  disabled={busy === "alloc:" + k}
                  data-testid={`allocate-${k}`}
                  className="px-3 py-1.5 rounded-full bg-sky-950/60 hover:bg-sky-500/20 border border-sky-400/30 text-sky-100 font-mono text-[10px] uppercase tracking-widest transition-colors inline-flex items-center gap-1"
                >
                  <Plus size={10} />
                  {STAT_META[k].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {STAT_KEYS.map((k) => {
          const meta = STAT_META[k];
          const Icon = STAT_ICON[k];
          const level = data.stats[k];
          const cost = data.upgrade_costs[k];
          const cap = data.stat_caps?.[k];
          const capped = cap?.max != null && level >= cap.max;
          const canAfford = data.coins >= cost;
          const disabled = capped || !canAfford || busy === "upgrade:" + k;

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
                  {capped ? "Locked" : !canAfford ? "Need coins" : busy === ("upgrade:" + k) ? "..." : "Upgrade"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="glass-panel rounded-xl p-4 font-mono text-[10px] uppercase tracking-widest text-sky-400/70">
        &gt; Upgrading any stat also increases the cost of the others (Global Drag Coefficient: 10).
      </div>
    </div>
  );
}

function VitalBar({ which, current, max, onDelta, disabled }) {
  const meta = VITAL_META[which];
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const [magnitude, setMagnitude] = useState("");
  const [sign, setSign] = useState(1); // 1 or -1

  const applyManual = () => {
    const mag = parseInt(magnitude);
    if (!Number.isFinite(mag) || mag <= 0) return;
    onDelta(sign * mag);
    setMagnitude("");
  };

  return (
    <div data-testid={`vital-${which}`} className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-sky-200">
          <span style={{ color: meta.color }} className="font-bold">{meta.label}</span>
          <span className="text-sky-400/60" data-testid={`vital-${which}-values`}>{current} / {max}</span>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {[-10, -1, +1, +10].map((d) => (
            <button
              key={d}
              onClick={() => onDelta(d)}
              disabled={disabled}
              data-testid={`vital-${which}-${d > 0 ? "plus" : "minus"}${Math.abs(d)}`}
              className={`w-9 h-7 rounded-md text-[10px] font-mono font-bold uppercase tracking-widest transition-colors ${
                d > 0
                  ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200"
                  : "bg-red-500/20 hover:bg-red-500/30 text-red-200"
              }`}
            >
              {d > 0 ? `+${d}` : d}
            </button>
          ))}
          <div className="flex items-center gap-1 ml-1 pl-2 border-l border-sky-400/20">
            {/* Sign toggle — replaces the need for a "-" key on mobile */}
            <div className="inline-flex rounded-md overflow-hidden ring-1 ring-sky-400/20" role="group">
              <button
                type="button"
                onClick={() => setSign(1)}
                data-testid={`vital-${which}-sign-plus`}
                className={`h-7 w-7 font-mono font-bold text-[11px] transition-colors ${
                  sign === 1 ? "bg-emerald-500 text-emerald-950" : "bg-sky-950/60 text-emerald-200 hover:bg-emerald-500/20"
                }`}
                aria-pressed={sign === 1}
                aria-label="Positive"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setSign(-1)}
                data-testid={`vital-${which}-sign-minus`}
                className={`h-7 w-7 font-mono font-bold text-[11px] transition-colors ${
                  sign === -1 ? "bg-red-500 text-red-950" : "bg-sky-950/60 text-red-200 hover:bg-red-500/20"
                }`}
                aria-pressed={sign === -1}
                aria-label="Negative"
              >
                −
              </button>
            </div>
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min="0"
              value={magnitude}
              onChange={(e) => setMagnitude(e.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") applyManual(); }}
              placeholder="amt"
              data-testid={`vital-${which}-manual`}
              className="w-14 h-7 px-2 bg-sky-950/60 border border-sky-400/25 rounded-md text-sky-100 font-mono text-[11px] text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            />
            <button
              onClick={applyManual}
              disabled={disabled || !magnitude}
              data-testid={`vital-${which}-apply`}
              className="h-7 px-2.5 rounded-md bg-sky-500 hover:bg-sky-400 text-sky-950 font-mono font-bold text-[10px] uppercase tracking-widest transition-colors disabled:opacity-40"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
      <div className={`relative h-3 rounded-full bg-sky-950/70 overflow-hidden ring-1 ${meta.ring}`}>
        <div
          className={`h-full bg-gradient-to-r ${meta.from} ${meta.to} transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
