import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Plus, Trash2, Edit3, Eye, EyeOff, CheckCircle2, X as XIcon,
} from "lucide-react";
import {
  SCENARIO_TYPES,
  SCENARIO_TYPE_META,
  scenarioCategoryLabel,
  scenarioCardTitle,
  scenarioArrivalHeadline,
} from "@/lib/scenario";

const empty = {
  title: "",
  description: "",
  scenario_type: "main",
  visible_to: [],
  reward: "",
  reward_coins: 0,
  scenario_number: "",
  difficulty: "",
  clear_conditions: [],
  time_limit: "",
  failure: "",
  notes: "",
};

export default function AdminScenariosPage() {
  const [scenarios, setScenarios] = useState([]);
  const [players, setPlayers] = useState([]);
  const [form, setForm] = useState(empty);
  const [conditionDraft, setConditionDraft] = useState("");
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    const [s, p] = await Promise.all([api.get("/scenarios"), api.get("/players")]);
    setScenarios(s.data);
    setPlayers(p.data);
  };
  useEffect(() => { load(); }, []);

  const togglePlayer = (id) => {
    setForm((f) => ({
      ...f,
      visible_to: f.visible_to.includes(id)
        ? f.visible_to.filter((x) => x !== id)
        : [...f.visible_to, id],
    }));
  };

  const addCondition = () => {
    const v = conditionDraft.trim();
    if (!v) return;
    setForm((f) => ({ ...f, clear_conditions: [...f.clear_conditions, v] }));
    setConditionDraft("");
  };

  const removeCondition = (i) => {
    setForm((f) => ({ ...f, clear_conditions: f.clear_conditions.filter((_, ix) => ix !== i) }));
  };

  const onSave = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      scenario_number: form.scenario_number === "" ? null : parseInt(form.scenario_number),
    };
    try {
      if (editingId) {
        await api.put(`/scenarios/${editingId}`, payload);
        toast.success("Scenario updated");
      } else {
        await api.post("/scenarios", payload);
        toast.success("Scenario broadcast to players");
      }
      setForm(empty);
      setEditingId(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Save failed");
    }
  };

  const onEdit = (s) => {
    setForm({
      title: s.title,
      description: s.description || "",
      scenario_type: s.scenario_type,
      visible_to: s.visible_to || [],
      reward: s.reward || "",
      reward_coins: s.reward_coins || 0,
      scenario_number: s.scenario_number ?? "",
      difficulty: s.difficulty || "",
      clear_conditions: s.clear_conditions || [],
      time_limit: s.time_limit || "",
      failure: s.failure || "",
      notes: s.notes || "",
    });
    setEditingId(s.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onDelete = async (id) => {
    if (!window.confirm("Delete this scenario?")) return;
    await api.delete(`/scenarios/${id}`);
    toast.success("Scenario retired");
    load();
  };

  const onComplete = async (s) => {
    if (!window.confirm(`Mark "${s.title}" as cleared? This will grant ${s.reward_coins || 0} coins to ${s.visible_to?.length ? s.visible_to.length + " selected player(s)" : "ALL players"}.`)) return;
    try {
      await api.post(`/scenarios/${s.id}/complete`);
      toast.success("Scenario cleared — rewards dispatched");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Complete failed");
    }
  };

  return (
    <div className="space-y-8 animate-boot">
      <div>
        <div className="inline-block px-3 py-1 rounded-full glass-panel text-[9px] tracking-[0.3em] uppercase text-sky-300 mb-3">
          [ SCENARIO BROADCAST ]
        </div>
        <h1 className="font-display font-black text-4xl text-sky-100 tracking-tight">Scenarios</h1>
      </div>

      {/* FORM */}
      <form onSubmit={onSave} className="glass-panel rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-sky-100">
            {editingId ? "Edit Scenario" : "Craft a New Scenario"}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={() => { setForm(empty); setEditingId(null); }}
              className="text-xs font-mono text-sky-400 hover:text-sky-100 uppercase tracking-widest"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">Type</label>
            <select
              data-testid="scenario-form-type"
              value={form.scenario_type}
              onChange={(e) => setForm({ ...form, scenario_type: e.target.value })}
              className="w-full px-3 py-2 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              {SCENARIO_TYPES.map((t) => (
                <option key={t} value={t}>{SCENARIO_TYPE_META[t].label}</option>
              ))}
            </select>
          </div>
          {form.scenario_type === "main" && (
            <div>
              <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">Main Scenario Number</label>
              <input
                type="number"
                min="1"
                data-testid="scenario-form-number"
                value={form.scenario_number}
                onChange={(e) => setForm({ ...form, scenario_number: e.target.value })}
                placeholder="e.g. 3"
                className="w-full px-3 py-2 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              />
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">Title / Name</label>
            <input
              required
              data-testid="scenario-form-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Kill the Serpent King"
              className="w-full px-3 py-2 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">Description (optional flavor text)</label>
          <textarea
            data-testid="scenario-form-description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">Difficulty</label>
            <input
              data-testid="scenario-form-difficulty"
              value={form.difficulty}
              onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
              placeholder="A-rank / 10 / Extreme"
              className="w-full px-3 py-2 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            />
          </div>
          <div>
            <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">Time Limit</label>
            <input
              data-testid="scenario-form-time-limit"
              value={form.time_limit}
              onChange={(e) => setForm({ ...form, time_limit: e.target.value })}
              placeholder="3 days / 12 hours"
              className="w-full px-3 py-2 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            />
          </div>
        </div>

        {/* Clear Conditions dynamic list */}
        <div>
          <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">
            Clear Condition(s) — add each on its own line
          </label>
          {form.clear_conditions.length > 0 && (
            <ol className="space-y-1.5 mb-2">
              {form.clear_conditions.map((c, i) => (
                <li key={i} className="flex items-start gap-2 font-mono text-sm text-sky-100 bg-sky-950/40 rounded-lg px-3 py-2" data-testid={`condition-${i}`}>
                  <span className="text-sky-400/70 mt-0.5">{i + 1}.</span>
                  <span className="flex-1">{c}</span>
                  <button
                    type="button"
                    onClick={() => removeCondition(i)}
                    className="text-red-300 hover:text-red-100"
                    aria-label={`Remove condition ${i + 1}`}
                    data-testid={`condition-remove-${i}`}
                  >
                    <XIcon size={14} />
                  </button>
                </li>
              ))}
            </ol>
          )}
          <div className="flex gap-2">
            <input
              value={conditionDraft}
              onChange={(e) => setConditionDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCondition(); } }}
              placeholder="Reach the boss room..."
              data-testid="scenario-form-condition-draft"
              className="flex-1 px-3 py-2 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            />
            <button
              type="button"
              onClick={addCondition}
              data-testid="scenario-form-condition-add"
              className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-100 font-mono text-[10px] uppercase tracking-widest transition-colors"
            >
              <Plus size={12} /> Add
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">Compensation / Reward Text</label>
            <input
              data-testid="scenario-form-reward"
              value={form.reward}
              onChange={(e) => setForm({ ...form, reward: e.target.value })}
              placeholder="A Star Piece + acclaim from Uriel"
              className="w-full px-3 py-2 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            />
          </div>
          <div>
            <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">Reward Coins (auto-grant on clear)</label>
            <input
              type="number"
              min="0"
              data-testid="scenario-form-reward-coins"
              value={form.reward_coins}
              onChange={(e) => setForm({ ...form, reward_coins: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">Failure Consequences</label>
          <textarea
            data-testid="scenario-form-failure"
            value={form.failure}
            onChange={(e) => setForm({ ...form, failure: e.target.value })}
            rows={2}
            placeholder="Party wipes; −2 to Vigor cap in next scenario..."
            className="w-full px-3 py-2 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          />
        </div>

        <div>
          <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">Additional Notes (optional, shown starred at bottom)</label>
          <textarea
            data-testid="scenario-form-notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            placeholder="* Uriel is watching closely..."
            className="w-full px-3 py-2 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          />
        </div>

        <div>
          <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">
            Visible To (leave empty for all players)
          </label>
          <div className="flex flex-wrap gap-2">
            {players.length === 0 && (
              <span className="text-xs font-mono text-sky-400/50">No players registered.</span>
            )}
            {players.map((p) => {
              const on = form.visible_to.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePlayer(p.id)}
                  data-testid={`scenario-visible-${p.id}`}
                  className={`px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-mono transition-colors ${
                    on
                      ? "bg-sky-500 text-sky-950 font-bold"
                      : "bg-sky-950/50 text-sky-300 hover:bg-sky-500/20 border border-sky-400/20"
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] font-mono text-sky-400/60 mt-2">
            {form.visible_to.length === 0
              ? "→ Broadcast to ALL players"
              : `→ Visible to ${form.visible_to.length} selected${form.scenario_type === "sub" ? " (Sub - Personal)" : ""}`}
          </p>
        </div>

        {/* Live preview of arrival headline */}
        <div className="glass-panel rounded-lg p-3 font-mono text-xs text-sky-200 flex items-center gap-2">
          <span className="text-sky-400/70 text-[9px] uppercase tracking-widest">Arrival Alert →</span>
          <span className="text-sky-100">
            [{scenarioArrivalHeadline(form.scenario_type, form.scenario_number)}]
          </span>
        </div>

        <button
          type="submit"
          data-testid="scenario-form-submit"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-sky-950 font-display font-bold uppercase text-xs tracking-widest rounded-lg transition-colors"
        >
          <Plus size={14} />
          {editingId ? "Update" : "Publish Scenario"}
        </button>
      </form>

      {/* LIST */}
      <div className="space-y-4">
        <div className="font-mono text-[10px] uppercase tracking-widest text-sky-400">
          [ Active Scenarios ({scenarios.length}) ]
        </div>
        {scenarios.length === 0 && (
          <div className="glass-panel rounded-2xl p-8 text-center font-mono text-sm text-sky-400/70">
            No scenarios published yet.
          </div>
        )}
        <div className="grid gap-4">
          {scenarios.map((s) => {
            const meta = SCENARIO_TYPE_META[s.scenario_type] || SCENARIO_TYPE_META.main;
            const scope = s.visible_to?.length ? `${s.visible_to.length} player(s)` : "ALL";
            const cleared = !!s.cleared_at;
            return (
              <ScenarioBlock
                key={s.id}
                scenario={s}
                meta={meta}
                cleared={cleared}
                dataTestId={`admin-scenario-${s.id}`}
                actions={
                  <div className="flex items-center gap-1">
                    {!cleared && (
                      <button
                        onClick={() => onComplete(s)}
                        className="px-3 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 font-mono text-[10px] uppercase tracking-widest transition-colors inline-flex items-center gap-1.5"
                        data-testid={`complete-scenario-${s.id}`}
                      >
                        <CheckCircle2 size={12} /> Mark Cleared
                      </button>
                    )}
                    <button onClick={() => onEdit(s)} className="p-2 text-sky-300 hover:text-sky-100 hover:bg-sky-500/10 rounded-lg transition-colors" data-testid={`edit-scenario-${s.id}`}>
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => onDelete(s.id)} className="p-2 text-red-400 hover:text-red-200 hover:bg-red-500/10 rounded-lg transition-colors" data-testid={`delete-scenario-${s.id}`}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                }
                extraHeaderChip={
                  <span className="text-[10px] font-mono text-sky-400/70 uppercase tracking-widest flex items-center gap-1">
                    {s.visible_to?.length ? <EyeOff size={10} /> : <Eye size={10} />} {scope}
                  </span>
                }
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Also used by /scenarios player page (imported below).
export function ScenarioBlock({ scenario, meta, cleared, actions, extraHeaderChip, dataTestId }) {
  const category = scenarioCategoryLabel(scenario);
  const title = scenarioCardTitle(scenario);
  const conditions = scenario.clear_conditions || [];

  return (
    <div
      data-testid={dataTestId}
      className={`glass-panel rounded-2xl p-6 border-l-4 ${meta.accent} ${cleared ? "opacity-70" : ""}`}
    >
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`${meta.color} text-sky-950 font-display font-bold text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full`}>
            {meta.label}
          </span>
          {extraHeaderChip}
          {cleared && (
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-mono font-bold text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full">
              ✓ Cleared
            </span>
          )}
        </div>
        {actions}
      </div>

      <div className="font-mono text-sm text-sky-100">
        <div className="font-display font-black text-2xl md:text-3xl text-sky-50 tracking-tight leading-tight">
          &lt; {title} &gt;
        </div>

        <dl className="mt-4 space-y-2">
          <Row label="Category/Type" value={category} />
          {scenario.difficulty && <Row label="Difficulty" value={scenario.difficulty} />}
          <Row
            label={`Clear Condition${conditions.length === 1 ? "" : "(s)"}`}
            value={
              conditions.length === 0
                ? (scenario.description || <span className="text-sky-400/60">—</span>)
                : (
                  <ol className="space-y-1 mt-1">
                    {conditions.map((c, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-sky-400/70">{i + 1}.</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ol>
                )
            }
          />
          {scenario.time_limit && <Row label="Time Limit" value={scenario.time_limit} />}
          <Row
            label="Compensation/Reward"
            value={
              (scenario.reward || scenario.reward_coins > 0)
                ? <>{scenario.reward}{scenario.reward_coins > 0 ? ` (+${scenario.reward_coins} coins)` : ""}</>
                : <span className="text-sky-400/60">—</span>
            }
          />
          {scenario.failure && <Row label="Failure" value={scenario.failure} />}
        </dl>

        {scenario.notes && (
          <p className="mt-4 pt-3 border-t border-sky-400/10 text-yellow-200/90">
            * {scenario.notes}
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-x-3 gap-y-1">
      <dt className="font-mono text-[10px] uppercase tracking-widest text-sky-400/70 pt-0.5">{label}:</dt>
      <dd className="font-mono text-sm text-sky-100">{value}</dd>
    </div>
  );
}
