import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { UserPlus, Copy } from "lucide-react";

export default function Team() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [makeAdmin, setMakeAdmin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  const profiles = useQuery({
    queryKey: ["team-profiles"],
    queryFn: async () => {
      const { data: ps } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      const { data: rs } = await supabase.from("user_roles").select("user_id, role");
      const byId = new Map((ps ?? []).map((p) => [p.id, { ...p, roles: [] as string[] }]));
      rs?.forEach((r) => { byId.get(r.user_id)?.roles.push(r.role); });
      return Array.from(byId.values());
    },
  });

  const setAdmin = async (uid: string, makeAdminRole: boolean) => {
    if (makeAdminRole) {
      const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
      if (error && !error.message.includes("duplicate")) { toast.error(error.message); return; }
    } else {
      if (uid === user?.id && !confirm("Remove your own admin access?")) return;
      await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "admin");
    }
    qc.invalidateQueries({ queryKey: ["team-profiles"] });
  };

  const invite = async () => {
    if (!email) { toast.error("Email is required"); return; }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("invite-member", {
      body: { email, full_name: fullName, make_admin: makeAdmin },
    });
    setSubmitting(false);
    if (error || data?.error) {
      toast.error(error?.message || data?.error || "Failed to add member");
      return;
    }
    setCredentials({ email: data.email, password: data.temp_password });
    setEmail(""); setFullName(""); setMakeAdmin(false);
    qc.invalidateQueries({ queryKey: ["team-profiles"] });
  };

  const copyCreds = () => {
    if (!credentials) return;
    navigator.clipboard.writeText(`Email: ${credentials.email}\nTemporary password: ${credentials.password}`);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl">Team</h1>
          <p className="text-muted-foreground mt-1">Add team members directly or let them sign up. Promote teammates to admin to give them planning and export access.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setCredentials(null); }}>
          <DialogTrigger asChild>
            <Button><UserPlus className="w-4 h-4 mr-2" />Add member</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add a team member</DialogTitle></DialogHeader>
            {credentials ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Account created. Share these credentials with your teammate — they should change the password after signing in.</p>
                <Card className="p-4 space-y-2 text-sm font-mono">
                  <div><span className="text-muted-foreground">Email:</span> {credentials.email}</div>
                  <div><span className="text-muted-foreground">Password:</span> {credentials.password}</div>
                </Card>
                <DialogFooter>
                  <Button variant="outline" onClick={copyCreds}><Copy className="w-4 h-4 mr-2" />Copy</Button>
                  <Button onClick={() => { setCredentials(null); setOpen(false); }}>Done</Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@agency.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Full name (optional)</Label>
                  <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={makeAdmin} onCheckedChange={(v) => setMakeAdmin(!!v)} />
                  Grant admin access
                </label>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={invite} disabled={submitting}>{submitting ? "Adding..." : "Add member"}</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-6">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr><th className="py-2">Name</th><th className="py-2">Email</th><th className="py-2">Role</th><th></th></tr>
          </thead>
          <tbody>
            {profiles.data?.map((p) => {
              const isAdmin = p.roles.includes("admin");
              return (
                <tr key={p.id} className="border-t">
                  <td className="py-2 font-medium">{p.full_name}</td>
                  <td className="py-2 text-muted-foreground">{p.email}</td>
                  <td className="py-2">{isAdmin ? <span className="text-xs uppercase bg-primary/10 text-primary px-2 py-1 rounded">Admin</span> : <span className="text-xs uppercase bg-secondary px-2 py-1 rounded">Member</span>}</td>
                  <td className="py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => setAdmin(p.id, !isAdmin)}>
                      {isAdmin ? "Revoke admin" : "Make admin"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
