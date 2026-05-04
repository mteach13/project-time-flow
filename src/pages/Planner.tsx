import { useMemo, useState, Fragment } from "react";
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
    queryFn: async () =>
      (await supabase
        .from("projects")
        .select("id, name, client_id, clients(name)")
        .eq("status", "active")
        .order("name")).data ?? [],
  });
  const plans = useQuery({
    queryKey: ["plans", startISO],
    queryFn: async () =>
      (await supabase
        .from("plan_entries")
        .select("user_id, project_id, estimated_hours")
        .eq("week_start_date", startISO)).data ?? [],
  });

  // grid[projectId][userId] = hours
  const grid = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    plans.data?.forEach((p) => {
      m[p.project_id] = m[p.project_id] || {};
      m[p.project_id][p.user_id] = Number(p.estimated_hours);
    });
    return m;
  }, [plans.data]);

  const visibleProfiles = isAdmin ? profiles.data : profiles.data?.filter((p) => p.id === user?.id);

  // Group projects by client
  const grouped = useMemo(() => {
    const groups: { clientId: string | null; clientName: string; projects: any[] }[] = [];
    const map = new Map<string, { clientId: string | null; clientName: string; projects: any[] }>();
    projects.data?.forEach((p: any) => {
      const key = p.client_id ?? "__none__";
      const name = p.clients?.name ?? "No client";
      if (!map.has(key)) {
        const g = { clientId: p.client_id, clientName: name, projects: [] as any[] };
        map.set(key, g);
        groups.push(g);
      }
      map.get(key)!.projects.push(p);
    });
    groups.sort((a, b) => a.clientName.localeCompare(b.clientName));
    return groups;
  }, [projects.data]);

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

  const memberTotal = (uid: string) =>
    Object.values(grid).reduce((s, row) => s + (row[uid] || 0), 0);
  const projectTotal = (pid: string) =>
    visibleProfiles?.reduce((s, u) => s + (grid[pid]?.[u.id] || 0), 0) ?? 0;
  const clientTotal = (clientProjects: any[]) =>
    clientProjects.reduce((s, p) => s + projectTotal(p.id), 0);

  return (
    <div className="space-y-6 max-w-[1400px]">
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
        <table className="text-sm border-separate border-spacing-0 w-full">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="px-3 py-2 sticky left-0 bg-card min-w-[240px] border-b">Client / Project</th>
              {visibleProfiles?.map((u) => (
                <th key={u.id} className="px-2 py-2 text-center w-28 border-b">
                  <div className="font-medium text-foreground truncate max-w-[110px] mx-auto">{u.full_name}</div>
                </th>
              ))}
              <th className="px-3 py-2 text-right w-20 border-b">Total</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((g) => (
              <Fragment key={g.clientId ?? "none"}>
                <tr className="bg-muted/40">
                  <td
                    className="px-3 py-2 sticky left-0 bg-muted/40 font-semibold uppercase tracking-wide text-xs text-muted-foreground border-l-4 border-primary"
                    colSpan={1}
                  >
                    {g.clientName}
                    <span className="ml-2 normal-case font-normal text-muted-foreground/70">
                      ({g.projects.length} {g.projects.length === 1 ? "project" : "projects"})
                    </span>
                  </td>
                  {visibleProfiles?.map((u) => (
                    <td key={u.id} className="bg-muted/40" />
                  ))}
                  <td className="px-3 py-2 text-right font-mono font-semibold bg-muted/40">
                    {clientTotal(g.projects)}
                  </td>
                </tr>
                {g.projects.map((p: any) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-2 sticky left-0 bg-card border-l-4 border-primary/30 pl-6 font-medium">
                      {p.name}
                    </td>
                    {visibleProfiles?.map((u) => {
                      const v = grid[p.id]?.[u.id] || 0;
                      return (
                        <td key={u.id} className="px-1 py-1">
                          <Input
                            key={`${p.id}-${u.id}-${v}`}
                            defaultValue={v || ""}
                            type="number"
                            step="0.5"
                            min="0"
                            disabled={!isAdmin}
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
                    <td className="px-3 py-2 text-right font-mono">{projectTotal(p.id)}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
            {isAdmin && (
              <tr className="border-t-2 font-medium bg-card">
                <td className="px-3 py-2 text-right sticky left-0 bg-card">Member total</td>
                {visibleProfiles?.map((u) => (
                  <td key={u.id} className="px-2 py-2 text-center font-mono">{memberTotal(u.id)}</td>
                ))}
                <td className="px-3 py-2 text-right font-mono">
                  {visibleProfiles?.reduce((s, u) => s + memberTotal(u.id), 0) ?? 0}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
