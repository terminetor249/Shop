import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Coins, Send, Users, ArrowRight } from "lucide-react";

export default function SendCoinsPage() {
  const { user, refresh } = useAuth();
  const [players, setPlayers] = useState([]);
  const [recipientId, setRecipientId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/players");
        setPlayers(data.filter((p) => p.id !== user?.id));
      } catch { /* noop */ }
    })();
  }, [user?.id]);

  const onSend = async (e) => {
    e.preventDefault();
    const amt = parseInt(amount);
    if (!recipientId) return toast.error("Pick a recipient");
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Amount must be positive");
    if (amt > (user?.coins ?? 0)) return toast.error("Not enough coins");
    setSending(true);
    try {
      const { data } = await api.post("/coins/transfer", {
        recipient_id: recipientId,
        amount: amt,
        reason: reason.trim(),
      });
      toast.success(`Sent ${data.sent} coins to ${data.recipient}`);
      setAmount("");
      setReason("");
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Transfer failed");
    }
    setSending(false);
  };

  const recipient = players.find((p) => p.id === recipientId);

  return (
    <div className="space-y-8 animate-boot">
      <div>
        <div className="inline-block px-3 py-1 rounded-full glass-panel text-[9px] tracking-[0.3em] uppercase text-sky-300 mb-3">
          [ COIN TRANSFER // INCARNATION LEDGER ]
        </div>
        <h1 className="font-display font-black text-4xl sm:text-5xl text-sky-100 tracking-tight">
          Send Coins
        </h1>
        <p className="font-mono text-xs text-sky-400/70 mt-2">
          &gt; Transfer coins directly to another incarnation.
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <form onSubmit={onSend} className="glass-panel rounded-2xl p-6 space-y-5 lg:col-span-3 h-fit">
          <div className="flex items-center justify-between gap-4 pb-3 border-b border-sky-400/10">
            <div className="flex items-center gap-2 text-sky-100">
              <Coins size={16} className="text-yellow-300" />
              <span className="font-mono font-bold" data-testid="send-balance">{user?.coins ?? 0}</span>
              <span className="text-[10px] uppercase tracking-widest text-sky-400/60">available</span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-sky-400/70">
              Sender: <span className="text-sky-100">{user?.name}</span>
            </span>
          </div>

          <div>
            <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">Recipient</label>
            {players.length === 0 ? (
              <div className="text-xs font-mono text-sky-400/60">No other players to send to yet.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {players.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setRecipientId(p.id)}
                    data-testid={`send-recipient-${p.id}`}
                    className={`px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-mono transition-colors inline-flex items-center gap-1.5 ${
                      recipientId === p.id
                        ? "bg-sky-500 text-sky-950 font-bold"
                        : "bg-sky-950/50 text-sky-300 hover:bg-sky-500/20 border border-sky-400/20"
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-sky-400/40 flex items-center justify-center text-[9px] text-sky-950 font-bold">
                      {p.name.charAt(0).toUpperCase()}
                    </span>
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">
              Amount (coins)
            </label>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="100"
              data-testid="send-amount"
              className="w-full px-3 py-2 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            />
          </div>

          <div>
            <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">
              Reason (optional)
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Thanks for the healing potion in the last scenario..."
              data-testid="send-reason"
              className="w-full px-3 py-2 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            />
          </div>

          {recipient && amount && (
            <div className="glass-panel rounded-lg p-3 font-mono text-xs text-sky-200 flex items-center justify-center gap-3">
              <span className="text-sky-100">{user?.name}</span>
              <ArrowRight size={12} className="text-sky-400" />
              <span className="text-yellow-300 font-bold">{amount} coins</span>
              <ArrowRight size={12} className="text-sky-400" />
              <span className="text-sky-100">{recipient.name}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={sending || !recipientId || !amount}
            data-testid="send-submit"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-sky-500 hover:bg-sky-400 text-sky-950 font-display font-bold uppercase text-xs tracking-widest rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={14} />
            {sending ? "Transmitting..." : "Send Coins"}
          </button>
        </form>

        <div className="glass-panel rounded-2xl p-6 lg:col-span-2 h-fit">
          <div className="font-mono text-[10px] uppercase tracking-widest text-sky-400 mb-3 flex items-center gap-2">
            <Users size={12} /> Other Incarnations
          </div>
          <p className="font-mono text-[10px] text-sky-400/60 mb-3">
            &gt; Balances are private — only the Dokkaebi sees them.
          </p>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {players.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-sky-950/40"
                data-testid={`send-party-${p.id}`}
              >
                <div className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center font-display font-black text-sky-950 text-sm">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-sky-100 text-sm truncate">{p.name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
