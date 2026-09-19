import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { SCENARIO_TYPE_META } from "@/lib/scenario";
import { ScenarioBlock } from "@/pages/AdminScenariosPage";

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

  const groups = ["main", "sub", "hidden", "bounty"].map((t) => ({
    type: t,
    scenarios: scenarios.filter((s) => s.scenario_type === t),
  }));

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
        <div className="space-y-10">
          {groups.map(({ type, scenarios }) =>
            scenarios.length === 0 ? null : (
              <section key={type} className="space-y-3">
                <div className="font-mono text-[10px] uppercase tracking-widest text-sky-400">
                  [ {SCENARIO_TYPE_META[type].label}s ]
                </div>
                <div className="grid gap-4">
                  {scenarios.map((s) => (
                    <ScenarioBlock
                      key={s.id}
                      scenario={s}
                      meta={SCENARIO_TYPE_META[s.scenario_type]}
                      cleared={!!s.cleared_at}
                      dataTestId={`scenario-${s.id}`}
                    />
                  ))}
                </div>
              </section>
            )
          )}
        </div>
      )}
    </div>
  );
}
