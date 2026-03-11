import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://kcnkdjzorcmmbsczehik.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_0-jWBjVsawY9Ranq0Gja4g_958sl9k4";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TOTAL = 20;
const SECONDS = 15;
const LEADER_LIMIT = 100;

const state = {
  phase: "login",
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
  try {
    mountMouseGlow();
    renderLoading();
    await ensureAnonAuth();
    await refreshLeaderboard();
    render();
  } catch (err) {
    console.error(err);
    renderFatal(err);
  }
}

async function ensureAnonAuth() {
  const { data } = await supabase.auth.getSession();

  if (!data?.session) {
    await supabase.auth.signInAnonymously();
  }

  const { data: userData } = await supabase.auth.getUser();
  state.studentId = userData?.user?.id || crypto.randomUUID();
}

function mountMouseGlow() {
  let glow = document.querySelector(".mouse-glow");

  if (glow) return;

  glow = document.createElement("div");
  glow.className = "mouse-glow";
  document.body.appendChild(glow);

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let currentX = mouseX;
  let currentY = mouseY;

  window.addEventListener("mousemove", e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  function animate() {
    currentX += (mouseX - currentX) * 0.1;
    currentY += (mouseY - currentY) * 0.1;

    glow.style.left = currentX + "px";
    glow.style.top = currentY + "px";

    requestAnimationFrame(animate);
  }

  animate();
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);

  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  }

  for (const c of children) {
    if (typeof c === "string") node.appendChild(document.createTextNode(c));
    else if (c) node.appendChild(c);
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
}

function renderLogin() {
  const wrap = document.createElement("div");

  wrap.appendChild(
    el("div", { class: "title" }, ["⏱️ 時態練習 | 20 題"])
  );

  const input = el("input", {
    class: "input",
    placeholder: "輸入名字"
  });

  input.addEventListener("input", e => {
    state.studentName = e.target.value;
  });

  wrap.appendChild(input);

  wrap.appendChild(
    el("button",
      { class: "btn btn-primary", onClick: startGame },
      ["開始"]
    )
  );

  wrap.appendChild(renderLeaderPreview());

  return wrap;
}

function renderGame() {
  const wrap = document.createElement("div");

  const q = state.questions[state.idx];

  wrap.appendChild(
    el("div", { class: "question" }, [q?.sentence || "載入中..."])
  );

  const grid = el("div", { class: "choices" });

  q?.choices?.forEach((c, i) => {
    grid.appendChild(
      el("button",
        { class: "choice", onClick: () => onChoose(i) },
        [c]
      )
    );
  });

  wrap.appendChild(grid);

  return wrap;
}

function renderFinish() {
  const wrap = document.createElement("div");

  wrap.appendChild(
    el("div", { class: "title" }, ["完成"])
  );

  wrap.appendChild(
    el("div", {}, [`分數 ${state.score}/${TOTAL}`])
  );

  wrap.appendChild(
    el("button",
      { class: "btn btn-primary", onClick: restartGame },
      ["再玩一次"]
    )
  );

  wrap.appendChild(renderLeaderPreview());

  return wrap;
}

function renderLeaderPreview() {
  const box = el("div", { class: "leader-preview" }, [
    el("div", { class: "leader-title" }, ["🏆 排行榜"])
  ]);

  const list = el("div");

  if (!state.leaderboard.length) {
    list.appendChild(el("div", {}, ["目前沒有資料"]));
  } else {
    state.leaderboard.forEach((r, i) => {
      list.appendChild(
        el("div", {}, [
          `#${i + 1} ${r.student_name} - ${r.best_score}`
        ])
      );
    });
  }

  box.appendChild(list);
  return box;
}

function renderOverlay() {
  if (!state.overlayText) return document.createElement("div");

  return el("div", { class: "overlay" }, [
    el("div", {}, [state.overlayText])
  ]);
}

async function refreshLeaderboard() {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("student_name,best_score,best_time_sec")
    .order("best_score", { ascending: false })
    .limit(LEADER_LIMIT);

  if (error) {
    console.error(error);
    return;
  }

  state.leaderboard = data || [];
}

async function startGame() {

  if (!state.studentName.trim()) {
    alert("請輸入名字");
    return;
  }

  state.phase = "playing";
  state.score = 0;
  state.idx = 0;

  await loadQuestions();

  render();
}

async function restartGame() {
  await startGame();
}

async function loadQuestions() {

  const { data } = await supabase
    .from("questions")
    .select("*")
    .limit(TOTAL);

  state.questions = data || [];
}

function onChoose(i) {

  const q = state.questions[state.idx];

  if (i === q.correct_index) {
    state.score++;
    state.overlayText = "✔ 正確";
  } else {
    state.overlayText = "✖ 錯誤";
  }

  render();

  setTimeout(() => {
    state.overlayText = "";
    nextQuestion();
  }, 1000);
}

function nextQuestion() {

  state.idx++;

  if (state.idx >= TOTAL) {
    finishGame();
    return;
  }

  render();
}

async function finishGame() {

  state.phase = "finished";

  await supabase
    .from("leaderboard")
    .insert({
      student_id: state.studentId,
      student_name: state.studentName,
      best_score: state.score
    });

  await refreshLeaderboard();

  render();
}

function renderLoading() {
  document.getElementById("app").innerHTML = "載入中...";
}

function renderFatal(err) {
  document.getElementById("app").innerHTML = "網站錯誤";
}