-- ========== QUESTIONS ==========
create table if not exists public.questions (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  sentence text not null,
  choices jsonb not null,              -- ["go","went","..."]
  correct_index int4 not null          -- 0~3
);

-- ========== SESSIONS ==========
create table if not exists public.quiz_sessions (
  id uuid primary key,
  created_at timestamptz not null default now(),
  student_id text not null,
  student_name text not null,
  total int4 not null default 20,
  time_limit_sec int4 not null default 15,
  current_q_no int4 not null default 0,
  score int4 not null default 0,
  status text not null default 'active' -- active / done / killed
);

-- 每一題在 session 內的快照（避免前端拿到答案表）
create table if not exists public.quiz_session_questions (
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  q_no int4 not null,
  question_id bigint not null references public.questions(id),
  sentence text not null,
  choices jsonb not null,              -- 已洗牌後的 choices
  correct_index int4 not null,         -- 對應洗牌後
  issued_at timestamptz not null default now(),
  answered_at timestamptz,
  chosen_index int4,
  timed_out boolean not null default false,
  correct boolean not null default false,
  primary key (session_id, q_no)
);

-- ========== LEADERBOARD (best score per student) ==========
create table if not exists public.leaderboard (
  student_id text primary key,
  student_name text not null,
  best_score int4 not null default 0,
  updated_at timestamptz not null default now()
);

-- ========== TEACHER WHITELIST ==========
create table if not exists public.teacher_whitelist (
  email text primary key,
  created_at timestamptz not null default now()
);

-- (可選) 讓前端匿名讀排行榜：用 service role 其實不用 RLS，但開著更安全也行
alter table public.leaderboard enable row level security;
do $$ begin
  create policy "read leaderboard" on public.leaderboard
  for select using (true);
exception when duplicate_object then null;
end $$;

-- questions 建議不給前端直接 select（我們都走 function + service role）
alter table public.questions enable row level security;
