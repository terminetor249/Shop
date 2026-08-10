import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Coins, Send } from "lucide-react";

export default function AdminPlayersPage() {
  const [players, setPlayers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState(100);
  const [reason, setReason] = useState("");

  const load = async () => {
    const { data } = await api.get("/players");
    setPlayers(data);
  };
  useEffect(() => { load(); }, []);

  const onGrant = async (e) => {
    e.preventDefault();
    if (!selected) return toast.error("Select a player");
    if (!reason.trim()) return toast.error("Please provide a reason");
    try {
      await api.post("/grant-coins", {
        player_id: selected,
        amount: parseInt(amount),
        reason: reason.trim(),
      });
      toast.success(`${amount > 0 ? "Granted" : "Deducted"} ${Math.abs(amount)} coins`);
      setAmount(100);
      setReason("");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Grant failed");
    }
  };

  return (
    <div className="space-y-8 animate-boot">
      <div>
        <div className="inline-block px-3 py-1 rounded-full glass-panel text-[9px] tracking-[0.3em] uppercase text-sky-300 mb-3">
          [ INCARNATION LEDGER ]
        </div>
        <h1 className="font-display font-black text-4xl text-sky-100 tracking-tight">Players &amp; Coins</h1>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Players list */}
        <div className="glass-panel rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-sky-400/20 font-mono text-[10px] uppercase tracking-widest text-sky-400">
            [ Registered Players ({players.length}) ]
          </div>
          <div className="divide-y divide-sky-400/10 max-h-[500px] overflow-y-auto">
            {players.length === 0 && (
              <div className="p-8 text-center font-mono text-sm text-sky-400/70">
                No players registered yet.
              </div>
            )}
            {players.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                data-testid={`player-row-${p.id}`}
                className={`w-full text-left p-4 flex items-center gap-4 transition-colors ${
                  selected === p.id ? "bg-sky-500/15" : "hover:bg-sky-500/5"
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-display font-black text-sky-950 ${
                  selected === p.id ? "bg-sky-300" : "bg-sky-500"
                }`}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-sky-100 truncate">{p.name}</div>
                  <div className="text-[10px] font-mono text-sky-400/70">{p.email}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Coins size={14} className="text-yellow-300" />
                  <span className="font-mono font-bold text-sky-100">{p.coins}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Grant form */}
        <form onSubmit={onGrant} className="glass-panel rounded-2xl p-6 space-y-5 h-fit">
          <h2 className="font-display text-lg text-sky-100">Grant / Deduct Coins</h2>

          <div>
            <div className="text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">Selected</div>
            <div className="px-3 py-2 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-sm" data-testid="grant-selected">
              {players.find((p) => p.id === selected)?.name || "— pick a player —"}
            </div>
          </div>

          <div>
            <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">Amount (negative to deduct)</label>
            <input
              type="number"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="grant-amount"
              className="w-full px-3 py-2 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            />
          </div>

          <div>
            <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">Reason</label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              data-testid="grant-reason"
              placeholder="Cleared main scenario #4..."
              className="w-full px-3 py-2 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            />
          </div>

          <button
            type="submit"
            disabled={!selected}
            data-testid="grant-submit"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-sky-500 hover:bg-sky-400 text-sky-950 font-display font-bold uppercase text-xs tracking-widest rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={14} />
            Transmit Coins
          </button>
        </form>
      </div>
    </div>
  );
}
