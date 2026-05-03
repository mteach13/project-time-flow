import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Clock, LayoutDashboard, Timer, CalendarDays, FolderKanban, Users, Upload, Download, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RunningTimerBadge } from "@/components/RunningTimerBadge";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof Clock; end?: boolean };
const navAll: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/timer", label: "Timer", icon: Timer },
  { to: "/timesheet", label: "Timesheet", icon: CalendarDays },
  { to: "/planner", label: "Planner", icon: CalendarDays },
];
const navAdmin: NavItem[] = [
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/team", label: "Team", icon: Users },
  { to: "/import", label: "Import", icon: Upload },
  { to: "/export", label: "Export", icon: Download },
];

export default function Layout() {
  const { isAdmin, fullName, signOut } = useAuth();
  const nav = useNavigate();
  const items = isAdmin ? [...navAll, ...navAdmin] : navAll;

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="p-5 flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-gradient-warm flex items-center justify-center">
            <Clock className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-serif text-lg leading-none">Atelier</div>
            <div className="text-xs opacity-60">Time</div>
          </div>
        </div>
        <nav className="flex-1 px-2 py-2 space-y-0.5">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )
              }
            >
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="px-2 py-1 text-sm">{fullName}</div>
          <div className="px-2 pb-2 text-xs opacity-60">{isAdmin ? "Admin" : "Member"}</div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent" onClick={async () => { await signOut(); nav("/auth"); }}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b bg-card flex items-center justify-end px-6">
          <RunningTimerBadge />
        </header>
        <div className="flex-1 p-8 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
