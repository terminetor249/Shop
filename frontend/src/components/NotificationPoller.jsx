import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Coins, Sparkles, Star, ScrollText, Send } from "lucide-react";
import { scenarioArrivalHeadline, SCENARIO_TYPE_META } from "@/lib/scenario";

const POLL_MS = 6000;

export default function NotificationPoller() {
  const { user, refresh } = useAuth();
  const [queue, setQueue] = useState([]);
  const seenIdsRef = useRef(new Set());
  const timerRef = useRef(null);
  const audioCtxRef = useRef(null);

  const playChime = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audioCtxRef.current = new AC();
      }
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;
      [880, 1174.66, 1567.98].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.09);
        gain.gain.setValueAtTime(0.0001, now + i * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.12, now + i * 0.09 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.09);
        osc.stop(now + i * 0.09 + 0.4);
      });
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    if (!user || user.role !== "player") return;
    const poll = async () => {
      try {
        const { data } = await api.get("/notifications");
        if (!Array.isArray(data) || data.length === 0) return;
        const fresh = data.filter((n) => !seenIdsRef.current.has(n.id));
        if (fresh.length === 0) return;
        fresh.forEach((n) => seenIdsRef.current.add(n.id));
        setQueue((q) => [...q, ...fresh]);
        playChime();
      } catch { /* noop */ }
    };
    poll();
    timerRef.current = setInterval(poll, POLL_MS);
    return () => clearInterval(timerRef.current);
  }, [user, playChime]);

  const dismiss = async () => {
    const current = queue[0];
    if (!current) return;
    try {
      await api.post("/notifications/mark-seen", { ids: [current.id] });
    } catch { /* noop */ }
    setQueue((q) => q.slice(1));
    refresh();
  };

  if (!user || user.role !== "player" || queue.length === 0) return null;
  const current = queue[0];
  return (
    <NotificationOverlay
      notif={current}
      remaining={queue.length}
      onDismiss={dismiss}
    />
  );
}

