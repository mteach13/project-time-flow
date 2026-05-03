import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTimer } from "@/hooks/useTimer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { fmtHM, fmtHours } from "@/lib/dates";
import { format } from "date-fns";

export default function TimerPage() {
  const { user } = useAuth();
  const { active, start } = useTimer();
  const qc = useQueryClient();

  const projects = useQuery({
    queryKey: ["my-projects", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name, clients(name)").eq("status", "active").order("name");
      return data ?? [];
    },
  });

  const recent = useQuery({
    queryKey: ["recent-entries", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("time_entries").select("id, entry_date, minutes, note, project_id, projects(name, clients(name))").eq("user_id", user!.id).order("entry_date", { ascending: false }).order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  const [projectId, setProjectId] = useState("");
  const [note, setNote] = useState("");

  // Manual entry
  const [mProject, setMProject] = useState("");
  const [mDate, setMDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [mHours, setMHours] = useState("");
  const [mNote, setMNote] = useState("");

  const addManual = async () => {
    if (!mProject || !mHours) { toast.error("Project and hours are required"); return; }
    const minutes = Math.round(parseFloat(mHours) * 60);
    if (!minutes || minutes < 0) { toast.error("Invalid hours"); return; }
    const { error } = await supabase.from("time_entries").insert({
      user_id: user!.id, project_id: mProject, entry_date: mDate, minutes, note: mNote, source: "manual",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Entry added");
    setMHours(""); setMNote("");
    qc.invalidateQueries({ queryKey: ["recent-entries"] });
  };

  const del = async (id: string) => {
    await supabase.from("time_entries").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["recent-entries"] });
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-4xl">Timer</h1>
        <p className="text-muted-foreground mt-1">Start a live timer or log time manually.</p>
      </div>

      <Card className="p-6 space-y-4">
        <h2 className="text-xl">Start a live timer</h2>
        {active ? (
          <p className="text-sm text-muted-foreground">A timer is already running. Stop it from the header to start a new one.</p>
        ) : (
          <div className="grid md:grid-cols-[1fr_2fr_auto] gap-3 items-end">
            <div className="space-y-2">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Pick a project" /></SelectTrigger>
                <SelectContent>
                  {projects.data?.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.clients?.name ? `${p.clients.name} · ` : ""}{p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>What are you doing? (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
            </div>
            <Button onClick={async () => {
              if (!projectId) { toast.error("Pick a project"); return; }
              try { await start(projectId, note); setNote(""); toast.success("Timer started"); } catch (e: any) { toast.error(e.message); }
            }}>
              <Play className="h-4 w-4 mr-2" /> Start
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-xl">Log time manually</h2>
        <div className="grid md:grid-cols-[1fr_140px_120px_2fr_auto] gap-3 items-end">
          <div className="space-y-2">
            <Label>Project</Label>
            <Select value={mProject} onValueChange={setMProject}>
              <SelectTrigger><SelectValue placeholder="Pick a project" /></SelectTrigger>
              <SelectContent>
                {projects.data?.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.clients?.name ? `${p.clients.name} · ` : ""}{p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Date</Label><Input type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} /></div>
          <div className="space-y-2"><Label>Hours</Label><Input type="number" step="0.25" min="0" value={mHours} onChange={(e) => setMHours(e.target.value)} placeholder="1.5" /></div>
          <div className="space-y-2"><Label>Note</Label><Input value={mNote} onChange={(e) => setMNote(e.target.value)} maxLength={500} /></div>
          <Button onClick={addManual}>Add</Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl mb-4">Recent entries</h2>
        {recent.data?.length === 0 && <p className="text-muted-foreground text-sm">No entries yet.</p>}
        <div className="divide-y">
          {recent.data?.map((e: any) => (
            <div key={e.id} className="py-3 flex items-center gap-4">
              <div className="text-sm text-muted-foreground w-28">{format(new Date(e.entry_date), "EEE MMM d")}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{e.projects?.name}{e.projects?.clients?.name && <span className="text-muted-foreground"> · {e.projects.clients.name}</span>}</div>
                {e.note && <div className="text-sm text-muted-foreground truncate">{e.note}</div>}
              </div>
              <div className="font-mono text-sm">{fmtHM(e.minutes)}</div>
              <Button variant="ghost" size="icon" onClick={() => del(e.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
