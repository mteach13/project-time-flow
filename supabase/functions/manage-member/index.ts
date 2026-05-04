import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const admin = createClient(url, service);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { action, user_id, email, full_name } = body ?? {};

    if (!action || !user_id) {
      return new Response(JSON.stringify({ error: "action and user_id required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (action === "update") {
      // Basic validation
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return new Response(JSON.stringify({ error: "Invalid email" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      if (full_name && full_name.length > 200) {
        return new Response(JSON.stringify({ error: "Name too long" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }

      const updates: Record<string, unknown> = {};
      if (email) updates.email = email;
      if (full_name !== undefined) updates.user_metadata = { full_name };

      if (Object.keys(updates).length > 0) {
        const { error: authErr } = await admin.auth.admin.updateUserById(user_id, updates);
        if (authErr) {
          return new Response(JSON.stringify({ error: authErr.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
        }
      }

      // Sync profiles row
      const profileUpdate: Record<string, unknown> = {};
      if (email) profileUpdate.email = email;
      if (full_name !== undefined) profileUpdate.full_name = full_name;
      if (Object.keys(profileUpdate).length > 0) {
        await admin.from("profiles").update(profileUpdate).eq("id", user_id);
      }

      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      if (user_id === userData.user.id) {
        return new Response(JSON.stringify({ error: "You cannot delete your own account" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      const { error: delErr } = await admin.auth.admin.deleteUser(user_id);
      if (delErr) {
        return new Response(JSON.stringify({ error: delErr.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      // Profile/roles will cascade via FK or be cleaned up; explicitly remove just in case.
      await admin.from("user_roles").delete().eq("user_id", user_id);
      await admin.from("profiles").delete().eq("id", user_id);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
