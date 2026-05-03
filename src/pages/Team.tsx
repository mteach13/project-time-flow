import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export default function Team() {
  const qc = useQueryClient();
  const { user } = useAuth();
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

  const setAdmin = async (uid: string, makeAdmin: boolean) => {
    if (makeAdmin) {
      const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
      if (error && !error.message.includes("duplicate")) { toast.error(error.message); return; }
    } else {
      if (uid === user?.id && !confirm("Remove your own admin access?")) return;
      await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "admin");
    }
    qc.invalidateQueries({ queryKey: ["team-profiles"] });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-4xl">Team</h1>
        <p className="text-muted-foreground mt-1">Anyone who signs up appears here. Promote teammates to admin to give them planning and export access.</p>
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
