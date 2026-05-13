import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, subDays } from "date-fns";
import { weekStart } from "@/lib/dates";

type Row = {
  user: string;
  email: string;
  project: string;
  client: string;
  date: string;
  minutes: number;
  note: string;
};

function download(filename: string, content: string, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(v: string | number) {
  const s = String(v ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

// Zoho Books Timesheet import format: one row per time entry
function toZohoCSV(rows: Row[]) {
  const headers = ["Project Name", "User Email", "Log Date", "Log Hours", "Notes", "Billable Status"];
  const head = headers.join(",") + "\n";
  const body = rows
    .map((r) =>
      [
        r.project,
        r.email,
        r.date,
        (r.minutes / 60).toFixed(2),
        r.note,
        "Billable",
      ]
        .map(csvEscape)
        .join(",")
    )
    .join("\n");
  return head + body + "\n";
}

export default function Export() {
  const today = format(new Date(), "yyyy-MM-dd");
  const lastWeek = format(weekStart(subDays(new Date(), 7)), "yyyy-MM-dd");
  const [from, setFrom] = useState(lastWeek);
  const [to, setTo] = useState(today);

  const entries = useQuery({
    queryKey: ["export", from, to],
    queryFn: async () => {
      const [{ data: es }, { data: ps }] = await Promise.all([
        supabase
          .from("time_entries")
          .select("entry_date, minutes, note, user_id, project_id, projects(name, clients(name))")
          .gte("entry_date", from)
          .lte("entry_date", to)
          .order("entry_date"),
        supabase.from("profiles").select("id, full_name, email"),
      ]);
      const profById = new Map((ps ?? []).map((p) => [p.id, p]));
      return (es ?? []).map((e: any) => ({
        ...e,
        _user: profById.get(e.user_id)?.full_name ?? "Unknown",
        _email: profById.get(e.user_id)?.email ?? "",
      }));
    },
  });

  const rows: Row[] = useMemo(
    () =>
      (entries.data ?? []).map((e: any) => ({
        user: e._user,
        email: e._email,
        project: e.projects?.name ?? "Unknown",
        client: e.projects?.clients?.name ?? "",
        date: e.entry_date,
        minutes: e.minutes,
        note: e.note ?? "",
      })),
    [entries.data]
  );

  const totalMin = rows.reduce((s, r) => s + r.minutes, 0);

  const dlCSV = () => {
    download(`zoho-timesheet-${from}-to-${to}.csv`, toZohoCSV(rows), "text/csv");
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-4xl">Export to Zoho Books</h1>
        <p className="text-muted-foreground mt-1">
          Pick a date range and download a CSV formatted for Zoho Books Timesheet import.
        </p>
      </div>

      <Card className="p-6 flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="ml-auto">
          <Button onClick={dlCSV} disabled={rows.length === 0}>
            Download CSV
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex justify-between items-baseline mb-4">
          <h2 className="text-xl">Preview · time entries</h2>
          <div className="text-sm text-muted-foreground">
            {rows.length} entries · <span className="font-mono">{(totalMin / 60).toFixed(2)}h</span> total
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No time entries in this range.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2">Date</th>
                <th className="py-2">Project</th>
                <th className="py-2">Member</th>
                <th className="py-2">Note</th>
                <th className="py-2 text-right">Hours</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="py-2 font-mono text-xs">{r.date}</td>
                  <td className="py-2">{r.project}</td>
                  <td className="py-2">{r.user}</td>
                  <td className="py-2 text-muted-foreground truncate max-w-xs">{r.note || <span>—</span>}</td>
                  <td className="py-2 text-right font-mono">{(r.minutes / 60).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-6 text-sm space-y-2">
        <h3 className="font-medium">Zoho Books Timesheet import</h3>
        <ol className="list-decimal list-inside text-muted-foreground space-y-1">
          <li>In Zoho Books: <em>Time Tracking → Timesheets → ⋯ menu → Import Time Entries</em>.</li>
          <li>Upload the downloaded <code>.csv</code> file and map the columns (headers already match Zoho's defaults).</li>
          <li>Projects and users must already exist in Zoho Books with names / emails that match SPARK Time.</li>
        </ol>
      </Card>
    </div>
  );
}
