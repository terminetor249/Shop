import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import ItemCard from "@/components/ItemCard";

export default function InventoryPage() {
  const [inv, setInv] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/inventory");
        setInv(data);
      } catch { /* noop */ }
      setLoading(false);
    })();
  }, []);

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
          {inv.map((it) => (
            <ItemCard
              key={it.id}
              item={it.item_snapshot}
              actions={
                <div className="text-[10px] font-mono uppercase tracking-widest text-sky-400/70">
                  Acquired: {new Date(it.purchased_at).toLocaleDateString()}
                </div>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
