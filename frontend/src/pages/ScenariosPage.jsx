import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const TYPE_META = {
  main: { color: "bg-red-500", label: "Main Scenario", accent: "border-red-400/60" },
  sub: { color: "bg-cyan-500", label: "Sub Scenario", accent: "border-cyan-400/60" },
  bounty: { color: "bg-yellow-500", label: "Bounty", accent: "border-yellow-400/60" },
};

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/scenarios");
        setScenarios(data);
      } catch { /* noop */ }
      setLoading(false);
    })();
  }, []);

  const main = scenarios.filter((s) => s.scenario_type === "main");
  const sub = scenarios.filter((s) => s.scenario_type === "sub");
  const bounty = scenarios.filter((s) => s.scenario_type === "bounty");

  return (
    <div className="space-y-8 animate-boot">
      <div>
        <div className="inline-block px-3 py-1 rounded-full glass-panel text-[9px] tracking-[0.3em] uppercase text-sky-300 mb-3">
          [ INCOMING TRANSMISSION ]
        </div>
        <h1 className="font-display font-black text-4xl sm:text-5xl text-sky-100 tracking-tight">
          Your Scenarios
        </h1>
        <p className="font-mono text-xs text-sky-400/70 mt-2 tracking-wider">
          &gt; The Constellations watch. Complete these to earn rewards.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16 font-mono text-sky-400/60 text-sm animate-pulse">
          [ RECEIVING BROADCAST... ]
        </div>
      ) : scenarios.length === 0 ? (
        <div className="glass-panel rounded-2xl p-16 text-center">
          <p className="font-display text-xl text-sky-200">No active scenarios.</p>
          <p className="font-mono text-xs text-sky-400/70 mt-2">
            The Dokkaebi has not selected a story for you yet.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {main.length > 0 && (
            <ScenarioSection title="Main Scenarios" scenarios={main} large />
          )}
          <div className="grid md:grid-cols-2 gap-6">
            {sub.length > 0 && <ScenarioSection title="Sub Scenarios" scenarios={sub} />}
            {bounty.length > 0 && <ScenarioSection title="Bounties" scenarios={bounty} />}
          </div>
        </div>
      )}
    </div>
  );
}

function ScenarioSection({ title, scenarios, large = false }) {
  return (
    <div className="space-y-3">
      <div className="font-mono text-[10px] uppercase tracking-widest text-sky-400">
        [ {title} ]
      </div>
      <div className={`grid gap-4 ${large ? "" : "grid-cols-1"}`}>
        {scenarios.map((s) => {
          const meta = TYPE_META[s.scenario_type];
          return (
            <div
              key={s.id}
              data-testid={`scenario-${s.id}`}
              className={`glass-panel rounded-2xl border-l-4 ${meta.accent} ${large ? "p-8" : "p-5"} ${s.cleared_at ? "opacity-70" : ""}`}
            >
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className={`${meta.color} text-sky-950 font-display font-bold text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full`}>
                  {meta.label}
                </span>
                {s.cleared_at && (
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-mono font-bold text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full">
                    ✓ Cleared
                  </span>
                )}
              </div>
              <h3 className={`font-display font-black text-sky-100 tracking-tight ${large ? "text-3xl" : "text-lg"}`}>
                {s.title}
              </h3>
              {s.description && (
                <p className={`text-sky-300/80 font-mono mt-2 leading-relaxed ${large ? "text-sm" : "text-xs"}`}>
                  {s.description}
                </p>
              )}
              {(s.reward || s.reward_coins > 0) && (
                <div className={`mt-4 pt-3 border-t border-sky-400/10 font-mono text-yellow-300/90 ${large ? "text-sm" : "text-xs"}`}>
                  &gt; Reward: {s.reward}{s.reward_coins > 0 ? ` (+${s.reward_coins} coins)` : ""}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
