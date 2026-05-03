import { useEffect, useState } from "react";
import { useTimer } from "@/hooks/useTimer";
import { Button } from "@/components/ui/button";
import { Square } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fmtHM } from "@/lib/dates";
import { toast } from "sonner";

export function RunningTimerBadge() {
  const { active, stop } = useTimer();
  const [, force] = useState(0);

  useEffect(() => {
    if (!active) return;
    const i = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, [active]);

  const { data: project } = useQuery({
    queryKey: ["project", active?.project_id],
    queryFn: async () => {
      if (!active) return null;
      const { data } = await supabase.from("projects").select("name, clients(name)").eq("id", active.project_id).maybeSingle();
      return data;
    },
    enabled: !!active,
  });

  if (!active) return null;
  const minutes = Math.floor((Date.now() - new Date(active.started_at).getTime()) / 60000);
  const seconds = Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000) % 60;

  return (
    <div className="flex items-center gap-3 bg-primary/10 border border-primary/30 rounded-full pl-4 pr-1 py-1">
      <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
      <div className="text-sm">
        <span className="font-medium">{project?.name ?? "Project"}</span>
        <span className="text-muted-foreground"> · </span>
        <span className="font-mono">{fmtHM(minutes)} {seconds.toString().padStart(2, "0")}s</span>
      </div>
      <Button size="sm" variant="ghost" className="h-7 rounded-full" onClick={async () => {
        try { await stop(); toast.success("Timer stopped, entry saved"); } catch (e: any) { toast.error(e.message); }
      }}>
        <Square className="h-3 w-3 mr-1" /> Stop
      </Button>
    </div>
  );
}
