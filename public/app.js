import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://kcnkdjzorcmmbsczehik.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_0-jWBjVsawY9Ranq0Gja4g_958sl9k4"

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TOTAL = 20;
const SECONDS = 15;
const LEADER_LIMIT = 99999;

const state = {
  phase:"login",
  studentName:"",
  studentId:"",
  score:0,
  idx:0,
  questions:[],
  timeLeft:SECONDS,
  timerId:null,
  locked:false,

  startTime:0,
  endTime:0,

  overlayText:"",
  overlayDetail:"",
  overlayOk:false
};

boot();

async function boot() {
  mountMouseGlow();
  await ensureAnonAuth();
  render();
}

async function ensureAnonAuth() {
  const { data: s } = await supabase.auth.getSession();
  if (!s?.session) {
    await supabase.auth.signInAnonymously();
  }
  const { data: u } = await supabase.auth.getUser();
  state.studentId = u?.user?.id || crypto.randomUUID();
}

function mountMouseGlow() {
  let glow = document.querySelector(".mouse-glow");
  if (!glow) {
    glow = document.createElement("div");
    glow.className = "mouse-glow";
    document.body.appendChild(glow);
  }

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let currentX = mouseX;
  let currentY = mouseY;

  window.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  function animateGlow() {
    currentX += (mouseX - currentX) * 0.10;
    currentY += (mouseY - currentY) * 0.10;
    glow.style.left = currentX + "px";
    glow.style.top = currentY + "px";
    requestAnimationFrame(animateGlow);
  }

  animateGlow();
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === "value") {
      node.value = v;
    } else if (k === "style") {
      node.setAttribute("style", v);
    } else {
      node.setAttribute(k, v);
    }
  }
  for (const c of children) {
    if (c == null) continue;
    if (typeof c === "string") node.appendChild(document.createTextNode(c));
    else node.appendChild(c);
  }
  return node;
}

function render() {
  const root = document.getElementById("app");
  root.innerHTML = "";

  const page = el("div", { class: "page" });
  const card = el("div", { class: "card" });
  const inner = el("div", { class: "inner" });

  if (state.phase === "login") inner.appendChild(renderLogin());
  if (state.phase === "playing") inner.appendChild(renderGame());
  if (state.phase === "finished") inner.appendChild(renderFinish());

  card.appendChild(inner);
  page.appendChild(card);
  root.appendChild(page);
  root.appendChild(renderOverlay());

  if (state.toast) {
    root.appendChild(el("div", { class: "toast" }, [state.toast]));
  }
}

function renderLogin() {
  const wrap = document.createElement("div");

  wrap.appendChild(
    el("div", { class: "topbar" }, [
      el("div", { class: "title" }, ["⏱️ 時態練習 | 20 題"]),
      el("div", { class: "row" }, [
        el("button", { class: "btn btn-secondary", onClick: openLeaderboard }, ["看排行榜"]),
      ]),
    ])
  );

  wrap.appendChild(el("div", { class: "subtitle" }, ["學生輸入名字即可開始"]));

  const input = el("input", {
    class: "input",
    placeholder: "輸入名字",
    value: state.studentName,
  });

  input.addEventListener("input", (e) => {
    state.studentName = e.target.value;
  });

  wrap.appendChild(input);
  wrap.appendChild(
    el("button", { class: "btn btn-primary", onClick: startGame }, ["開始"])
  );

  if (state.leaderboard.length || state.leaderboardError) {
    wrap.appendChild(renderLeaderPreview());
  }

  return wrap;
}

function renderGame() {
  const q = state.questions[state.idx];
  const wrap = document.createElement("div");

  wrap.appendChild(
    el("div", { class: "hud" }, [
      el("div", { class: "hud-text" }, [
        `玩家 ${state.studentName}　第 ${state.idx + 1}/${TOTAL} 題　分數 ${state.score}`,
      ]),
      renderTimer(),
    ])
  );

  wrap.appendChild(el("div", { class: "progress-line" }));

  if (!q) {
    wrap.appendChild(el("div", { class: "subtitle" }, ["載入中…"]));
    return wrap;
  }

  wrap.appendChild(el("div", { class: "question" }, [q.sentence]));

  const grid = el("div", { class: "choices" });
  q.choices.forEach((c, i) => {
    grid.appendChild(
      el(
        "button",
        {
          class: "choice",
          onClick: () => onChoose(i),
        },
        [String(c)]
      )
    );
  });

  wrap.appendChild(grid);

  wrap.appendChild(
    el("div", { class: "bottom-bar row-right" }, [
      el("button", { class: "btn btn-secondary", onClick: restartGame }, ["重新開始"]),
    ])
  );

  return wrap;
}

