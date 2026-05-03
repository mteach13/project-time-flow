import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { weekStartISO, fmtHours } from "@/lib/dates";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Timer } from "lucide-react";

export default function Dashboard() {
  const { user, isAdmin, fullName } = useAuth();
  const week = weekStartISO();

  const myStats = useQuery({
    queryKey: ["dash-my", user?.id, week],
    enabled: !!user,
    queryFn: async () => {
      const [actuals, plans] = await Promise.all([
        supabase.from("time_entries").select("project_id, minutes, projects(name, clients(name))").eq("user_id", user!.id).gte("entry_date", week),
        supabase.from("plan_entries").select("project_id, estimated_hours, projects(name, clients(name))").eq("user_id", user!.id).eq("week_start_date", week),
      ]);
      const map: Record<string, { name: string; client: string; planned: number; actualMin: number }> = {};
      plans.data?.forEach((p: any) => {
        map[p.project_id] = { name: p.projects?.name ?? "—", client: p.projects?.clients?.name ?? "", planned: Number(p.estimated_hours), actualMin: 0 };
      });
      actuals.data?.forEach((e: any) => {
        const k = e.project_id;
        if (!map[k]) map[k] = { name: e.projects?.name ?? "—", client: e.projects?.clients?.name ?? "", planned: 0, actualMin: 0 };
        map[k].actualMin += e.minutes;
      });
      return Object.values(map);
    },
  });

  const adminStats = useQuery({
    queryKey: ["dash-admin", week],
    enabled: isAdmin,
    queryFn: async () => {
      const [actuals, plans, profiles] = await Promise.all([
        supabase.from("time_entries").select("user_id, minutes").gte("entry_date", week),
        supabase.from("plan_entries").select("user_id, estimated_hours").eq("week_start_date", week),
        supabase.from("profiles").select("id, full_name"),
      ]);
      const map: Record<string, { name: string; planned: number; actualMin: number }> = {};
      profiles.data?.forEach((p) => { map[p.id] = { name: p.full_name || "—", planned: 0, actualMin: 0 }; });
      plans.data?.forEach((p: any) => { if (map[p.user_id]) map[p.user_id].planned += Number(p.estimated_hours); });
      actuals.data?.forEach((e: any) => { if (map[e.user_id]) map[e.user_id].actualMin += e.minutes; });
      return Object.values(map).filter((r) => r.planned > 0 || r.actualMin > 0);
    },
  });

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl">Hi {fullName.split(" ")[0] || "there"}.</h1>
          <p className="text-muted-foreground mt-1">Week of {new Date(week).toLocaleDateString(undefined, { month: "long", day: "numeric" })}</p>
        </div>
        <Button asChild><Link to="/timer"><Timer className="h-4 w-4 mr-2" />Start a timer</Link></Button>
      </div>

      <Card className="p-6">
        <h2 className="text-xl mb-4">My week — planned vs. actual</h2>
        {myStats.data && myStats.data.length === 0 && <p className="text-muted-foreground text-sm">No planned or tracked time yet this week.</p>}
        <div className="space-y-3">
          {myStats.data?.map((r, i) => {
            const actualH = r.actualMin / 60;
            const pct = r.planned > 0 ? Math.min(150, (actualH / r.planned) * 100) : 0;
            const over = r.planned > 0 && actualH > r.planned;
            return (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span><span className="font-medium">{r.name}</span> {r.client && <span className="text-muted-foreground">· {r.client}</span>}</span>
                  <span className="font-mono">{fmtHours(r.actualMin)}h <span className="text-muted-foreground">/ {r.planned}h</span></span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className={`h-full ${over ? "bg-warning" : "bg-primary"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {isAdmin && (
        <Card className="p-6">
          <h2 className="text-xl mb-4">Team — this week</h2>
          {adminStats.data && adminStats.data.length === 0 && <p className="text-muted-foreground text-sm">No activity yet.</p>}
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="pb-2">Member</th><th className="pb-2 text-right">Planned</th><th className="pb-2 text-right">Actual</th><th className="pb-2 text-right">Δ</th></tr>
            </thead>
            <tbody>
              {adminStats.data?.map((r, i) => {
                const actualH = r.actualMin / 60;
                const delta = actualH - r.planned;
                return (
                  <tr key={i} className="border-t">
                    <td className="py-2">{r.name}</td>
                    <td className="py-2 text-right font-mono">{r.planned}h</td>
                    <td className="py-2 text-right font-mono">{actualH.toFixed(1)}h</td>
                    <td className={`py-2 text-right font-mono ${delta > 0 ? "text-warning" : delta < 0 ? "text-muted-foreground" : ""}`}>
                      {delta > 0 ? "+" : ""}{delta.toFixed(1)}h
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
