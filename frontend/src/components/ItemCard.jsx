import { RANK_META, API } from "@/lib/api";
import RankBadge from "./RankBadge";
import { Coins, Package, Zap, Star, Sparkles } from "lucide-react";

const CATEGORY_ICON = {
  Items: Package,
  Skills: Zap,
  Story: Sparkles,
  "Star Relics": Star,
};

export default function ItemCard({ item, onBuy, canBuy = false, actions = null }) {
  const meta = RANK_META[item.rank] || {};
  const CatIcon = CATEGORY_ICON[item.category] || Package;
  const token = localStorage.getItem("dokkaebi_token") || "";
  const imageSrc = item.image_path
    ? `${API}/files/${item.image_path}?auth=${encodeURIComponent(token)}`
    : null;

  const soldOut = item.stock === 0;

  return (
    <div
      data-testid={`item-card-${item.id}`}
      className={`glass-panel glass-panel-hover rounded-2xl overflow-hidden flex flex-col relative ${meta.glowClass || ""}`}
    >
      {/* Image */}
      <div className="relative h-48 bg-sky-950/50 overflow-hidden">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={item.name}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-30">
            <CatIcon size={64} className="text-sky-300" />
          </div>
        )}
        <div className="absolute top-3 left-3">
          <RankBadge rank={item.rank} size="md" />
        </div>
        <div className="absolute top-3 right-3">
          <span className="glass-panel text-[10px] uppercase tracking-widest px-2 py-1 rounded-full text-sky-200 flex items-center gap-1">
            <CatIcon size={10} /> {item.category}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col gap-3">
        <div>
          <h3 className="font-display font-bold text-lg text-sky-100 tracking-tight leading-tight" data-testid={`item-name-${item.id}`}>
            {item.name}
          </h3>
          {item.description && (
            <p className="text-xs text-sky-300/70 mt-1.5 leading-relaxed line-clamp-3 font-mono">
              {item.description}
            </p>
          )}
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 pt-3 border-t border-sky-400/10">
          <div className="flex items-center gap-1.5 text-sky-300">
            <Coins size={16} className="text-yellow-300" />
            <span className="font-mono font-bold text-lg text-sky-100" data-testid={`item-price-${item.id}`}>{item.price}</span>
            <span className="text-[10px] uppercase tracking-widest text-sky-400/60">coins</span>
          </div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-sky-400/60">
            {item.stock === -1 ? "∞ stock" : `${item.stock} left`}
          </div>
        </div>

        {actions}

        {canBuy && (
          <button
            onClick={() => onBuy?.(item)}
            disabled={soldOut}
            data-testid={`buy-btn-${item.id}`}
            className="w-full py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-sky-950 font-display font-bold uppercase text-xs tracking-widest disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
          >
            {soldOut ? "Sold Out" : "Purchase"}
          </button>
        )}
      </div>
    </div>
  );
}