function renderFinish() {
  const wrap = document.createElement("div");

  wrap.appendChild(
    el("div", { class: "topbar" }, [
      el("div", { class: "title" }, ["🎉 完成"]),
      el("div", { class: "row" }, [
        el("button", { class: "btn btn-secondary", onClick: openLeaderboard }, ["看排行榜"]),
      ]),
    ])
  );

  wrap.appendChild(
    el("div", { class: "finish-box" }, [
      el("div", { class: "leader-title" }, [`你的分數：${state.score} / ${TOTAL}`]),
      el("div", { class: "subtitle" }, ["排行榜只保留同一人的最高分"]),
      el("div", { class: "row" }, [
        el("button", { class: "btn btn-primary", onClick: restartGame }, ["再玩一次"]),
      ]),
    ])
  );

  if (state.leaderboard.length || state.leaderboardError) {
    wrap.appendChild(renderLeaderPreview());
  }

  return wrap;
}

function renderLeaderPreview() {
  const box = el("div", { class: "leader-preview" }, [
    el("div", { class: "leader-title" }, ["🏆 排行榜（同一位只取最高）"]),
  ]);

  const list = el("div", { class: "leader-list" });

  if (state.leaderboardError) {
    list.appendChild(el("div", { class: "subtitle" }, [state.leaderboardError]));
  } else {
    state.leaderboard.forEach((r, i) => {
      list.appendChild(
        el("div", { class: "leader-row" }, [
          el("div", { class: "rank" }, [`#${i + 1}`]),
          el("div", { class: "name" }, [r.student_name || "（無名）"]),
          el("div", { class: "score" }, [String(r.best_score ?? 0)]),
        ])
      );
    });
  }

  box.appendChild(list);
  return box;
}

function renderOverlay() {
  const hidden = !state.overlayText;
  const textClass = state.overlayOk ? "overlay-text ok" : "overlay-text no";

  return el("div", { class: hidden ? "overlay hidden" : "overlay" }, [
    el("div", { class: "overlay-box" }, [
      el("div", { class: textClass }, [state.overlayText || ""]),
      state.overlayDetail ? el("div", { class: "overlay-detail" }, [state.overlayDetail]) : null,
    ]),
  ]);
}

function renderTimer() {
  const progress = Math.max(0, Math.min(1, state.timeLeft / SECONDS));
  const danger = state.timeLeft <= 5;

  return el("div", { class: "timer-wrap" }, [
    el(
      "div",
      {
        class: danger ? "timer-circle danger" : "timer-circle",
        style: `--progress:${progress}; --timer-color:${danger ? "#ff6b6b" : "#7CFFB2"};`,
      },
      [
        el(
          "div",
          { class: danger ? "timer-inner danger" : "timer-inner" },
          [String(state.timeLeft)]
        ),
      ]
    ),
  ]);
}

async function openLeaderboard() {
  await refreshLeaderboard();
  render();
}

async function refreshLeaderboard() {
  state.leaderboardError = "";
  const { data, error } = await supabase
    .from("leaderboard")
    .select("student_name,best_score,updated_at")
    .order("best_score", { ascending: false })
    .order("updated_at", { ascending: true })
    .limit(LEADER_LIMIT);

  if (error) {
    console.error(error);
    state.leaderboard = [];
    state.leaderboardError = "排行榜讀取失敗";
    return;
  }

  state.leaderboard = data || [];
}

function toast(msg) {
  state.toast = msg;
  render();
  setTimeout(() => {
    state.toast = "";
    render();
  }, 1600);
}

