import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

export type ActiveTimer = {
  user_id: string;
  project_id: string;
  started_at: string;
  note: string;
};

type TimerCtx = {
  active: ActiveTimer | null;
  loading: boolean;
  start: (projectId: string, note?: string) => Promise<void>;
  stop: () => Promise<void>;
  reload: () => Promise<void>;
};

const Ctx = createContext<TimerCtx | undefined>(undefined);

export function TimerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [active, setActive] = useState<ActiveTimer | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!user) { setActive(null); return; }
    setLoading(true);
    const { data } = await supabase.from("active_timers").select("*").eq("user_id", user.id).maybeSingle();
    setActive(data as ActiveTimer | null);
    setLoading(false);
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  const start = async (projectId: string, note = "") => {
    if (!user) return;
    if (active) await stop();
    const { error } = await supabase.from("active_timers").upsert({
      user_id: user.id, project_id: projectId, started_at: new Date().toISOString(), note,
    });
    if (error) throw error;
    await reload();
  };

  const stop = async () => {
    if (!user || !active) return;
    const startedAt = new Date(active.started_at);
    const endedAt = new Date();
    const minutes = Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));
    const entryDate = format(startedAt, "yyyy-MM-dd");
    const { error: insErr } = await supabase.from("time_entries").insert({
      user_id: user.id,
      project_id: active.project_id,
      entry_date: entryDate,
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      minutes,
      note: active.note,
      source: "timer",
    });
    if (insErr) throw insErr;
    await supabase.from("active_timers").delete().eq("user_id", user.id);
    await reload();
  };

  return <Ctx.Provider value={{ active, loading, start, stop, reload }}>{children}</Ctx.Provider>;
}

export function useTimer() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTimer must be used within TimerProvider");
  return c;
}
