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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("APP_SUPABASE_URL")!;
    const serviceKey = Deno.env.get("APP_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data, error } = await supabase
      .from("leaderboard")
      .select("student_name,best_score,updated_at")
      .order("best_score", { ascending: false })
      .order("updated_at", { ascending: true })
      .limit(20);

    if (error) throw error;
    return json({ rows: data ?? [] });
  } catch (err) {
    console.error("get_leaderboard error:", err);
    return json({ error: String(err) }, 500);
  }
});
