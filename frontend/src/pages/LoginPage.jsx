import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function LoginPage() {
  const { login, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const nav = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLocalError("");
    const res = await login(email, password);
    setLoading(false);
    if (res.ok) nav("/");
    else setLocalError(res.error);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-boot">
        <div className="text-center mb-8">
          <div className="inline-block px-4 py-1 rounded-full glass-panel text-[10px] tracking-[0.3em] uppercase text-sky-300 mb-4">
            [ System Access ]
          </div>
          <h1 className="font-display font-black text-4xl sm:text-5xl text-sky-100 tracking-tight">
            Dokkaebi Shop
          </h1>
          <p className="font-mono text-xs text-sky-400/70 mt-2 tracking-wider">
            AUTHENTICATE // CHANNEL 001
          </p>
        </div>

        <form onSubmit={onSubmit} className="glass-panel rounded-2xl p-8 space-y-5">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-sky-400 mb-2 font-mono">Email</label>
            <input
              data-testid="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 transition-colors"
              placeholder="dokkaebi@shop.io"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-sky-400 mb-2 font-mono">Password</label>
            <input
              data-testid="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {(localError || error) && (
            <div className="text-xs text-red-300 font-mono bg-red-950/40 border border-red-500/30 rounded-lg px-3 py-2">
              {localError || error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            data-testid="login-submit"
            className="w-full py-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-sky-950 font-display font-bold uppercase tracking-widest text-sm disabled:opacity-60 transition-colors"
          >
            {loading ? "Connecting..." : "Enter The Shop"}
          </button>

          <div className="text-center text-xs text-sky-400/70 font-mono pt-2">
            New constellation?{" "}
            <Link to="/register" data-testid="link-register" className="text-sky-300 hover:text-sky-100 underline">
              Register
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
