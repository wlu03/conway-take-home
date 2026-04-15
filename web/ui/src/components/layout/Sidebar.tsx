import { NavLink, Link } from "react-router-dom";
import {
  LayoutDashboard,
  ListFilter,
  ShieldAlert,
  Network,
  HardDrive,
} from "lucide-react";
import { Logo } from "@/components/svg/Logo";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";
import { useRunId } from "@/hooks/useRunId";

interface NavEntry {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV: NavEntry[] = [
  { to: ROUTES.dashboard, label: "Dashboard", icon: LayoutDashboard },
  { to: ROUTES.transactions, label: "Transactions", icon: ListFilter },
  { to: ROUTES.alerts, label: "Alerts", icon: ShieldAlert },
  { to: ROUTES.graph, label: "Graph", icon: Network },
  { to: ROUTES.runs, label: "Runs", icon: HardDrive },
];

export function Sidebar() {
  const { runId } = useRunId();

  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-card/40">
      <div className="flex h-16 items-center border-b border-border px-5">
        <Link to={ROUTES.landing} className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={runId ? `${to}?run=${runId}` : to}
                end={to === ROUTES.dashboard}
                className={({ isActive }) =>
                  cn(
                    "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all",
                    isActive
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary transition-all",
                        isActive ? "opacity-100" : "opacity-0"
                      )}
                      aria-hidden
                    />
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-border p-4">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[hsl(142_70%_45%)]" />
          API localhost:8000
        </div>
      </div>
    </aside>
  );
}
