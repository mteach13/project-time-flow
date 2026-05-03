import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, subDays } from "date-fns";
import { weekStart } from "@/lib/dates";

type Row = { user: string; project: string; client: string; date: string; minutes: number; note: string };

function download(filename: string, content: string, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function toCSV(rows: { client: string; project: string; user: string; hours: string }[]) {
  const head = "Client,Project,Member,Hours\n";
  const body = rows.map((r) => [r.client, r.project, r.user, r.hours].map((v) => `"${(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  return head + body;
}

// Quickbooks Desktop IIF timer activity import
function toIIF(rows: Row[]) {
  const lines: string[] = [];
  lines.push(["!TIMERHDR", "VER", "REL", "COMPANYNAME", "IMPORTEDBEFORE", "FROMTIMER"].join("\t"));
  lines.push(["TIMERHDR", "8", "0", "Atelier Time Export", "N", "Y"].join("\t"));
  lines.push(["!TIMEACT", "DATE", "JOB", "EMP", "ITEM", "PITEM", "DURATION", "PROJ", "NOTE", "XFERTOPAYROLL", "BILLINGSTATUS"].join("\t"));
  for (const r of rows) {
    const hh = Math.floor(r.minutes / 60);
    const mm = r.minutes % 60;
    const duration = `${hh}:${mm.toString().padStart(2, "0")}`;
    const date = format(new Date(r.date), "MM/dd/yyyy");
    const job = r.client ? `${r.client}:${r.project}` : r.project;
    lines.push(["TIMEACT", date, job, r.user, "", "", duration, "", r.note.replace(/\t/g, " "), "N", "1"].join("\t"));
  }
  return lines.join("\r\n") + "\r\n";
}

export default function Export() {
  const today = format(new Date(), "yyyy-MM-dd");
  const lastWeek = format(weekStart(subDays(new Date(), 7)), "yyyy-MM-dd");
  const [from, setFrom] = useState(lastWeek);
  const [to, setTo] = useState(today);

  const entries = useQuery({
    queryKey: ["export", from, to],
    queryFn: async () => {
      const { data } = await supabase.from("time_entries")
        .select("entry_date, minutes, note, user_id, project_id, projects(name, clients(name)), profiles:profiles!time_entries_user_id_fkey(full_name)")
        .gte("entry_date", from).lte("entry_date", to).order("entry_date");
      return (data ?? []) as any[];
    },
  });

  const rows: Row[] = useMemo(() => (entries.data ?? []).map((e) => ({
    user: e.profiles?.full_name ?? "Unknown",
    project: e.projects?.name ?? "Unknown",
    client: e.projects?.clients?.name ?? "",
    date: e.entry_date,
    minutes: e.minutes,
    note: e.note ?? "",
  })), [entries.data]);

  const summary = useMemo(() => {
    const m = new Map<string, { client: string; project: string; user: string; minutes: number }>();
    for (const r of rows) {
      const k = `${r.client}|${r.project}|${r.user}`;
      const ex = m.get(k);
      if (ex) ex.minutes += r.minutes;
      else m.set(k, { client: r.client, project: r.project, user: r.user, minutes: r.minutes });
    }
    return Array.from(m.values()).sort((a, b) => a.client.localeCompare(b.client) || a.project.localeCompare(b.project));
  }, [rows]);

  const totalMin = rows.reduce((s, r) => s + r.minutes, 0);

  const dlCSV = () => {
    const csv = toCSV(summary.map((s) => ({ ...s, hours: (s.minutes / 60).toFixed(2) })));
    download(`time-${from}-to-${to}.csv`, csv, "text/csv");
  };
  const dlIIF = () => {
    download(`time-${from}-to-${to}.iif`, toIIF(rows), "text/plain");
  };

  // profiles relation name fallback — try without explicit name if needed
  // (Supabase will resolve via FK)

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-4xl">Export to QuickBooks</h1>
        <p className="text-muted-foreground mt-1">Pick a date range and download a CSV summary or a QuickBooks Desktop IIF file.</p>
      </div>

      <Card className="p-6 flex flex-wrap items-end gap-4">
        <div className="space-y-2"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-2"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={dlCSV} disabled={summary.length === 0}>Download CSV</Button>
          <Button onClick={dlIIF} disabled={rows.length === 0}>Download IIF</Button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex justify-between items-baseline mb-4">
          <h2 className="text-xl">Preview · per project per member</h2>
          <div className="text-sm text-muted-foreground">{rows.length} entries · <span className="font-mono">{(totalMin / 60).toFixed(2)}h</span> total</div>
        </div>
        {summary.length === 0 ? (
          <p className="text-muted-foreground text-sm">No time entries in this range.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="py-2">Client</th><th className="py-2">Project</th><th className="py-2">Member</th><th className="py-2 text-right">Hours</th></tr>
            </thead>
            <tbody>
              {summary.map((s, i) => (
                <tr key={i} className="border-t">
                  <td className="py-2">{s.client || <span className="text-muted-foreground">—</span>}</td>
                  <td className="py-2">{s.project}</td>
                  <td className="py-2">{s.user}</td>
                  <td className="py-2 text-right font-mono">{(s.minutes / 60).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-6 text-sm space-y-2">
        <h3 className="font-medium">QuickBooks Desktop IIF import</h3>
        <ol className="list-decimal list-inside text-muted-foreground space-y-1">
          <li>In QuickBooks Desktop: <em>File → Utilities → Import → Timer Activities</em>.</li>
          <li>Select the downloaded <code>.iif</code> file.</li>
          <li>Customers / employees / service items must already exist in QuickBooks with names that match Atelier Time.</li>
        </ol>
      </Card>
    </div>
  );
}