async function startGame() {
  const name = (state.studentName || "").trim();
  if (!name) {
    toast("請先輸入名字");
    return;
  }
  state.startTime = Date.now();
  state.phase = "playing";
  state.score = 0;
  state.idx = 0;
  state.locked = false;
  state.overlayText = "";
  state.overlayDetail = "";
  state.timeLeft = SECONDS;

  await loadQuestions();
  startTimer();
  render();
}

async function restartGame() {
  stopTimer();
  await startGame();
}

async function loadQuestions() {
  const { count } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true });

  const totalCount = Number(count || 0);
  if (totalCount < TOTAL) {
    toast(`題庫不足，目前只有 ${totalCount} 題`);
    state.questions = [];
    return;
  }

  const maxOffset = Math.max(0, totalCount - TOTAL);
  const offset = Math.floor(Math.random() * (maxOffset + 1));

  const { data, error } = await supabase
    .from("questions")
    .select("id,sentence,choices,correct_index")
    .order("id", { ascending: true })
    .range(offset, offset + TOTAL - 1);

  if (error) {
    console.error(error);
    toast("讀題目失敗");
    state.questions = [];
    return;
  }

  state.questions = (data || []).map((q) => ({
    id: q.id,
    sentence: String(q.sentence || ""),
    choices: Array.isArray(q.choices) ? q.choices.map((x) => String(x)) : [],
    correct_index: Number(q.correct_index),
  }));
}

function startTimer() {
  stopTimer();

  state.timerId = setInterval(() => {
    if (state.phase !== "playing") return;
    if (state.locked) return;

    state.timeLeft -= 1;

    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      const q = state.questions[state.idx];
      state.locked = true;
      state.overlayOk = false;
      state.overlayText = "⏰ 超時";
      state.overlayDetail = q ? `正確答案：${q.choices[q.correct_index]}` : "";
      render();

      setTimeout(() => {
        state.overlayText = "";
        state.overlayDetail = "";
        state.locked = false;
        nextQuestion();
      }, 1400);

      return;
    }

    render();
  }, 1000);
}

function stopTimer() {
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = null;
}

function onChoose(choiceIndex) {
  if (state.locked) return;

  const q = state.questions[state.idx];
  if (!q) return;

  state.locked = true;
  stopTimer();

  const ok = choiceIndex === q.correct_index;
  if (ok) state.score += 1;

  state.overlayOk = ok;
  state.overlayText = ok ? "✔ 正確" : "✖ 錯誤";
  state.overlayDetail = ok ? "" : `正確答案：${q.choices[q.correct_index]}`;

  render();

  requestAnimationFrame(() => {
    const btns = Array.from(document.querySelectorAll(".choice"));
    btns.forEach((b, i) => {
      b.disabled = true;
      if (i === q.correct_index) b.classList.add("correct");
      else if (i === choiceIndex && !ok) b.classList.add("wrong", "shake");
      else b.classList.add("dim");
    });
  });

  setTimeout(() => {
    state.overlayText = "";
    state.overlayDetail = "";
    state.locked = false;
    nextQuestion();
  }, 1400);
}

function nextQuestion() {
  if (state.idx + 1 >= TOTAL) {
    finishGame();
    return;
  }

  state.idx += 1;
  state.timeLeft = SECONDS;
  startTimer();
  render();
}

async function finishGame() {
  stopTimer();
  state.phase = "finished";
  await upsertBestScore();
  await refreshLeaderboard();
  render();
  state.endTime = Date.now();

  const totalSeconds =
    Math.floor((state.endTime - state.startTime) / 1000);
}

async function upsertBestScore() {
  try {
    const { data: row } = await supabase
      .from("leaderboard")
      .select("best_score")
      .eq("student_id", state.studentId)
      .maybeSingle();

    const prev = Number(row?.best_score ?? -1);
    const best = Math.max(prev, state.score);

    const { error } = await supabase
      .from("leaderboard")
      .upsert(
        {
          student_id: state.studentId,
          student_name: state.studentName,
          best_score: best,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "student_id" }
      );

    if (error) throw error;
  } catch (e) {
    console.error("upsertBestScore error:", e);
  }
}