import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Coins, LogOut, ShoppingBag, ScrollText, ClipboardList, Backpack, Wrench, User, Users } from "lucide-react";

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const isAdmin = user?.role === "admin";

  const playerLinks = [
    { to: "/", label: "Shop", icon: ShoppingBag, testid: "nav-shop" },
    { to: "/inventory", label: "Inventory", icon: Backpack, testid: "nav-inventory" },
    { to: "/stats", label: "Stats", icon: User, testid: "nav-stats" },
    { to: "/scenarios", label: "Scenarios", icon: ScrollText, testid: "nav-scenarios" },
    { to: "/log", label: "Log", icon: ClipboardList, testid: "nav-log" },
  ];
  const adminLinks = [
    { to: "/", label: "Shop", icon: ShoppingBag, testid: "nav-shop" },
    { to: "/admin/items", label: "Items", icon: Wrench, testid: "nav-admin-items" },
    { to: "/admin/party", label: "Party", icon: Users, testid: "nav-admin-party" },
    { to: "/admin/players", label: "Broadcast", icon: Coins, testid: "nav-admin-players" },
    { to: "/admin/scenarios", label: "Scenarios", icon: ScrollText, testid: "nav-admin-scenarios" },
    { to: "/log", label: "Log", icon: ClipboardList, testid: "nav-log" },
  ];
  const links = isAdmin ? adminLinks : playerLinks;

  const onLogout = async () => {
    await logout();
    nav("/login");
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#050A15]/85 border-b border-sky-400/20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center font-display font-black text-sky-950 text-lg shadow-lg shadow-sky-500/30">
              도
            </div>
            <div className="hidden sm:block">
              <div className="font-display font-black text-sky-100 tracking-tight leading-none">Dokkaebi Shop</div>
              <div className="text-[9px] uppercase tracking-[0.3em] text-sky-400/70 font-mono mt-0.5">
                {isAdmin ? "DM // Narrator" : `Ch. ${user?.name}`}
              </div>
            </div>
          </div>

          <nav className="flex-1 flex items-center gap-1 overflow-x-auto">
            {links.map((l) => {
              const Icon = l.icon;
              return (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === "/"}
                  data-testid={l.testid}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-lg text-xs font-mono uppercase tracking-widest flex items-center gap-2 transition-colors whitespace-nowrap ${
                      isActive
                        ? "bg-sky-500/20 text-sky-100 border border-sky-400/40"
                        : "text-sky-400/70 hover:text-sky-100 hover:bg-sky-500/10 border border-transparent"
                    }`
                  }
                >
                  <Icon size={14} />
                  <span className="hidden md:inline">{l.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {!isAdmin && (
            <div className="glass-panel px-4 py-2 rounded-lg flex items-center gap-2" data-testid="header-coin-balance">
              <Coins size={16} className="text-yellow-300" />
              <span className="font-mono font-bold text-sky-100 coin-pulse">{user?.coins ?? 0}</span>
              <span className="text-[9px] uppercase tracking-widest text-sky-400/60 hidden sm:inline">coins</span>
            </div>
          )}

          <button
            onClick={onLogout}
            data-testid="logout-btn"
            className="p-2 rounded-lg text-sky-300 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 relative z-10">{children}</main>

      <footer className="max-w-7xl mx-auto px-6 py-8 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-sky-500/40">
          [ The Story Continues ]
        </p>
      </footer>
    </div>
  );
}