function NotificationOverlay({ notif, remaining, onDismiss }) {
  const isScenarioCleared = notif.kind === "scenario_cleared";
  const isScenarioArrival = notif.kind === "scenario_arrival";
  const isConstellation = notif.kind === "constellation";
  const isTransfer = notif.kind === "coin_transfer";
  const isSystem = isConstellation && !!notif.system_message;
  const positive = notif.amount >= 0;
  const hasCoins = notif.amount && notif.amount !== 0;

  // Accent picker
  let accent;
  if (isScenarioArrival) {
    const st = notif.scenario_type || "main";
    const stMeta = SCENARIO_TYPE_META[st] || SCENARIO_TYPE_META.main;
    const ringMap = {
      main: "ring-red-400/70",
      sub: "ring-cyan-400/70",
      hidden: "ring-purple-400/70",
      bounty: "ring-yellow-400/70",
    };
    const chipMap = {
      main: "bg-red-500/20 text-red-200 border-red-400/60",
      sub: "bg-cyan-500/20 text-cyan-200 border-cyan-400/60",
      hidden: "bg-purple-500/20 text-purple-200 border-purple-400/60",
      bounty: "bg-yellow-500/20 text-yellow-200 border-yellow-400/60",
    };
    accent = { ring: ringMap[st], glow: stMeta.glow, chip: chipMap[st], Icon: ScrollText };
  } else if (isScenarioCleared) {
    accent = { ring: "ring-cyan-400/70", glow: "shadow-[0_0_80px_10px_rgba(34,211,238,0.4)]", chip: "bg-cyan-400/20 text-cyan-200 border-cyan-400/60", Icon: Sparkles };
  } else if (isTransfer) {
    accent = { ring: "ring-emerald-300/70", glow: "shadow-[0_0_80px_10px_rgba(16,185,129,0.35)]", chip: "bg-emerald-400/20 text-emerald-200 border-emerald-400/60", Icon: Send };
  } else if (isSystem) {
    accent = { ring: "ring-sky-300/70", glow: "shadow-[0_0_80px_10px_rgba(56,189,248,0.4)]", chip: "bg-sky-400/20 text-sky-100 border-sky-400/60", Icon: Sparkles };
  } else if (positive) {
    accent = { ring: "ring-yellow-300/70", glow: "shadow-[0_0_80px_10px_rgba(250,204,21,0.35)]", chip: "bg-yellow-400/20 text-yellow-200 border-yellow-400/60", Icon: Coins };
  } else {
    accent = { ring: "ring-red-400/70", glow: "shadow-[0_0_80px_10px_rgba(239,68,68,0.35)]", chip: "bg-red-500/20 text-red-200 border-red-400/60", Icon: Coins };
  }
  const AccentIcon = accent.Icon;

  // Header chip label
  let header;
  if (isScenarioArrival) header = "[ NEW SCENARIO ]";
  else if (isScenarioCleared) header = "[ SCENARIO CLEARED ]";
  else if (isTransfer) header = "[ INCOMING TRANSFER ]";
  else if (isSystem) header = "[ SYSTEM MESSAGE ]";
  else header = notif.many_constellations ? "[ CHORUS OF CONSTELLATIONS ]" : "[ CONSTELLATION MESSAGE ]";

  // Secondary sponsorship line
  let sponsorLine = null;
  if (hasCoins) {
    if (isScenarioCleared) {
      sponsorLine = positive
        ? `You've been rewarded ${notif.amount} coins`
        : `You've lost ${Math.abs(notif.amount)} coins`;
    } else if (isTransfer) {
      sponsorLine = `You've received ${notif.amount} coins from ${notif.sender_name || "another player"}`;
    } else if (isConstellation) {
      sponsorLine = positive
        ? `You've been sponsored ${notif.amount} coins`
        : `You've been fined ${Math.abs(notif.amount)} coins`;
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      data-testid="notification-overlay"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#050A15]/85 backdrop-blur-md notif-backdrop-in" />

      {/* Radial scan burst */}
      <div className="absolute inset-0 pointer-events-none notif-burst" />

      <div
        className={`relative glass-panel rounded-2xl p-8 sm:p-10 max-w-lg w-full ring-2 ${accent.ring} ${accent.glow} notif-panel-in`}
      >
        {/* Corner marks */}
        <span className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-sky-300/70" />
        <span className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-sky-300/70" />
        <span className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-sky-300/70" />
        <span className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-sky-300/70" />

        {/* Header stripe */}
        <div className="flex items-center justify-between mb-6">
          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.3em] border ${accent.chip}`}>
            <AccentIcon size={12} />
            {header}
          </span>
          {remaining > 1 && (
            <span className="font-mono text-[10px] uppercase tracking-widest text-sky-400/70">
              {remaining - 1} more
            </span>
          )}
        </div>

        {/* Icon halo */}
        <div className="flex justify-center mb-5">
          <div className={`relative w-20 h-20 rounded-full flex items-center justify-center ${accent.chip} border`}>
            <AccentIcon size={36} />
            <span className={`absolute inset-0 rounded-full ${accent.ring} ring-2 notif-halo`} />
          </div>
        </div>

        {/* Primary line — bracketed ORV quote */}
        <div className="mt-1">
          <p className="font-display font-bold text-2xl sm:text-[26px] text-sky-50 text-center tracking-tight leading-snug">
            <span className="text-sky-300">[</span>
            {isScenarioArrival ? (
              <span className="text-sky-100">{scenarioArrivalHeadline(notif.scenario_type, notif.scenario_number)}</span>
            ) : isTransfer ? (
              <span className="text-sky-100">You received {notif.amount} coins from <span className="text-emerald-300">{notif.sender_name || "another player"}</span></span>
            ) : isSystem ? (
              <span className="text-sky-100">{notif.reason}</span>
            ) : isConstellation ? (
              <>
                {notif.many_constellations ? (
                  <>Many constellations </>
                ) : (
                  <>The constellation <span className="text-yellow-200">{notif.constellation_name || "Unknown"}</span>, </>
                )}
                <span className="text-sky-100">{notif.reason}</span>
              </>
            ) : (
              <span className="text-sky-100">{notif.scenario_title || notif.reason}</span>
            )}
            <span className="text-sky-300">]</span>
          </p>
          {isScenarioArrival && notif.scenario_title && (
            <p className="font-mono text-xs text-center text-sky-300/80 mt-3">
              &gt; {notif.scenario_title}
            </p>
          )}
          {isTransfer && notif.reason && (
            <p className="font-mono text-xs text-center text-sky-300/80 mt-3">
              &gt; {notif.reason}
            </p>
          )}
        </div>

        {/* Sponsorship line */}
        {sponsorLine && (
          <div className={`text-center mt-4 font-mono font-bold text-lg ${positive ? "text-yellow-300" : "text-red-300"}`}>
            {sponsorLine}
          </div>
        )}

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          data-testid="notification-dismiss"
          className={`mt-8 w-full py-4 rounded-lg bg-sky-500 hover:bg-sky-400 active:scale-[0.98] text-sky-950 font-display font-black uppercase text-sm tracking-[0.35em] transition-colors flex items-center justify-center gap-2 ${accent.glow}`}
          autoFocus
        >
          <Star size={16} className="fill-current" />
          Acknowledge
        </button>

        <div className="mt-3 text-center font-mono text-[9px] uppercase tracking-[0.3em] text-sky-400/50">
          &gt; Press to close &lt;
        </div>
      </div>
    </div>
  );
}
