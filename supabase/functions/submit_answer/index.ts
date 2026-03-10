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

type Body = { sessionId: string; questionId: number; selectedIndex: number };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("APP_SUPABASE_URL")!;
    const serviceKey = Deno.env.get("APP_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = (await req.json()) as Body;
    const sessionId = (body.sessionId || "").trim();
    const questionId = Number(body.questionId);
    const selectedIndex = Number(body.selectedIndex);

    if (!sessionId || !Number.isFinite(questionId) || !Number.isFinite(selectedIndex)) {
      return json({ error: "Bad body" }, 400);
    }

    const { data: q, error: qErr } = await supabase
      .from("questions")
      .select("correct_index")
      .eq("id", questionId)
      .single();

    if (qErr) throw qErr;

    const correctIndex = Number(q.correct_index);
    const correct = selectedIndex === correctIndex;

    // 記錄答案
    const { error: aErr } = await supabase.from("quiz_answers").insert({
      session_id: sessionId,
      question_id: questionId,
      selected_index: selectedIndex,
      correct,
      correct_index: correctIndex,
    });
    if (aErr) throw aErr;

    // 更新 session 分數 & 題號
    const { data: sess, error: sErr } = await supabase
      .from("quiz_sessions")
      .select("score,current_qno,total")
      .eq("session_id", sessionId)
      .single();
    if (sErr) throw sErr;

    const newScore = sess.score + (correct ? 1 : 0);
    const newQno = Math.min(sess.total, sess.current_qno + 1);

    const { error: uErr } = await supabase
      .from("quiz_sessions")
      .update({ score: newScore, current_qno: newQno })
      .eq("session_id", sessionId);
    if (uErr) throw uErr;

    return json({ correct, correctIndex, score: newScore, currentQno: newQno, total: sess.total });
  } catch (err) {
    console.error("submit_answer error:", err);
    return json({ error: String(err) }, 500);
  }
});
