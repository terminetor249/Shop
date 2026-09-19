import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api, API, STAT_KEYS, STAT_META } from "@/lib/api";
import { toast } from "sonner";
import RankBadge from "@/components/RankBadge";
import { ArrowLeft, Coins, Heart, Sword, Wind, Crown, Eye, Plus, Minus, Lock, Save, X, Sparkles, Trash2, AlertTriangle } from "lucide-react";

const STAT_ICON = { vigor: Heart, strength: Sword, agility: Wind, status: Crown, acuity: Eye };

export default function AdminPlayerDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [capDraft, setCapDraft] = useState({}); // {stat: {max, note}}
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const token = localStorage.getItem("dokkaebi_token") || "";

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/players/${id}`);
      setData(data);
      const draft = {};
      STAT_KEYS.forEach((k) => {
        draft[k] = data.stat_caps?.[k] || { max: "", note: "" };
      });
      setCapDraft(draft);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to load player");
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const adjust = async (stat, delta) => {
    try {
      await api.post(`/players/${id}/stats/adjust`, { stat, delta });
      toast.success(`${STAT_META[stat].label} ${delta > 0 ? "+" : ""}${delta}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Adjust failed");
    }
  };

  const saveCap = async (stat) => {
    const draft = capDraft[stat] || {};
    const maxVal = draft.max === "" || draft.max == null ? null : parseInt(draft.max);
    try {
      await api.post(`/players/${id}/stats/cap`, {
        stat,
        max: maxVal,
        note: draft.note || "",
      });
      toast.success(maxVal == null ? `${STAT_META[stat].label} cap removed` : `${STAT_META[stat].label} capped at ${maxVal}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Cap failed");
    }
  };

  const clearCap = async (stat) => {
    setCapDraft((c) => ({ ...c, [stat]: { max: "", note: "" } }));
    try {
      await api.post(`/players/${id}/stats/cap`, { stat, max: null, note: "" });
      toast.success(`${STAT_META[stat].label} cap removed`);
      load();
    } catch (err) {
      toast.error("Failed");
    }
  };

  const onDeletePlayer = async () => {
    setDeleting(true);
    try {
      const { data: res } = await api.delete(`/players/${id}`);
      toast.success(`Player "${res.removed}" removed from the story`);
      nav("/admin/players");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Delete failed");
      setDeleting(false);
    }
  };

  if (!data) return <div className="py-16 text-center font-mono text-sky-400/60 animate-pulse">[ FETCHING PLAYER RECORD... ]</div>;

  const { player, stats, stat_caps, total, inventory, vitals, unallocated_points } = data;

  return (
    <div className="space-y-8 animate-boot">
      <div className="flex items-center gap-4 justify-between">
        <Link to="/admin/players" data-testid="back-to-players" className="text-sky-400 hover:text-sky-100 flex items-center gap-1 font-mono text-xs uppercase tracking-widest">
          <ArrowLeft size={14} /> Back
        </Link>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          data-testid="delete-player-btn"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-400/40 text-red-200 font-mono text-[10px] uppercase tracking-widest transition-colors"
        >
          <Trash2 size={12} /> Remove Player
        </button>
      </div>

      <div className="glass-panel rounded-2xl p-6 flex flex-col md:flex-row md:items-center gap-6">
        <div className="w-20 h-20 rounded-full bg-sky-500 flex items-center justify-center font-display font-black text-sky-950 text-3xl">
          {player.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="inline-block px-2 py-0.5 rounded-full glass-panel text-[9px] tracking-[0.3em] uppercase text-sky-300 mb-2">
            [ INCARNATION RECORD ]
          </div>
          <h1 className="font-display font-black text-3xl sm:text-4xl text-sky-100 tracking-tight leading-none">
            {player.name}
          </h1>
          <div className="text-xs font-mono text-sky-400/70 mt-1">{player.email}</div>
        </div>
        <div className="flex flex-wrap gap-3 items-stretch">
          <StatChip label="Coins" value={player.coins} icon={<Coins size={14} className="text-yellow-300" />} />
          <StatChip label="Total Pts" value={total} />
          <StatChip label="Free Pts" value={unallocated_points} icon={<Sparkles size={12} className="text-yellow-300" />} />
          <StatChip label="HP" value={`${vitals.hp.current}/${vitals.hp.max}`} icon={<Heart size={12} className="text-red-400" />} />
          <StatChip label="MP" value={`${vitals.mp.current}/${vitals.mp.max}`} />
          <StatChip label="Stam" value={`${vitals.stamina.current}/${vitals.stamina.max}`} />
          <StatChip label="Inventory" value={inventory.length} />
        </div>
      </div>

      {/* Stats grid — DM edit view */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-sky-400 mb-3">
          [ STAT MANAGEMENT ]
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {STAT_KEYS.map((k) => {
            const meta = STAT_META[k];
            const Icon = STAT_ICON[k];
            const level = stats[k];
            const cap = stat_caps?.[k];
            const draft = capDraft[k] || { max: "", note: "" };

            return (
              <div
                key={k}
                data-testid={`admin-stat-${k}`}
                className="glass-panel rounded-2xl p-5 space-y-4"
                style={{ borderLeft: `4px solid ${meta.color}` }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg flex items-center justify-center"
                         style={{ background: `${meta.color}25`, color: meta.color }}>
                      <Icon size={22} />
                    </div>
                    <div>
                      <div className="font-display font-black text-xl text-sky-50 leading-none">{meta.label}</div>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-sky-400/70 mt-1">
                        Lv {level}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => adjust(k, -1)}
                      data-testid={`adjust-minus-${k}`}
                      className="w-9 h-9 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 flex items-center justify-center transition-colors"
                    >
                      <Minus size={14} />
                    </button>
                    <button
                      onClick={() => adjust(k, 1)}
                      data-testid={`adjust-plus-${k}`}
                      className="w-9 h-9 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 flex items-center justify-center transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* Cap section */}
                <div className="pt-3 border-t border-sky-400/10">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-sky-400/70 flex items-center gap-1 mb-2">
                    <Lock size={10} />
                    Stat Cap {cap?.max != null && <span className="text-red-300">— currently Lv {cap.max}{cap.note ? ` (${cap.note})` : ""}</span>}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      min="0"
                      placeholder="Max Lv"
                      value={draft.max}
                      onChange={(e) => setCapDraft((c) => ({ ...c, [k]: { ...draft, max: e.target.value } }))}
                      data-testid={`cap-max-${k}`}
                      className="px-2 py-1.5 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    />
                    <input
                      type="text"
                      placeholder="Scenario / note"
                      value={draft.note}
                      onChange={(e) => setCapDraft((c) => ({ ...c, [k]: { ...draft, note: e.target.value } }))}
                      data-testid={`cap-note-${k}`}
                      className="col-span-2 px-2 py-1.5 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => saveCap(k)}
                      data-testid={`save-cap-${k}`}
                      className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-sky-950 font-mono font-bold text-[10px] uppercase tracking-widest rounded-lg transition-colors"
                    >
                      <Save size={11} /> Save Cap
                    </button>
                    {cap?.max != null && (
                      <button
                        onClick={() => clearCap(k)}
                        data-testid={`clear-cap-${k}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 font-mono font-bold text-[10px] uppercase tracking-widest rounded-lg transition-colors"
                      >
                        <X size={11} /> Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inventory */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-sky-400 mb-3">
          [ INVENTORY ({inventory.length}) ]
        </div>
        {inventory.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center font-mono text-sm text-sky-400/70">
            Player has no items yet.
          </div>
        ) : (
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="divide-y divide-sky-400/10">
              {inventory.map((inv) => {
                const it = inv.item_snapshot;
                const imageSrc = it.image_path
                  ? `${API}/files/${it.image_path}?auth=${encodeURIComponent(token)}`
                  : null;
                return (
                  <div key={inv.id} className="p-4 flex items-center gap-4" data-testid={`admin-inv-${inv.id}`}>
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-sky-950/50 flex-shrink-0">
                      {imageSrc && <img src={imageSrc} alt={it.name} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = "none"; }} />}
                    </div>
                    <RankBadge rank={it.rank} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-bold text-sky-100 truncate">{it.name}</div>
                      <div className="text-[10px] font-mono text-sky-400/70 uppercase tracking-widest">
                        {it.category}{inv.uses_remaining != null ? ` · ${inv.uses_remaining}/${it.uses} uses` : ""}{inv.used_up ? " · consumed" : ""}
                      </div>
                    </div>
                    <div className="text-[10px] font-mono text-sky-400/70">
                      {new Date(inv.purchased_at).toLocaleDateString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4" data-testid="delete-confirm-modal">
          <div className="absolute inset-0 bg-[#050A15]/85 backdrop-blur-md notif-backdrop-in" onClick={() => !deleting && setConfirmDelete(false)} />
          <div className="relative glass-panel rounded-2xl p-8 max-w-md w-full ring-2 ring-red-400/70 shadow-[0_0_80px_10px_rgba(239,68,68,0.35)] notif-panel-in">
            <span className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-red-300/70" />
            <span className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-red-300/70" />
            <span className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-red-300/70" />
            <span className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-red-300/70" />

            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-200 border border-red-400/60 flex items-center justify-center">
                <AlertTriangle size={30} />
              </div>
            </div>

            <div className="text-center mb-2">
              <span className="inline-block px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.3em] bg-red-500/20 text-red-200 border border-red-400/60">
                [ REMOVAL WARNING ]
              </span>
            </div>

            <h2 className="font-display font-black text-2xl sm:text-3xl text-sky-50 text-center tracking-tight leading-tight mt-3">
              Are you sure?
            </h2>
            <p className="font-mono text-sm text-sky-200 text-center mt-3">
              This will permanently erase <span className="text-red-200 font-bold">{player.name}</span> from the story — their account, inventory, transactions, and notifications will all be lost.
            </p>

            <div className="flex gap-3 mt-8">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                data-testid="delete-cancel"
                className="flex-1 py-3 rounded-lg bg-sky-950/60 hover:bg-sky-500/20 border border-sky-400/25 text-sky-100 font-display font-bold uppercase text-xs tracking-widest transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onDeletePlayer}
                disabled={deleting}
                data-testid="delete-confirm"
                className="flex-1 py-3 rounded-lg bg-red-500 hover:bg-red-400 text-red-950 font-display font-bold uppercase text-xs tracking-widest transition-colors disabled:opacity-50"
              >
                {deleting ? "Removing..." : "Yes, remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatChip({ label, value, icon }) {
  return (
    <div className="glass-panel px-4 py-2 rounded-lg text-center">
      <div className="text-[9px] font-mono uppercase tracking-widest text-sky-400/70">{label}</div>
      <div className="font-display font-black text-xl text-sky-100 flex items-center justify-center gap-1 mt-0.5">
        {icon} {value}
      </div>
    </div>
  );
}
