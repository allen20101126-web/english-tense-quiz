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

type Body = {
  studentId: string;
  studentName: string;
  total?: number;
  timeLimitSec?: number;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("APP_SUPABASE_URL")!;
    const serviceKey = Deno.env.get("APP_SERVICE_ROLE_KEY")!;
    if (!supabaseUrl?.startsWith("http")) throw new Error("APP_SUPABASE_URL malformed");
    if (!serviceKey) throw new Error("APP_SERVICE_ROLE_KEY missing");

    const supabase = createClient(supabaseUrl, serviceKey);

    const body = (await req.json()) as Body;
    const studentId = (body.studentId || "").trim();
    const studentName = (body.studentName || "").trim();
    const total = Math.max(1, Math.min(50, Number(body.total ?? 20)));
    const timeLimitSec = Math.max(3, Math.min(60, Number(body.timeLimitSec ?? 15)));

    if (!studentId || !studentName) return json({ error: "Missing studentId/studentName" }, 400);

    // 抽題（random）
    const { data: qs, error: qErr } = await supabase
      .from("questions")
      .select("id,sentence,choices,correct_index")
      .order("id", { ascending: false });

    if (qErr) throw qErr;
    if (!qs || qs.length === 0) return json({ error: "No questions in DB" }, 500);

    // 洗牌取前 total
    const pool = [...qs];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const picked = pool.slice(0, Math.min(total, pool.length));

    // 建立 session
    const { data: sessionRow, error: sErr } = await supabase
      .from("quiz_sessions")
      .insert({
        student_id: studentId,
        student_name: studentName,
        total: picked.length,
        time_limit_sec: timeLimitSec,
        score: 0,
        current_qno: 1,
      })
      .select("session_id,total,time_limit_sec")
      .single();

    if (sErr) throw sErr;

    const questions = picked.map((q) => ({
      id: q.id,
      sentence: q.sentence,
      choices: q.choices, // jsonb array
    }));

    return json({
      sessionId: sessionRow.session_id,
      total: sessionRow.total,
      timeLimitSec: sessionRow.time_limit_sec,
      questions,
    });
  } catch (err) {
    console.error("start_quiz error:", err);
    return json({ error: String(err) }, 500);
  }
});
