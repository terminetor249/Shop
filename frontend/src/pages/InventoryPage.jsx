import { useEffect, useState } from "react";
import { api, API } from "@/lib/api";
import { toast } from "sonner";
import RankBadge from "@/components/RankBadge";
import { Package, Zap, Sparkles, Coins, Play } from "lucide-react";

const CATEGORY_ICON = {
  Items: Package,
  Skills: Zap,
  Story: Sparkles,
};

export default function InventoryPage() {
  const [inv, setInv] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get("/inventory");
      setInv(data);
    } catch { /* noop */ }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const onUse = async (invItem) => {
    setBusyId(invItem.id);
    try {
      const { data } = await api.post(`/inventory/${invItem.id}/use`);
      const consumed = data.used_up;
      toast.success(consumed
        ? `Used "${invItem.item_snapshot.name}" — item consumed`
        : `Used "${invItem.item_snapshot.name}" — ${data.uses_remaining} use(s) left`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Use failed");
    }
    setBusyId(null);
  };

  const token = localStorage.getItem("dokkaebi_token") || "";

  return (
    <div className="space-y-6 animate-boot">
      <div>
        <div className="inline-block px-3 py-1 rounded-full glass-panel text-[9px] tracking-[0.3em] uppercase text-sky-300 mb-3">
          [ INVENTORY // ACQUIRED ITEMS ]
        </div>
        <h1 className="font-display font-black text-4xl text-sky-100 tracking-tight">Your Vault</h1>
        <p className="font-mono text-xs text-sky-400/70 mt-2">
          &gt; Items, skills, and relics you have claimed.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16 font-mono text-sky-400/60 text-sm animate-pulse">[ LOADING VAULT... ]</div>
      ) : inv.length === 0 ? (
        <div className="glass-panel rounded-2xl p-16 text-center">
          <p className="font-display text-xl text-sky-200">Vault is empty.</p>
          <p className="font-mono text-xs text-sky-400/70 mt-2">Visit the shop and start acquiring power.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {inv.map((entry) => {
            const item = entry.item_snapshot;
            const CatIcon = CATEGORY_ICON[item.category] || Package;
            const imageSrc = item.image_path
              ? `${API}/files/${item.image_path}?auth=${encodeURIComponent(token)}`
              : null;
            const consumable = entry.uses_remaining != null;
            const canUse = consumable && entry.uses_remaining > 0 && !entry.used_up;

            return (
              <div
                key={entry.id}
                data-testid={`inv-card-${entry.id}`}
                className="glass-panel glass-panel-hover rounded-2xl overflow-hidden flex flex-col relative"
              >
                <div className="relative h-44 bg-sky-950/50 overflow-hidden">
                  {imageSrc ? (
                    <img src={imageSrc} alt={item.name} className="w-full h-full object-cover"
                         onError={(e) => { e.target.style.display = "none"; }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center opacity-30">
                      <CatIcon size={56} className="text-sky-300" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3">
                    <RankBadge rank={item.rank} size="md" />
                  </div>
                  {consumable && (
                    <div className="absolute top-3 right-3 glass-panel px-2 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest text-sky-100" data-testid={`inv-uses-${entry.id}`}>
                      {entry.uses_remaining} / {item.uses} uses
                    </div>
                  )}
                </div>

                <div className="p-5 flex-1 flex flex-col gap-3">
                  <div>
                    <h3 className="font-display font-bold text-lg text-sky-100 tracking-tight leading-tight">
                      {item.name}
                    </h3>
                    {item.description && (
                      <p className="text-xs text-sky-300/70 mt-1.5 leading-relaxed line-clamp-3 font-mono">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-auto pt-3 border-t border-sky-400/10 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-sky-400/70">
                    <span>{item.category}</span>
                    <span>{new Date(entry.purchased_at).toLocaleDateString()}</span>
                  </div>

                  {consumable && (
                    <button
                      onClick={() => onUse(entry)}
                      disabled={!canUse || busyId === entry.id}
                      data-testid={`use-btn-${entry.id}`}
                      className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-display font-bold uppercase text-xs tracking-widest disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <Play size={12} className="fill-current" />
                      {busyId === entry.id ? "Using..." : canUse ? `Use (${entry.uses_remaining} left)` : "Depleted"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
