import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Body = { email: string };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("APP_SUPABASE_URL")!;
    const serviceKey = Deno.env.get("APP_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = (await req.json()) as Body;
    const email = (body.email || "").trim().toLowerCase();
    if (!email) return json({ isTeacher: false });

    const { data, error } = await supabase
      .from("teacher_whitelist")
      .select("email")
      .eq("email", email)
      .maybeSingle();

    if (error) throw error;

    return json({ isTeacher: !!data });
  } catch (err) {
    console.error("is_teacher error:", err);
    return json({ error: String(err), isTeacher: false }, 500);
  }
});
