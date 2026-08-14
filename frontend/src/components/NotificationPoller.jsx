import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Coins, ScrollText, Sparkles } from "lucide-react";

const POLL_MS = 6000;

export default function NotificationPoller() {
  const { user, refresh } = useAuth();
  const timerRef = useRef(null);
  const seenIdsRef = useRef(new Set());

  useEffect(() => {
    if (!user || user.role !== "player") return;

    const poll = async () => {
      try {
        const { data } = await api.get("/notifications");
        if (!Array.isArray(data) || data.length === 0) return;

        const fresh = data.filter((n) => !seenIdsRef.current.has(n.id));
        if (fresh.length === 0) return;

        fresh.forEach((n) => {
          seenIdsRef.current.add(n.id);
          renderNotification(n);
        });

        // Mark all as seen server-side after showing
        try { await api.post("/notifications/mark-seen"); } catch { /* noop */ }
        // Refresh coin balance in header
        refresh();
      } catch { /* noop */ }
    };

    poll();
    timerRef.current = setInterval(poll, POLL_MS);
    return () => clearInterval(timerRef.current);
  }, [user, refresh]);

  return null;
}

function renderNotification(n) {
  const positive = n.amount > 0;

  if (n.kind === "grant") {
    toast.custom((id) => (
      <div className="glass-panel rounded-xl p-4 min-w-[320px] max-w-[420px] border-l-4 border-yellow-400/70 shadow-lg shadow-yellow-500/10">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-9 h-9 rounded-lg bg-yellow-400/20 flex items-center justify-center flex-shrink-0">
            <Coins size={18} className="text-yellow-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-sky-100 text-sm tracking-tight">
              {n.title}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-yellow-300/90 mt-0.5">
              {positive ? `+${n.amount}` : n.amount} coins
            </div>
            <div className="font-mono text-xs text-sky-300/80 mt-2 leading-relaxed">
              &gt; {n.message}
            </div>
          </div>
        </div>
      </div>
    ), { duration: 8000 });
    return;
  }

  if (n.kind === "scenario_cleared") {
    toast.custom(() => (
      <div className="glass-panel rounded-xl p-4 min-w-[320px] max-w-[420px] border-l-4 border-cyan-400/70 shadow-lg shadow-cyan-500/15">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-9 h-9 rounded-lg bg-cyan-400/20 flex items-center justify-center flex-shrink-0">
            <Sparkles size={18} className="text-cyan-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-300/90">
              [ Scenario Cleared ]
            </div>
            <div className="font-display font-bold text-sky-100 text-sm tracking-tight mt-1">
              {n.title.replace(/^Scenario Cleared — /, "")}
            </div>
            {n.amount > 0 && (
              <div className="font-mono text-[10px] uppercase tracking-widest text-yellow-300/90 mt-1">
                +{n.amount} coins
              </div>
            )}
            <div className="font-mono text-xs text-sky-300/80 mt-2 leading-relaxed">
              &gt; {n.message}
            </div>
          </div>
        </div>
      </div>
    ), { duration: 10000 });
    return;
  }

  // Fallback
  toast.custom(() => (
    <div className="glass-panel rounded-xl p-4 border-l-4 border-sky-400/70">
      <div className="flex items-center gap-3">
        <ScrollText size={16} className="text-sky-300" />
        <span className="font-mono text-xs text-sky-200">{n.title}</span>
      </div>
    </div>
  ));
}
