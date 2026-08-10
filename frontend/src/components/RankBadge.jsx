import { RANK_META } from "@/lib/api";

export default function RankBadge({ rank, size = "md", className = "" }) {
  const meta = RANK_META[rank] || RANK_META.F;
  const isRelic = rank === "Star Relic";
  const sizeClasses = {
    sm: "text-[10px] px-2 py-0.5",
    md: "text-xs px-3 py-1",
    lg: "text-sm px-4 py-1.5",
  }[size];

  const style = isRelic
    ? { background: meta.color, color: "#050A15" }
    : { background: meta.color, color: "#050A15" };

  return (
    <span
      className={`rank-badge inline-flex items-center rounded-full uppercase ${sizeClasses} ${className}`}
      style={style}
      data-testid={`rank-badge-${rank.replace(/\s/g, "-")}`}
    >
      {rank}
    </span>
  );
}
