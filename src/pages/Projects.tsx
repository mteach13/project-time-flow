import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

export default function Projects() {
  const qc = useQueryClient();
  const clients = useQuery({ queryKey: ["clients"], queryFn: async () => (await supabase.from("clients").select("id, name, contact_name, contact_email, contact_phone, address, notes").order("name")).data ?? [] });
  const projects = useQuery({
    queryKey: ["projects-all"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name, status, hourly_budget, client_id, clients(name)");
      return (data ?? []).slice().sort((a: any, b: any) => {
        const ca = (a.clients?.name ?? "\uffff").toLowerCase();
        const cb = (b.clients?.name ?? "\uffff").toLowerCase();
        if (ca !== cb) return ca.localeCompare(cb);
        return (a.name ?? "").toLowerCase().localeCompare((b.name ?? "").toLowerCase());
      });
    },
  });
  const profiles = useQuery({ queryKey: ["profiles-all"], queryFn: async () => (await supabase.from("profiles").select("id, full_name").order("full_name")).data ?? [] });

  // Client form
  const [clientName, setClientName] = useState("");
  const addClient = async () => {
    const name = clientName.trim();
    if (!name) return;
    const { error } = await supabase.from("clients").insert({ name });
    if (error) toast.error(error.message);
    else { setClientName(""); qc.invalidateQueries({ queryKey: ["clients"] }); toast.success("Client added"); }
  };
  const delClient = async (id: string) => { if (!confirm("Delete client? Projects keep their data but lose the client link.")) return; await supabase.from("clients").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["clients"] }); qc.invalidateQueries({ queryKey: ["projects-all"] }); };

  // Project form
  const [pOpen, setPOpen] = useState(false);
  const [pId, setPId] = useState<string | null>(null);
  const [pName, setPName] = useState("");
  const [pClient, setPClient] = useState<string>("");
  const [pBudget, setPBudget] = useState("");
  const [pStatus, setPStatus] = useState("active");
  const [pMembers, setPMembers] = useState<Set<string>>(new Set());

  const openNew = () => { setPId(null); setPName(""); setPClient(""); setPBudget(""); setPStatus("active"); setPMembers(new Set()); setPOpen(true); };
  const openEdit = async (p: any) => {
    setPId(p.id); setPName(p.name); setPClient(p.client_id ?? ""); setPBudget(p.hourly_budget ?? ""); setPStatus(p.status);
    const { data } = await supabase.from("project_members").select("user_id").eq("project_id", p.id);
    setPMembers(new Set(data?.map((m) => m.user_id) ?? []));
    setPOpen(true);
  };
  const saveProject = async () => {
    if (!pName.trim()) { toast.error("Name required"); return; }
    const payload = { name: pName.trim(), client_id: pClient || null, status: pStatus, hourly_budget: pBudget ? parseFloat(pBudget) : null };
    let projectId = pId;
    if (pId) {
      const { error } = await supabase.from("projects").update(payload).eq("id", pId);
      if (error) { toast.error(error.message); return; }
    } else {
      const { data, error } = await supabase.from("projects").insert(payload).select("id").single();
      if (error) { toast.error(error.message); return; }
      projectId = data.id;
    }
    if (projectId) {
      await supabase.from("project_members").delete().eq("project_id", projectId);
      if (pMembers.size > 0) {
        await supabase.from("project_members").insert(Array.from(pMembers).map((uid) => ({ project_id: projectId!, user_id: uid })));
      }
    }
    setPOpen(false);
    qc.invalidateQueries({ queryKey: ["projects-all"] });
    toast.success("Saved");
  };
  const delProject = async (id: string) => { if (!confirm("Delete project and all its time entries?")) return; await supabase.from("projects").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["projects-all"] }); };

  return (
    <div className="space-y-8 max-w-5xl">
      <h1 className="text-4xl">Clients & projects</h1>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl">Clients</h2>
        </div>
        <div className="flex gap-2">
          <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="New client name" maxLength={120} />
          <Button onClick={addClient}><Plus className="h-4 w-4 mr-1" />Add</Button>
        </div>
        <div className="divide-y">
          {clients.data?.map((c) => (
            <div key={c.id} className="py-2 flex items-center justify-between">
              <span>{c.name}</span>
              <Button variant="ghost" size="icon" onClick={() => delClient(c.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl">Projects</h2>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />New project</Button>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr><th className="py-2">Client</th><th className="py-2">Name</th><th className="py-2">Status</th><th className="py-2 text-right">Budget</th><th></th></tr>
          </thead>
          <tbody>
            {projects.data?.map((p: any) => (
              <tr key={p.id} className="border-t">
                <td className="py-2">{p.clients?.name ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="py-2 font-medium">{p.name}</td>
                <td className="py-2"><span className="text-xs uppercase tracking-wide bg-secondary px-2 py-1 rounded">{p.status}</span></td>
                <td className="py-2 text-right font-mono">{p.hourly_budget ? `${p.hourly_budget}h` : "—"}</td>
                <td className="py-2 text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => delProject(p.id)}><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={pOpen} onOpenChange={setPOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{pId ? "Edit project" : "New project"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input value={pName} onChange={(e) => setPName(e.target.value)} maxLength={200} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={pClient} onValueChange={setPClient}>
                  <SelectTrigger><SelectValue placeholder="(none)" /></SelectTrigger>
                  <SelectContent>
                    {clients.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={pStatus} onValueChange={setPStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Hourly budget (optional)</Label><Input type="number" step="1" min="0" value={pBudget} onChange={(e) => setPBudget(e.target.value)} /></div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Team members</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const all = profiles.data ?? [];
                    if (pMembers.size === all.length) setPMembers(new Set());
                    else setPMembers(new Set(all.map((u) => u.id)));
                  }}
                >
                  {profiles.data && pMembers.size === profiles.data.length ? "Deselect all" : "Select all"}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-auto border rounded-md p-3">
                {profiles.data?.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={pMembers.has(u.id)} onCheckedChange={(c) => {
                      const ns = new Set(pMembers);
                      if (c) ns.add(u.id); else ns.delete(u.id);
                      setPMembers(ns);
                    }} />
                    {u.full_name}
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={saveProject} className="w-full">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
