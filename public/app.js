import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://kcnkdjzorcmmbsczehik.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_0-jWBjVsawY9Ranq0Gja4g_958sl9k4";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TOTAL = 20;
const SECONDS = 15;
const LEADER_LIMIT = 9999;

const state = {
  phase: "login", // login | playing | finished
  studentName: "",
  studentId: "",
  score: 0,
  idx: 0,
  questions: [],
  timeLeft: SECONDS,
  timerId: null,
  locked: false,

  startTime: 0,
  endTime: 0,
  totalElapsedSec: 0,

  overlayText: "",
  overlayDetail: "",
  overlayOk: false,

  leaderboard: [],
  leaderboardError: "",
  toast: "",
};

boot();

async function boot() {
  mountMouseGlow();
  await ensureAnonAuth();
  await refreshLeaderboard();
  render();
}

async function ensureAnonAuth() {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) {
    await supabase.auth.signInAnonymously();
  }
  const { data: userData } = await supabase.auth.getUser();
  state.studentId = userData?.user?.id || crypto.randomUUID();
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
    currentX += (mouseX - currentX) * 0.1;
    currentY += (mouseY - currentY) * 0.1;
    glow.style.left = currentX + "px";
    glow.style.top = currentY + "px";
    requestAnimationFrame(animateGlow);
  }

  animateGlow();
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);

  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") {
      node.className = v;
    } else if (k === "value") {
      node.value = v;
    } else if (k === "style") {
      node.setAttribute("style", v);
    } else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
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
  if (!root) return;

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
        el("button", { class: "btn btn-secondary", onClick: openLeaderboardModal }, ["看排行榜"]),
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
  const wrap = document.createElement("div");
  const q = state.questions[state.idx];

  wrap.appendChild(
    el("div", { class: "hud" }, [
      el("div", { class: "hud-text" }, [
        `玩家 ${state.studentName}　第 ${state.idx + 1}/${TOTAL} 題　分數 ${state.score}　⏱ ${formatSeconds(
          state.totalElapsedSec
        )}`,
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

  const choices = Array.isArray(q.choices) ? q.choices : [];
  const grid = el("div", { class: "choices" });

  choices.forEach((choiceText, i) => {
    grid.appendChild(
      el(
        "button",
        {
          class: "choice",
          onClick: () => onChoose(i),
        },
        [String(choiceText)]
      )
    );
  });

  wrap.appendChild(grid);

  wrap.appendChild(
    el("div", { class: "bottom-bar row-right" }, [
      el("button", { class: "btn btn-secondary", onClick: restartGame }, ["重新開始"]),
      el("button", { class: "btn btn-secondary", onClick: openLeaderboardModal }, ["看排行榜"]),
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
        el("button", { class: "btn btn-secondary", onClick: openLeaderboardModal }, ["看排行榜"]),
      ]),
    ])
  );

  wrap.appendChild(
    el("div", { class: "finish-box" }, [
      el("div", { class: "leader-title" }, [`你的分數：${state.score} / ${TOTAL}`]),
      el("div", { class: "subtitle" }, [`總時間：${formatSeconds(state.totalElapsedSec)}`]),
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
          el("div", { class: "score" }, [
            `${r.best_score ?? 0}${r.best_time_sec != null ? ` / ${formatSeconds(r.best_time_sec)}` : ""}`,
          ]),
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

async function openLeaderboardModal() {
  await refreshLeaderboard();

  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modalOverlay";

  const modal = el("div", { class: "modal" }, [
    el("div", { class: "modalTitle" }, ["🏆 所有人排行榜"]),
    el(
      "div",
      { class: "modalBody" },
      state.leaderboardError
        ? [el("div", { class: "err" }, [state.leaderboardError])]
        : [
            el(
              "div",
              { class: "lb" },
              state.leaderboard.map((r, i) =>
                el("div", { class: "lbRow" }, [
                  el("div", { class: "lbRank" }, [`#${i + 1}`]),
                  el("div", { class: "lbName" }, [r.student_name || "（無名）"]),
                  el("div", { class: "lbScore" }, [
                    `${r.best_score ?? 0}${r.best_time_sec != null ? ` / ${formatSeconds(r.best_time_sec)}` : ""}`,
                  ]),
                ])
              )
            ),
          ]
    ),
    el("div", { class: "modalActions" }, [
      el("button", {
        class: "btn btn-secondary",
        onClick: () => {
          modalOverlay.remove();
        },
      }, ["關閉"]),
    ]),
  ]);

  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) modalOverlay.remove();
  });

  modalOverlay.appendChild(modal);
  document.body.appendChild(modalOverlay);
}

async function refreshLeaderboard() {
  state.leaderboardError = "";

  const { data, error } = await supabase
    .from("leaderboard")
    .select("student_name,best_score,best_time_sec,updated_at")
    .order("best_score", { ascending: false })
    .order("best_time_sec", { ascending: true, nullsFirst: false })
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

  state.phase = "playing";
  state.score = 0;
  state.idx = 0;
  state.locked = false;
  state.overlayText = "";
  state.overlayDetail = "";
  state.timeLeft = SECONDS;

  state.startTime = Date.now();
  state.endTime = 0;
  state.totalElapsedSec = 0;

  await loadQuestions();
  if (!state.questions.length) {
    state.phase = "login";
    render();
    return;
  }

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

  state.questions = (data || [])
    .map((q) => ({
      id: q.id,
      sentence: String(q.sentence || ""),
      choices: Array.isArray(q.choices) ? q.choices.map((x) => String(x)) : [],
      correct_index: Number(q.correct_index),
    }))
    .filter((q) => q.sentence && Array.isArray(q.choices) && q.choices.length === 4 && Number.isInteger(q.correct_index));
}

function startTimer() {
  stopTimer();

  state.timerId = setInterval(() => {
    if (state.phase !== "playing") return;
    if (state.locked) return;

    state.totalElapsedSec = Math.floor((Date.now() - state.startTime) / 1000);

    state.timeLeft -= 1;

    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      const q = state.questions[state.idx];

      state.locked = true;
      state.overlayOk = false;
      state.overlayText = "⏰ 超時";
      state.overlayDetail = q ? `正確答案：${q.choices[q.correct_index]}` : "";
      render();

      requestAnimationFrame(() => {
        const btns = Array.from(document.querySelectorAll(".choice"));
        btns.forEach((b, i) => {
          b.disabled = true;
          if (q && i === q.correct_index) b.classList.add("correct");
          else b.classList.add("dim");
        });
      });

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
  if (!q || !Array.isArray(q.choices) || q.choices.length !== 4) return;

  state.locked = true;
  stopTimer();
  state.totalElapsedSec = Math.floor((Date.now() - state.startTime) / 1000);

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
  state.endTime = Date.now();
  state.totalElapsedSec = Math.floor((state.endTime - state.startTime) / 1000);

  await upsertBestScore();
  await refreshLeaderboard();
  render();
}

async function upsertBestScore() {
  try {
    const { data: row } = await supabase
      .from("leaderboard")
      .select("best_score,best_time_sec")
      .eq("student_id", state.studentId)
      .maybeSingle();

    const prevScore = Number(row?.best_score ?? -1);
    const prevTime = row?.best_time_sec == null ? null : Number(row.best_time_sec);

    let bestScore = prevScore;
    let bestTime = prevTime;

    if (state.score > prevScore) {
      bestScore = state.score;
      bestTime = state.totalElapsedSec;
    } else if (state.score === prevScore) {
      if (prevTime == null || state.totalElapsedSec < prevTime) {
        bestTime = state.totalElapsedSec;
      }
    }

    const { error } = await supabase
      .from("leaderboard")
      .upsert(
        {
          student_id: state.studentId,
          student_name: state.studentName,
          best_score: bestScore,
          best_time_sec: bestTime,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "student_id" }
      );

    if (error) throw error;
  } catch (e) {
    console.error("upsertBestScore error:", e);
  }
}

function formatSeconds(totalSec) {
  const s = Number(totalSec || 0);
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}