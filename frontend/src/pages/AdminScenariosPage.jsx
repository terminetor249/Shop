import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Edit3, Eye, EyeOff } from "lucide-react";

const empty = {
  title: "",
  description: "",
  scenario_type: "main",
  visible_to: [],
  reward: "",
};

const TYPE_META = {
  main: { color: "bg-red-500", label: "Main Scenario", accent: "border-red-400/60" },
  sub: { color: "bg-cyan-500", label: "Sub Scenario", accent: "border-cyan-400/60" },
  bounty: { color: "bg-yellow-500", label: "Bounty", accent: "border-yellow-400/60" },
};

export default function AdminScenariosPage() {
  const [scenarios, setScenarios] = useState([]);
  const [players, setPlayers] = useState([]);
  const [form, setForm] = useState(empty);
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

  const onSave = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/scenarios/${editingId}`, form);
        toast.success("Scenario updated");
      } else {
        await api.post("/scenarios", form);
        toast.success("Scenario published");
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

  return (
    <div className="space-y-8 animate-boot">
      <div>
        <div className="inline-block px-3 py-1 rounded-full glass-panel text-[9px] tracking-[0.3em] uppercase text-sky-300 mb-3">
          [ SCENARIO BROADCAST ]
        </div>
        <h1 className="font-display font-black text-4xl text-sky-100 tracking-tight">Scenarios</h1>
      </div>

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
            <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">Title</label>
            <input
              required
              data-testid="scenario-form-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            />
          </div>
          <div>
            <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">Type</label>
            <select
              data-testid="scenario-form-type"
              value={form.scenario_type}
              onChange={(e) => setForm({ ...form, scenario_type: e.target.value })}
              className="w-full px-3 py-2 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <option value="main">Main Scenario</option>
              <option value="sub">Sub Scenario</option>
              <option value="bounty">Bounty</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">Description</label>
          <textarea
            data-testid="scenario-form-description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          />
        </div>

        <div>
          <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">Reward Description</label>
          <input
            data-testid="scenario-form-reward"
            value={form.reward}
            onChange={(e) => setForm({ ...form, reward: e.target.value })}
            placeholder="200 coins + Star Piece"
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
              : `→ Visible to ${form.visible_to.length} selected`}
          </p>
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

      {/* List */}
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
            const meta = TYPE_META[s.scenario_type];
            const scope = s.visible_to?.length ? `${s.visible_to.length} player(s)` : "ALL";
            return (
              <div
                key={s.id}
                data-testid={`admin-scenario-${s.id}`}
                className={`glass-panel rounded-2xl p-5 border-l-4 ${meta.accent}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`${meta.color} text-sky-950 font-display font-bold text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full`}>
                        {meta.label}
                      </span>
                      <span className="text-[10px] font-mono text-sky-400/70 uppercase tracking-widest flex items-center gap-1">
                        {s.visible_to?.length ? <EyeOff size={10} /> : <Eye size={10} />} {scope}
                      </span>
                    </div>
                    <h3 className="font-display font-bold text-xl text-sky-100">{s.title}</h3>
                    {s.description && <p className="text-sm text-sky-300/80 mt-1 font-mono">{s.description}</p>}
                    {s.reward && (
                      <div className="mt-2 text-xs font-mono text-yellow-300/90">
                        &gt; Reward: {s.reward}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => onEdit(s)} className="p-2 text-sky-300 hover:text-sky-100 hover:bg-sky-500/10 rounded-lg transition-colors" data-testid={`edit-scenario-${s.id}`}>
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => onDelete(s.id)} className="p-2 text-red-400 hover:text-red-200 hover:bg-red-500/10 rounded-lg transition-colors" data-testid={`delete-scenario-${s.id}`}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
