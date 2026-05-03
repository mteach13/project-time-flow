import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { weekStart } from "@/lib/dates";
import { addWeeks, format } from "date-fns";
import { ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { toast } from "sonner";

export default function Planner() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [start, setStart] = useState<Date>(weekStart());
  const startISO = format(start, "yyyy-MM-dd");
  const lastWeekISO = format(addWeeks(start, -1), "yyyy-MM-dd");

  const profiles = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name").order("full_name")).data ?? [],
  });
  const projects = useQuery({
    queryKey: ["projects-active"],
    queryFn: async () => (await supabase.from("projects").select("id, name, clients(name)").eq("status", "active").order("name")).data ?? [],
  });
  const plans = useQuery({
    queryKey: ["plans", startISO],
    queryFn: async () => (await supabase.from("plan_entries").select("user_id, project_id, estimated_hours").eq("week_start_date", startISO)).data ?? [],
  });

  const grid = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    plans.data?.forEach((p) => {
      m[p.user_id] = m[p.user_id] || {};
      m[p.user_id][p.project_id] = Number(p.estimated_hours);
    });
    return m;
  }, [plans.data]);

  const visibleProfiles = isAdmin ? profiles.data : profiles.data?.filter((p) => p.id === user?.id);

  const save = async (uid: string, pid: string, val: string) => {
    const hours = val === "" ? 0 : parseFloat(val);
    if (Number.isNaN(hours) || hours < 0) { toast.error("Invalid"); return; }
    if (hours === 0) {
      await supabase.from("plan_entries").delete().eq("week_start_date", startISO).eq("user_id", uid).eq("project_id", pid);
    } else {
      await supabase.from("plan_entries").upsert({ week_start_date: startISO, user_id: uid, project_id: pid, estimated_hours: hours }, { onConflict: "week_start_date,user_id,project_id" });
    }
    qc.invalidateQueries({ queryKey: ["plans", startISO] });
  };

  const copyLast = async () => {
    const { data } = await supabase.from("plan_entries").select("user_id, project_id, estimated_hours").eq("week_start_date", lastWeekISO);
    if (!data || data.length === 0) { toast.error("No plan from last week"); return; }
    const rows = data.map((r) => ({ ...r, week_start_date: startISO }));
    await supabase.from("plan_entries").upsert(rows, { onConflict: "week_start_date,user_id,project_id" });
    toast.success("Copied last week's plan");
    qc.invalidateQueries({ queryKey: ["plans", startISO] });
  };

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl">Weekly planner</h1>
          <p className="text-muted-foreground mt-1">{isAdmin ? "Estimate hours per person per project. Used for the Monday meeting." : "Your hours planned this week. Admins edit this."}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && <Button variant="outline" onClick={copyLast}><Copy className="h-4 w-4 mr-2" />Copy last week</Button>}
          <Button variant="outline" size="icon" onClick={() => setStart(addWeeks(start, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="font-medium px-2">Week of {format(start, "MMM d")}</div>
          <Button variant="outline" size="icon" onClick={() => setStart(addWeeks(start, 1))}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="ghost" onClick={() => setStart(weekStart())}>This week</Button>
        </div>
      </div>

      <Card className="p-4 overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="px-3 py-2 sticky left-0 bg-card min-w-[180px]">Member</th>
              {projects.data?.map((p: any) => (
                <th key={p.id} className="px-2 py-2 text-center w-24">
                  <div className="font-medium text-foreground truncate max-w-[100px]">{p.name}</div>
                  {p.clients?.name && <div className="text-xs">{p.clients.name}</div>}
                </th>
              ))}
              <th className="px-3 py-2 text-right w-20">Total</th>
            </tr>
          </thead>
          <tbody>
            {visibleProfiles?.map((u) => {
              const row = grid[u.id] || {};
              const total = Object.values(row).reduce((s, v) => s + v, 0);
              const editable = isAdmin;
              return (
                <tr key={u.id} className="border-t">
                  <td className="px-3 py-2 sticky left-0 bg-card font-medium">{u.full_name}</td>
                  {projects.data?.map((p: any) => {
                    const v = row[p.id] || 0;
                    return (
                      <td key={p.id} className="px-1 py-1">
                        <Input
                          key={`${u.id}-${p.id}-${v}`}
                          defaultValue={v || ""}
                          type="number"
                          step="0.5"
                          min="0"
                          disabled={!editable}
                          className="h-9 text-center font-mono"
                          onBlur={(e) => {
                            const nv = e.target.value.trim();
                            if (nv === String(v || "")) return;
                            save(u.id, p.id, nv);
                          }}
                        />
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right font-mono">{total}</td>
                </tr>
              );
            })}
            {isAdmin && (
              <tr className="border-t font-medium">
                <td className="px-3 py-2 text-right sticky left-0 bg-card">Project total</td>
                {projects.data?.map((p: any) => {
                  const total = visibleProfiles?.reduce((s, u) => s + (grid[u.id]?.[p.id] || 0), 0) ?? 0;
                  return <td key={p.id} className="px-2 py-2 text-center font-mono">{total}</td>;
                })}
                <td className="px-3 py-2 text-right font-mono">
                  {visibleProfiles?.reduce((s, u) => s + Object.values(grid[u.id] || {}).reduce((ss, v) => ss + v, 0), 0) ?? 0}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
