import { useState } from "react";
import Papa from "papaparse";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload } from "lucide-react";

type Row = Record<string, string>;

function CSVImporter({
  kind,
  fields,
  onImport,
}: {
  kind: string;
  fields: { key: string; label: string; required?: boolean }[];
  onImport: (rows: Row[], mapping: Record<string, string>) => Promise<{ created: number; updated: number; skipped: number; errors: string[] }>;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; errors: string[] } | null>(null);

  const guess = (label: string, hs: string[]) => {
    const l = label.toLowerCase();
    return hs.find((h) => h.toLowerCase().replace(/[_\s-]/g, "").includes(l.replace(/[_\s-]/g, ""))) ?? "";
  };

  const onFile = (f: File) => {
    Papa.parse<Row>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const hs = res.meta.fields ?? [];
        setHeaders(hs);
        setRows(res.data);
        const m: Record<string, string> = {};
        fields.forEach((fld) => { m[fld.key] = guess(fld.label, hs); });
        setMapping(m);
        setResult(null);
      },
    });
  };

  const run = async () => {
    for (const f of fields) if (f.required && !mapping[f.key]) { toast.error(`Map ${f.label}`); return; }
    setBusy(true);
    try {
      const r = await onImport(rows, mapping);
      setResult(r);
      toast.success(`${kind}: ${r.created} created, ${r.updated} updated`);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <label className="block">
        <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors">
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <div className="font-medium">{rows.length > 0 ? `${rows.length} rows loaded` : `Drop or click to upload ${kind} CSV`}</div>
          <div className="text-xs text-muted-foreground mt-1">Headers in the first row</div>
        </div>
        <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>

      {rows.length > 0 && (
        <>
          <Card className="p-4 space-y-3">
            <h3 className="font-medium">Map columns</h3>
            {fields.map((f) => (
              <div key={f.key} className="grid grid-cols-2 gap-3 items-center">
                <Label>{f.label}{f.required && <span className="text-destructive ml-1">*</span>}</Label>
                <Select value={mapping[f.key]} onValueChange={(v) => setMapping({ ...mapping, [f.key]: v === "__none__" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="(skip)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">(skip)</SelectItem>
                    {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </Card>

          <Card className="p-4">
            <h3 className="font-medium mb-2">Preview (first 10 rows)</h3>
            <div className="overflow-x-auto text-sm">
              <table className="w-full">
                <thead className="text-left text-muted-foreground">
                  <tr>{fields.map((f) => <th key={f.key} className="py-1 pr-3">{f.label}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((r, i) => (
                    <tr key={i} className="border-t">
                      {fields.map((f) => <td key={f.key} className="py-1 pr-3">{mapping[f.key] ? r[mapping[f.key]] : <span className="text-muted-foreground">—</span>}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Button onClick={run} disabled={busy} className="w-full">{busy ? "Importing…" : `Import ${rows.length} rows`}</Button>
        </>
      )}

      {result && (
        <Card className="p-4">
          <div className="flex gap-6 text-sm">
            <div><span className="text-muted-foreground">Created:</span> <span className="font-mono font-medium">{result.created}</span></div>
            <div><span className="text-muted-foreground">Updated:</span> <span className="font-mono font-medium">{result.updated}</span></div>
            <div><span className="text-muted-foreground">Skipped:</span> <span className="font-mono font-medium">{result.skipped}</span></div>
          </div>
          {result.errors.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-destructive">{result.errors.length} errors</summary>
              <ul className="mt-2 space-y-1 max-h-40 overflow-auto">
                {result.errors.slice(0, 50).map((e, i) => <li key={i} className="text-xs font-mono">{e}</li>)}
              </ul>
            </details>
          )}
        </Card>
      )}
    </div>
  );
}

export default function Import() {
  const importClients = async (rows: Row[], m: Record<string, string>) => {
    const { data: existing } = await supabase.from("clients").select("id, name");
    const existingByName = new Map((existing ?? []).map((c) => [c.name.toLowerCase(), c]));
    let created = 0, updated = 0, skipped = 0;
    const errors: string[] = [];
    for (const r of rows) {
      const name = (r[m.name] ?? "").trim();
      if (!name) { skipped++; continue; }
      if (existingByName.has(name.toLowerCase())) { skipped++; continue; }
      const { error } = await supabase.from("clients").insert({ name });
      if (error) errors.push(`${name}: ${error.message}`); else created++;
    }
    return { created, updated, skipped, errors };
  };

  const importProjects = async (rows: Row[], m: Record<string, string>) => {
    let { data: clients } = await supabase.from("clients").select("id, name");
    const clientByName = new Map((clients ?? []).map((c) => [c.name.toLowerCase(), c]));
    const { data: projects } = await supabase.from("projects").select("id, name, client_id");
    const projectKey = (clientId: string | null, name: string) => `${clientId ?? ""}::${name.toLowerCase()}`;
    const existingProj = new Map(projects?.map((p) => [projectKey(p.client_id, p.name), p]) ?? []);

    let created = 0, updated = 0, skipped = 0;
    const errors: string[] = [];
    for (const r of rows) {
      const name = (r[m.name] ?? "").trim();
      const clientName = m.client ? (r[m.client] ?? "").trim() : "";
      if (!name) { skipped++; continue; }
      let clientId: string | null = null;
      if (clientName) {
        let c = clientByName.get(clientName.toLowerCase());
        if (!c) {
          const { data: nc, error } = await supabase.from("clients").insert({ name: clientName }).select("id, name").single();
          if (error) { errors.push(`client ${clientName}: ${error.message}`); continue; }
          c = nc;
          clientByName.set(clientName.toLowerCase(), c);
        }
        clientId = c.id;
      }
      const budget = m.budget && r[m.budget] ? parseFloat(r[m.budget]) : null;
      const status = m.status ? (r[m.status] || "active").toLowerCase() : "active";
      const ex = existingProj.get(projectKey(clientId, name));
      if (ex) {
        const { error } = await supabase.from("projects").update({ status, hourly_budget: budget }).eq("id", ex.id);
        if (error) errors.push(`${name}: ${error.message}`); else updated++;
      } else {
        const { error } = await supabase.from("projects").insert({ name, client_id: clientId, status, hourly_budget: budget });
        if (error) errors.push(`${name}: ${error.message}`); else created++;
      }
    }
    return { created, updated, skipped, errors };
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-4xl">Import data</h1>
        <p className="text-muted-foreground mt-1">Bring clients and projects in from your old time tracker. Re-running an import updates existing records by name.</p>
      </div>
      <Tabs defaultValue="clients">
        <TabsList>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
        </TabsList>
        <TabsContent value="clients" className="mt-6">
          <CSVImporter
            kind="Clients"
            fields={[{ key: "name", label: "Client name", required: true }]}
            onImport={importClients}
          />
        </TabsContent>
        <TabsContent value="projects" className="mt-6">
          <CSVImporter
            kind="Projects"
            fields={[
              { key: "name", label: "Project name", required: true },
              { key: "client", label: "Client name" },
              { key: "status", label: "Status" },
              { key: "budget", label: "Hourly budget" },
            ]}
            onImport={importProjects}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
