import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import ItemCard from "@/components/ItemCard";
import { RANKS, CATEGORIES } from "@/lib/api";
import { toast } from "sonner";

export default function ShopPage() {
  const { user, refresh } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState("All");
  const [filterRank, setFilterRank] = useState("All");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/items");
      setItems(data);
    } catch {
      toast.error("Failed to load shop");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const onBuy = async (item) => {
    try {
      await api.post("/purchase", { item_id: item.id });
      toast.success(`Acquired: ${item.name}`);
      refresh();
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Purchase failed");
    }
  };

  const filtered = items.filter((it) => {
    if (filterCat !== "All" && it.category !== filterCat) return false;
    if (filterRank !== "All" && it.rank !== filterRank) return false;
    return true;
  });

  const isPlayer = user?.role === "player";

  return (
    <div className="space-y-8 animate-boot">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-block px-3 py-1 rounded-full glass-panel text-[9px] tracking-[0.3em] uppercase text-sky-300 mb-3">
            [ SCENARIO SHOP // CHANNEL #BI-7623 ]
          </div>
          <h1 className="font-display font-black text-4xl sm:text-5xl lg:text-6xl text-sky-100 tracking-tight leading-none">
            The Dokkaebi&apos;s<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-300 via-cyan-300 to-sky-400">Bag of Wonders</span>
          </h1>
          <p className="font-mono text-xs text-sky-400/70 mt-3 tracking-wider max-w-lg">
            &gt; Choose well, incarnation. The Constellations are watching.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel rounded-xl p-4 flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <div className="text-[9px] uppercase tracking-widest text-sky-400/70 mb-2 font-mono">Category</div>
          <div className="flex flex-wrap gap-1.5">
            {["All", ...CATEGORIES].map((c) => (
              <button
                key={c}
                onClick={() => setFilterCat(c)}
                data-testid={`filter-cat-${c}`}
                className={`px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-mono transition-colors ${
                  filterCat === c
                    ? "bg-sky-500 text-sky-950 font-bold"
                    : "bg-sky-950/50 text-sky-300 hover:bg-sky-500/20 border border-sky-400/20"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <div className="text-[9px] uppercase tracking-widest text-sky-400/70 mb-2 font-mono">Rank</div>
          <div className="flex flex-wrap gap-1.5">
            {["All", ...RANKS].map((r) => (
              <button
                key={r}
                onClick={() => setFilterRank(r)}
                data-testid={`filter-rank-${r.replace(/\s/g, "-")}`}
                className={`px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-mono transition-colors ${
                  filterRank === r
                    ? "bg-sky-500 text-sky-950 font-bold"
                    : "bg-sky-950/50 text-sky-300 hover:bg-sky-500/20 border border-sky-400/20"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-16 font-mono text-sky-400/60 text-sm animate-pulse">
          [ INITIALIZING SHOP INTERFACE... ]
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel rounded-2xl p-16 text-center">
          <p className="font-display text-xl text-sky-200">The shelves are empty.</p>
          <p className="font-mono text-xs text-sky-400/70 mt-2">
            {items.length === 0
              ? "The Dokkaebi has yet to stock this channel."
              : "No items match your filters."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" data-testid="shop-grid">
          {filtered.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onBuy={onBuy}
              canBuy={isPlayer}
            />
          ))}
        </div>
      )}
    </div>
  );
}
