// Shared scenario formatting helpers

export const SCENARIO_TYPES = ["main", "sub", "hidden", "bounty"];

export const SCENARIO_TYPE_META = {
  main:   { label: "Main Scenario",   color: "bg-red-500",    text: "text-red-200",    accent: "border-red-400/60",    glow: "shadow-[0_0_60px_-15px_rgba(239,68,68,0.7)]" },
  sub:    { label: "Sub Scenario",    color: "bg-cyan-500",   text: "text-cyan-200",   accent: "border-cyan-400/60",   glow: "shadow-[0_0_60px_-15px_rgba(34,211,238,0.7)]" },
  hidden: { label: "Hidden Scenario", color: "bg-purple-500", text: "text-purple-200", accent: "border-purple-400/60", glow: "shadow-[0_0_60px_-15px_rgba(168,85,247,0.7)]" },
  bounty: { label: "Bounty",          color: "bg-yellow-500", text: "text-yellow-200", accent: "border-yellow-400/60", glow: "shadow-[0_0_60px_-15px_rgba(250,204,21,0.7)]" },
};

export function ordinal(n) {
  if (n == null || !Number.isFinite(Number(n))) return String(n ?? "");
  const num = Number(n);
  const s = ["th", "st", "nd", "rd"];
  const v = num % 100;
  return num + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Notification headline shown when a scenario arrives.
export function scenarioArrivalHeadline(scenarioType, scenarioNumber) {
  if (scenarioType === "main") {
    const n = scenarioNumber ? ordinal(scenarioNumber) : "next";
    return `The ${n} main scenario has arrived!`;
  }
  return `A ${scenarioType} scenario has arrived!`;
}

// Full scenario category label — "Sub (Personal)" when a sub scenario is targeted.
export function scenarioCategoryLabel(scenario) {
  const t = scenario.scenario_type;
  if (t === "sub" && (scenario.visible_to || []).length > 0) return "Sub (Personal)";
  return SCENARIO_TYPE_META[t]?.label || t;
}

// Formatted card title, e.g. "Main Scenario #3 – Kill the Serpent King"
export function scenarioCardTitle(scenario) {
  const t = scenario.scenario_type;
  if (t === "main") {
    const num = scenario.scenario_number ? ` #${scenario.scenario_number}` : "";
    return `Main Scenario${num} – ${scenario.title}`;
  }
  const meta = SCENARIO_TYPE_META[t];
  const label = meta ? meta.label : t;
  return `${label} – ${scenario.title}`;
}
