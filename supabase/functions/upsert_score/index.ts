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

type Body = { studentId: string; studentName: string; score: number };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("APP_SUPABASE_URL")!;
    const serviceKey = Deno.env.get("APP_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = (await req.json()) as Body;
    const studentId = (body.studentId || "").trim();
    const studentName = (body.studentName || "").trim();
    const score = Number(body.score);

    if (!studentId || !studentName || !Number.isFinite(score)) return json({ error: "Bad body" }, 400);

    // 先抓現有 best
    const { data: row } = await supabase
      .from("leaderboard")
      .select("best_score")
      .eq("student_id", studentId)
      .maybeSingle();

    const prev = Number(row?.best_score ?? -1);
    const best = Math.max(prev, score);

    const { error } = await supabase.from("leaderboard").upsert(
      {
        student_id: studentId,
        student_name: studentName,
        best_score: best,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id" }
    );

    if (error) throw error;

    return json({ ok: true, best });
  } catch (err) {
    console.error("upsert_score error:", err);
    return json({ error: String(err) }, 500);
  }
});
