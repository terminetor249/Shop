import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Coins, Send, Sparkles, Users, Star, ChevronRight } from "lucide-react";

export default function AdminPlayersPage() {
  const [players, setPlayers] = useState([]);
  const [mode, setMode] = useState("named"); // "named" | "many" | "system"
  const [constellationName, setConstellationName] = useState("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState(0);
  const [recipients, setRecipients] = useState([]); // empty = all
  const [sending, setSending] = useState(false);

  const load = async () => {
    const { data } = await api.get("/players");
    setPlayers(data);
  };
  useEffect(() => { load(); }, []);

  const togglePlayer = (id) => {
    setRecipients((r) => r.includes(id) ? r.filter((x) => x !== id) : [...r, id]);
  };

  const onSend = async (e) => {
    e.preventDefault();
    if (!reason.trim()) return toast.error("Message / reason is required");
    if (mode === "named" && !constellationName.trim()) {
      return toast.error("Enter a constellation name, or switch mode to 'Many' or 'System'");
    }
    setSending(true);
    try {
      const { data } = await api.post("/constellation/send", {
        constellation_name: mode === "named" ? constellationName.trim() : "",
        many_constellations: mode === "many",
        system_message: mode === "system",
        reason: reason.trim(),
        amount: parseInt(amount) || 0,
        player_ids: recipients,
      });
      const label = mode === "system"
        ? "System"
        : mode === "many"
          ? "Many constellations"
          : `The constellation ${constellationName}`;
      toast.success(`${label} — transmitted to ${data.delivered_to} player(s)`);
      setReason("");
      setAmount(0);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Broadcast failed");
    }
    setSending(false);
  };

  const recipientLabel = recipients.length === 0
    ? "ALL PLAYERS"
    : `${recipients.length} selected`;

  const previewLabel = mode === "system"
    ? "System"
    : mode === "many"
      ? "Many constellations"
      : `The constellation ${constellationName || "..."}`;

  return (
    <div className="space-y-8 animate-boot">
      <div>
        <div className="inline-block px-3 py-1 rounded-full glass-panel text-[9px] tracking-[0.3em] uppercase text-sky-300 mb-3">
          [ CONSTELLATION CHANNEL // OUTGOING ]
        </div>
        <h1 className="font-display font-black text-4xl text-sky-100 tracking-tight">Constellation Broadcast</h1>
        <p className="font-mono text-xs text-sky-400/70 mt-2">
          &gt; Send messages or sponsorship coins from any constellation to your incarnations.
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Broadcast form */}
        <form onSubmit={onSend} className="glass-panel rounded-2xl p-6 space-y-5 lg:col-span-3 h-fit">
          <h2 className="font-display text-lg text-sky-100 flex items-center gap-2">
            <Sparkles size={18} className="text-sky-300" /> Compose Transmission
          </h2>

          <div>
            <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">Broadcast Mode</label>
            <div className="inline-flex rounded-lg overflow-hidden ring-1 ring-sky-400/20 font-mono text-[10px] uppercase tracking-widest" role="group">
              {[
                { key: "named", label: "Named" },
                { key: "many", label: "Many" },
                { key: "system", label: "System" },
              ].map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMode(m.key)}
                  data-testid={`broadcast-mode-${m.key}`}
                  aria-pressed={mode === m.key}
                  className={`px-4 py-2 transition-colors ${
                    mode === m.key
                      ? "bg-sky-500 text-sky-950 font-bold"
                      : "bg-sky-950/50 text-sky-300 hover:bg-sky-500/20"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] font-mono text-sky-400/60 mt-2">
              {mode === "named" && "→ From a specific constellation you name."}
              {mode === "many" && "→ Anonymous chorus of constellations."}
              {mode === "system" && "→ Impersonal system announcement — great for kill logs, world events."}
            </p>
          </div>

          <div>
            <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">
              Constellation Name {mode !== "named" && `(disabled — using ${mode})`}
            </label>
            <input
              type="text"
              placeholder="Uriel, Secretive Plotter, Demon-like Judge of Fire..."
              value={constellationName}
              disabled={mode !== "named"}
              onChange={(e) => setConstellationName(e.target.value)}
              data-testid="broadcast-name"
              className="w-full px-3 py-2 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">Message / Reason</label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              data-testid="broadcast-reason"
              placeholder={mode === "system"
                ? "The player has slain a Level-3 Wraith..."
                : "is pleased with your courage against the Serpent King..."}
              className="w-full px-3 py-2 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            />
            <p className="text-[10px] font-mono text-sky-400/60 mt-1">
              &gt; Preview: [{mode === "system"
                ? (reason || "...")
                : `${previewLabel} ${reason || "..."}`}]
            </p>
          </div>

          <div>
            <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">
              Sponsorship Coins (0 = message only, negative to deduct)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="broadcast-amount"
              className="w-full px-3 py-2 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[9px] uppercase tracking-widest text-sky-400 font-mono">Recipients</label>
              <span className="text-[9px] font-mono uppercase tracking-widest text-sky-300">
                → {recipientLabel}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setRecipients([])}
                className={`px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-mono transition-colors inline-flex items-center gap-1 ${
                  recipients.length === 0
                    ? "bg-sky-500 text-sky-950 font-bold"
                    : "bg-sky-950/50 text-sky-300 hover:bg-sky-500/20 border border-sky-400/20"
                }`}
                data-testid="broadcast-all"
              >
                <Users size={10} /> All
              </button>
              {players.map((p) => {
                const on = recipients.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlayer(p.id)}
                    data-testid={`broadcast-player-${p.id}`}
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
          </div>

          <button
            type="submit"
            disabled={sending}
            data-testid="broadcast-submit"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-sky-500 hover:bg-sky-400 text-sky-950 font-display font-bold uppercase text-xs tracking-widest rounded-lg transition-colors disabled:opacity-50"
          >
            <Send size={14} />
            {sending ? "Transmitting..." : "Send Transmission"}
          </button>
        </form>

        {/* Players list */}
        <div className="glass-panel rounded-2xl overflow-hidden lg:col-span-2 h-fit">
          <div className="p-4 border-b border-sky-400/20 font-mono text-[10px] uppercase tracking-widest text-sky-400 flex items-center gap-2">
            <Star size={12} /> Incarnations ({players.length})
          </div>
          <div className="divide-y divide-sky-400/10 max-h-[500px] overflow-y-auto">
            {players.length === 0 && (
              <div className="p-8 text-center font-mono text-sm text-sky-400/70">
                No players registered yet.
              </div>
            )}
            {players.map((p) => (
              <div
                key={p.id}
                data-testid={`player-row-${p.id}`}
                className="p-4 flex items-center gap-3 hover:bg-sky-500/5"
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-display font-black text-sky-950 bg-sky-500 text-sm">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-sky-100 truncate text-sm">{p.name}</div>
                  <div className="text-[10px] font-mono text-sky-400/70 truncate">{p.email}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Coins size={12} className="text-yellow-300" />
                  <span className="font-mono font-bold text-sky-100 text-sm">{p.coins}</span>
                </div>
                <Link
                  to={`/admin/players/${p.id}`}
                  data-testid={`player-detail-link-${p.id}`}
                  className="ml-1 p-2 rounded-lg text-sky-300 hover:text-sky-100 hover:bg-sky-500/20 transition-colors"
                  title="View stats and inventory"
                >
                  <ChevronRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
