import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api, STAT_KEYS, STAT_META } from "@/lib/api";
import {
  Coins, Heart, Sword, Wind, Crown, Eye, Sparkles, ChevronRight, Lock, Users,
} from "lucide-react";

const STAT_ICON = { vigor: Heart, strength: Sword, agility: Wind, status: Crown, acuity: Eye };
const VITAL_META = {
  hp: { label: "HP", color: "#ef4444", from: "from-red-500", to: "to-rose-600" },
  mp: { label: "MP", color: "#38bdf8", from: "from-sky-500", to: "to-cyan-500" },
  stamina: { label: "STAM", color: "#22c55e", from: "from-emerald-500", to: "to-lime-500" },
};

export default function AdminPartyOverviewPage() {
  const [rows, setRows] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data: players } = await api.get("/players");
      const details = await Promise.all(
        players.map((p) => api.get(`/players/${p.id}`).then((r) => r.data).catch(() => null))
      );
      setRows(details.filter(Boolean));
    } catch { /* noop */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!rows) return <div className="py-16 text-center font-mono text-sky-400/60 animate-pulse">[ ASSEMBLING PARTY... ]</div>;

  return (
    <div className="space-y-8 animate-boot">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-block px-3 py-1 rounded-full glass-panel text-[9px] tracking-[0.3em] uppercase text-sky-300 mb-3">
            [ PARTY OVERVIEW // DM DASHBOARD ]
          </div>
          <h1 className="font-display font-black text-4xl sm:text-5xl text-sky-100 tracking-tight">
            The Ensemble
          </h1>
          <p className="font-mono text-xs text-sky-400/70 mt-2">
            &gt; Every incarnation's vitals, stats, coins, and active caps in one screen.
          </p>
        </div>
        <div className="glass-panel px-4 py-2 rounded-lg flex items-center gap-2 self-start md:self-auto">
          <Users size={14} className="text-sky-300" />
          <span className="font-mono font-bold text-sky-100">{rows.length}</span>
          <span className="text-[9px] uppercase tracking-widest text-sky-400/60">players</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="glass-panel rounded-2xl p-16 text-center">
          <p className="font-display text-xl text-sky-200">No party members yet.</p>
          <p className="font-mono text-xs text-sky-400/70 mt-2">Register some players to begin the story.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {rows.map((row) => <PartyCard key={row.player.id} row={row} />)}
        </div>
      )}
    </div>
  );
}

function PartyCard({ row }) {
  const { player, stats, stat_caps, vitals, unallocated_points, inventory, total } = row;
  const capsCount = Object.values(stat_caps || {}).filter((c) => c?.max != null).length;

  return (
    <Link
      to={`/admin/players/${player.id}`}
      data-testid={`party-card-${player.id}`}
      className="glass-panel glass-panel-hover rounded-2xl p-5 block relative overflow-hidden group"
    >
      <div className="flex items-start gap-4 mb-4">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center font-display font-black text-sky-950 text-2xl flex-shrink-0">
          {player.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-black text-xl text-sky-50 tracking-tight leading-none truncate">
            {player.name}
          </h3>
          <div className="text-[10px] font-mono uppercase tracking-widest text-sky-400/70 mt-1 truncate">
            {player.email}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip icon={<Coins size={10} className="text-yellow-300" />} label={player.coins} />
            {unallocated_points > 0 && (
              <Chip icon={<Sparkles size={10} className="text-yellow-300" />} label={`${unallocated_points} free`} highlight />
            )}
            <Chip label={`T ${total}`} />
            <Chip label={`INV ${inventory.length}`} />
            {capsCount > 0 && <Chip icon={<Lock size={10} className="text-red-300" />} label={`${capsCount} cap${capsCount === 1 ? "" : "s"}`} />}
          </div>
        </div>
        <ChevronRight size={16} className="text-sky-400/60 group-hover:text-sky-100 mt-1" />
      </div>

      {/* Vitals mini bars */}
      <div className="space-y-2 mb-4">
        {["hp", "mp", "stamina"].map((v) => {
          const meta = VITAL_META[v];
          const cur = vitals[v].current;
          const max = vitals[v].max;
          const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
          return (
            <div key={v}>
              <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.25em] text-sky-300 mb-0.5">
                <span style={{ color: meta.color }} className="font-bold">{meta.label}</span>
                <span className="text-sky-400/70">{cur} / {max}</span>
              </div>
              <div className="h-2 rounded-full bg-sky-950/70 overflow-hidden">
                <div className={`h-full bg-gradient-to-r ${meta.from} ${meta.to}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-5 gap-2 pt-3 border-t border-sky-400/10">
        {STAT_KEYS.map((k) => {
          const meta = STAT_META[k];
          const Icon = STAT_ICON[k];
          const cap = stat_caps?.[k];
          return (
            <div key={k} className="text-center">
              <div
                className="w-9 h-9 mx-auto rounded-lg flex items-center justify-center relative"
                style={{ background: `${meta.color}20`, color: meta.color }}
              >
                <Icon size={16} />
                {cap?.max != null && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 flex items-center justify-center text-[8px] text-sky-950 font-bold">
                    <Lock size={7} />
                  </span>
                )}
              </div>
              <div className="font-display font-black text-lg text-sky-100 mt-1 leading-none">{stats[k]}</div>
              <div className="text-[8px] font-mono uppercase tracking-widest text-sky-400/60 mt-0.5">
                {meta.label.slice(0, 3)}
              </div>
            </div>
          );
        })}
      </div>
    </Link>
  );
}

function Chip({ icon, label, highlight }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[9px] uppercase tracking-widest ${
      highlight ? "bg-yellow-400/15 text-yellow-200 border border-yellow-400/40" : "bg-sky-950/60 text-sky-200 border border-sky-400/20"
    }`}>
      {icon}
      {label}
    </span>
  );
}
