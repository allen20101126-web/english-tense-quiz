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

    const { count: sessionCount } = await supabase
      .from("quiz_sessions")
      .select("*", { count: "exact", head: true });

    const { count: answerCount } = await supabase
      .from("quiz_answers")
      .select("*", { count: "exact", head: true });

    const { data: top } = await supabase
      .from("leaderboard")
      .select("student_name,best_score,updated_at")
      .order("best_score", { ascending: false })
      .limit(10);

    return json({
      sessions: sessionCount ?? 0,
      answers: answerCount ?? 0,
      top10: top ?? [],
    });
  } catch (err) {
    console.error("teacher_report error:", err);
    return json({ error: String(err) }, 500);
  }
});
