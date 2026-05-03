import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { weekStart, weekDays, weekStartISO } from "@/lib/dates";
import { addWeeks, format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export default function Timesheet() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [start, setStart] = useState<Date>(weekStart());
  const startISO = format(start, "yyyy-MM-dd");
  const days = weekDays(start);
  const endISO = format(days[6], "yyyy-MM-dd");

  const projects = useQuery({
    queryKey: ["projects-active"],
    queryFn: async () => (await supabase.from("projects").select("id, name, clients(name)").eq("status", "active").order("name")).data ?? [],
  });

  const entries = useQuery({
    queryKey: ["timesheet", user?.id, startISO],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("time_entries").select("id, project_id, entry_date, minutes").eq("user_id", user!.id).gte("entry_date", startISO).lte("entry_date", endISO);
      return data ?? [];
    },
  });

  const grid = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    entries.data?.forEach((e: any) => {
      m[e.project_id] = m[e.project_id] || {};
      m[e.project_id][e.entry_date] = (m[e.project_id][e.entry_date] || 0) + e.minutes;
    });
    return m;
  }, [entries.data]);

  const save = async (projectId: string, dateISO: string, hoursStr: string) => {
    const minutes = hoursStr === "" ? 0 : Math.round(parseFloat(hoursStr) * 60);
    if (Number.isNaN(minutes) || minutes < 0) { toast.error("Invalid hours"); return; }
    // Delete existing entries for that day+project (manual aggregation)
    await supabase.from("time_entries").delete().eq("user_id", user!.id).eq("project_id", projectId).eq("entry_date", dateISO);
    if (minutes > 0) {
      await supabase.from("time_entries").insert({ user_id: user!.id, project_id: projectId, entry_date: dateISO, minutes, source: "manual" });
    }
    qc.invalidateQueries({ queryKey: ["timesheet"] });
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl">Timesheet</h1>
          <p className="text-muted-foreground mt-1">Type hours per project per day. Replaces any timed entries for that cell.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setStart(addWeeks(start, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="font-medium px-2">Week of {format(start, "MMM d")}</div>
          <Button variant="outline" size="icon" onClick={() => setStart(addWeeks(start, 1))}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="ghost" onClick={() => setStart(weekStart())}>This week</Button>
        </div>
      </div>

      <Card className="p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="px-2 py-2 min-w-[200px]">Project</th>
              {days.map((d) => (
                <th key={d.toISOString()} className="px-2 py-2 text-center w-24">
                  <div>{format(d, "EEE")}</div>
                  <div className="text-xs">{format(d, "MMM d")}</div>
                </th>
              ))}
              <th className="px-2 py-2 text-right w-20">Total</th>
            </tr>
          </thead>
          <tbody>
            {projects.data?.map((p: any) => {
              const total = days.reduce((s, d) => s + (grid[p.id]?.[format(d, "yyyy-MM-dd")] || 0), 0);
              return (
                <tr key={p.id} className="border-t">
                  <td className="px-2 py-2">
                    <div className="font-medium">{p.name}</div>
                    {p.clients?.name && <div className="text-xs text-muted-foreground">{p.clients.name}</div>}
                  </td>
                  {days.map((d) => {
                    const iso = format(d, "yyyy-MM-dd");
                    const min = grid[p.id]?.[iso] || 0;
                    const hours = min ? (min / 60).toFixed(2) : "";
                    return (
                      <td key={iso} className="px-1 py-1">
                        <Input
                          defaultValue={hours}
                          key={`${p.id}-${iso}-${min}`}
                          type="number"
                          step="0.25"
                          min="0"
                          className="h-9 text-center font-mono"
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v === hours) return;
                            save(p.id, iso, v);
                          }}
                        />
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-right font-mono">{(total / 60).toFixed(2)}</td>
                </tr>
              );
            })}
            <tr className="border-t font-medium">
              <td className="px-2 py-2 text-right">Daily total</td>
              {days.map((d) => {
                const iso = format(d, "yyyy-MM-dd");
                const total = projects.data?.reduce((s: number, p: any) => s + (grid[p.id]?.[iso] || 0), 0) ?? 0;
                return <td key={iso} className="px-2 py-2 text-center font-mono">{(total / 60).toFixed(2)}</td>;
              })}
              <td className="px-2 py-2 text-right font-mono">
                {(projects.data?.reduce((s: number, p: any) => s + days.reduce((ss, d) => ss + (grid[p.id]?.[format(d, "yyyy-MM-dd")] || 0), 0), 0) ?? 0) / 60 | 0}
              </td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}
