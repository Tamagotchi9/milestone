# Pomodoro Sessions Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist Focus-phase pomodoro attempts in Supabase with a full lifecycle and show today/week/focused-task stats on the dashboard home and Pomodoro page via `pomodoro_stats` RPC.

**Architecture:** Client writes session rows through `usePomodoroSessions` (start/pause/resume/complete/abandon) from `PomidoroTimer`. Aggregates come from a security-invoker Postgres RPC. Dashboard and Pomodoro share a small presentational stats component. Breaks stay local-only.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, `@nuxtjs/supabase` / `@supabase/supabase-js`, Supabase Postgres (migrations + RLS + RPC), Nuxt UI.

**Spec:** `docs/superpowers/specs/2026-07-14-pomodoro-sessions-design.md`

## Global Constraints

- Row = one Focus (work) phase attempt only — never persist short/long breaks
- `task_id` frozen at Start (or null); mid-session focus changes do not rewrite the row
- Completed stats use only `was_completed = true`
- Week = UTC Monday 00:00 → next Monday (no local timezone in v1)
- Failed writes must not stop the local timer
- Prefer `const name = () => {}` arrows in new TS/Vue; feature types live in `app/types/pomodoro.types.ts`
- Explicit default imports for local Vue SFCs
- This repo has no unit-test runner — verify with SQL smoke + manual browser checks

---



## File map


| File                                                            | Responsibility                                                                            |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `supabase/migrations/*_pomodoro_sessions_lifecycle.sql`         | Enum, table harden, JWT `user_id`, RLS, indexes, FK, stale cleanup + `pomodoro_stats` RPC |
| `app/types/database.types.ts`                                   | Regenerated/updated Table + Enum + Functions typings                                      |
| `app/types/pomodoro.types.ts`                                   | `PomodoroSessionStatus`, `PomodoroStats`, duration helper types                           |
| `app/composables/usePomodoroSessions.ts`                        | Lifecycle writes, wall-clock `actual_seconds`, `fetchStats`                               |
| `app/utils/formatFocusDuration.ts`                              | Format seconds → `1h 12m` / `45m` for UI                                                  |
| `app/components/dashboard/PomodoroStatsSummary.vue`             | Presentational today/week/(optional task) lines                                           |
| `app/components/dashboard/PomidoroTimer.vue`                    | Wire lifecycle + light stats under timer                                                  |
| `app/pages/dashboard/index.vue`                                 | Compact stats summary on home                                                             |
| `docs/superpowers/specs/2026-07-14-pomodoro-sessions-design.md` | Behavior source of truth (read-only during implementation)                                |


---



### Task 1: Database migration (schema, RLS, RPC)

**Files:**

- Create: `supabase/migrations/<timestamp>_pomodoro_sessions_lifecycle.sql`

**Interfaces:**

- Produces: enum `pomodoro_session_status`; hardened `public.pomodoro_sessions`; function `public.pomodoro_stats(p_task_id uuid default null)` returning one row with `completed_today`, `seconds_today`, `completed_week`, `seconds_week`, `completed_for_task`, `seconds_for_task` (all `bigint`)

- [ ] **Step 1: Create the migration file**

Prefer CLI (creates a correct timestamp name):

```bash
supabase migration new pomodoro_sessions_lifecycle
```

If CLI/config is unavailable, create `supabase/migrations/20260718120000_pomodoro_sessions_lifecycle.sql` manually.

- [ ] **Step 2: Write the migration SQL**

Put the following into the new migration file (adjust only if remote already has identical objects — keep statements idempotent with `if not exists` / `drop … if exists` where shown):

```sql
-- Pomodoro sessions: lifecycle enum, ownership, RLS, stats RPC.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'pomodoro_session_status' and n.nspname = 'public'
  ) then
    create type public.pomodoro_session_status as enum (
      'running',
      'paused',
      'completed',
      'abandoned'
    );
  end if;
end $$;

create table if not exists public.pomodoro_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  duration_minutes integer not null default 25,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  actual_seconds integer,
  status text not null default 'running',
  was_completed boolean not null default false
);

-- Convert status text → enum when still text
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pomodoro_sessions'
      and column_name = 'status'
      and data_type = 'text'
  ) then
    update public.pomodoro_sessions
    set status = 'running'
    where status is null
       or status not in ('running', 'paused', 'completed', 'abandoned');

    alter table public.pomodoro_sessions
      alter column status drop default;

    alter table public.pomodoro_sessions
      alter column status type public.pomodoro_session_status
      using status::public.pomodoro_session_status;

    alter table public.pomodoro_sessions
      alter column status set default 'running'::public.pomodoro_session_status;
  end if;
end $$;

alter table public.pomodoro_sessions
  alter column user_id set default auth.uid();

-- Ensure task FK is ON DELETE SET NULL
alter table public.pomodoro_sessions
  drop constraint if exists pomodoro_sessions_task_id_fkey;

alter table public.pomodoro_sessions
  add constraint pomodoro_sessions_task_id_fkey
  foreign key (task_id)
  references public.tasks (id)
  on delete set null;

create or replace function public.pomodoro_sessions_set_user_id_from_jwt()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  new.user_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists pomodoro_sessions_set_user_id_from_jwt on public.pomodoro_sessions;

create trigger pomodoro_sessions_set_user_id_from_jwt
  before insert on public.pomodoro_sessions
  for each row
  execute function public.pomodoro_sessions_set_user_id_from_jwt();

create or replace function public.pomodoro_sessions_prevent_user_id_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_id is distinct from old.user_id then
    new.user_id := old.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists pomodoro_sessions_prevent_user_id_change on public.pomodoro_sessions;

create trigger pomodoro_sessions_prevent_user_id_change
  before update on public.pomodoro_sessions
  for each row
  execute function public.pomodoro_sessions_prevent_user_id_change();

alter table public.pomodoro_sessions enable row level security;

drop policy if exists "Users manage own pomodoro sessions" on public.pomodoro_sessions;

create policy "Users manage own pomodoro sessions"
  on public.pomodoro_sessions
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists pomodoro_sessions_user_started_at_idx
  on public.pomodoro_sessions (user_id, started_at desc);

create index if not exists pomodoro_sessions_user_task_id_idx
  on public.pomodoro_sessions (user_id, task_id)
  where task_id is not null;

grant select, insert, update, delete on public.pomodoro_sessions to authenticated;

create or replace function public.pomodoro_stats(p_task_id uuid default null)
returns table (
  completed_today bigint,
  seconds_today bigint,
  completed_week bigint,
  seconds_week bigint,
  completed_for_task bigint,
  seconds_for_task bigint
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  day_start timestamptz;
  week_start timestamptz;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  update public.pomodoro_sessions
  set
    status = 'abandoned',
    was_completed = false,
    completed_at = coalesce(completed_at, now())
  where user_id = uid
    and status in ('running', 'paused')
    and started_at < now() - interval '3 hours';

  day_start := date_trunc('day', timezone('utc', now())) at time zone 'utc';
  week_start := date_trunc('week', timezone('utc', now())) at time zone 'utc';

  return query
  select
    count(*) filter (
      where s.was_completed and s.started_at >= day_start
    )::bigint as completed_today,
    coalesce(
      sum(s.actual_seconds) filter (
        where s.was_completed and s.started_at >= day_start
      ),
      0
    )::bigint as seconds_today,
    count(*) filter (
      where s.was_completed and s.started_at >= week_start
    )::bigint as completed_week,
    coalesce(
      sum(s.actual_seconds) filter (
        where s.was_completed and s.started_at >= week_start
      ),
      0
    )::bigint as seconds_week,
    count(*) filter (
      where s.was_completed
        and p_task_id is not null
        and s.task_id = p_task_id
        and s.started_at >= week_start
    )::bigint as completed_for_task,
    coalesce(
      sum(s.actual_seconds) filter (
        where s.was_completed
          and p_task_id is not null
          and s.task_id = p_task_id
          and s.started_at >= week_start
      ),
      0
    )::bigint as seconds_for_task
  from public.pomodoro_sessions s
  where s.user_id = uid;
end;
$$;

grant execute on function public.pomodoro_stats(uuid) to authenticated;
```

- [ ] **Step 3: Apply migration to the project database**

Use the project’s normal path (linked remote or local):

```bash
supabase db push
# or: supabase migration up --local
```

Expected: migration applies without error.

- [ ] **Step 4: SQL smoke checks**

As an authenticated user (SQL editor / `supabase db query` with a JWT role, or insert via the app later):

1. `select * from public.pomodoro_stats(null);` → all zeros for a fresh user.
2. Insert a completed row (`was_completed=true`, `started_at=now()`, `actual_seconds=1500`, `status='completed'`) for that user → re-call RPC → `completed_today` and `completed_week` ≥ 1; `seconds_*` ≥ 1500.
3. Call `pomodoro_stats('<that task uuid>')` → `completed_for_task` / `seconds_for_task` match when `task_id` matches; zeros when it does not.

Expected: all three checks pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/*_pomodoro_sessions_lifecycle.sql
git commit -m "$(cat <<'EOF'
Add pomodoro_sessions lifecycle migration and stats RPC.

EOF
)"
```

---



### Task 2: Regenerate Database types + feature types + duration helper

**Files:**

- Modify: `app/types/database.types.ts`
- Create: `app/types/pomodoro.types.ts`
- Create: `app/utils/formatFocusDuration.ts`

**Interfaces:**

- Consumes: migrated `pomodoro_sessions` + `pomodoro_stats`
- Produces:
  - `PomodoroSessionStatus = 'running' | 'paused' | 'completed' | 'abandoned'`
  - `PomodoroStats = { completedToday; secondsToday; completedWeek; secondsWeek; completedForTask; secondsForTask }` (numbers)
  - `formatFocusDuration(totalSeconds: number): string`

- [ ] **Step 1: Regenerate** `database.types.ts`

If the project is linked:

```bash
supabase gen types typescript --linked > app/types/database.types.ts
```

If generation is unavailable, manually update `app/types/database.types.ts` so that:

1. `Enums` includes `pomodoro_session_status: 'running' | 'paused' | 'completed' | 'abandoned'`
2. `pomodoro_sessions.Row.status` uses that enum (not `string`)
3. `pomodoro_sessions.Insert.user_id` is optional (`user_id?: string`) — JWT trigger owns it
4. `Functions` includes:

```ts
pomodoro_stats: {
  Args: { p_task_id?: string | null }
  Returns: {
    completed_today: number
    seconds_today: number
    completed_week: number
    seconds_week: number
    completed_for_task: number
    seconds_for_task: number
  }[]
}
```

(Exact shape must match what `supabase gen types` emits for a `returns table` function — prefer generated output.)

- [ ] **Step 2: Add** `app/types/pomodoro.types.ts`

```ts
/** Matches `public.pomodoro_session_status` in Postgres */
export type PomodoroSessionStatus =
  | 'running'
  | 'paused'
  | 'completed'
  | 'abandoned'

export type PomodoroStats = {
  completedToday: number
  secondsToday: number
  completedWeek: number
  secondsWeek: number
  completedForTask: number
  secondsForTask: number
}

export const EMPTY_POMODORO_STATS: PomodoroStats = {
  completedToday: 0,
  secondsToday: 0,
  completedWeek: 0,
  secondsWeek: 0,
  completedForTask: 0,
  secondsForTask: 0,
}
```

- [ ] **Step 3: Add** `app/utils/formatFocusDuration.ts`

```ts
export const formatFocusDuration = (totalSeconds: number): string => {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const totalMinutes = Math.floor(safe / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours <= 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}
```

- [ ] **Step 4: Sanity-check the helper in Node**

```bash
node --input-type=module -e "
import { formatFocusDuration } from './app/utils/formatFocusDuration.ts'
console.log(formatFocusDuration(0), formatFocusDuration(59), formatFocusDuration(60), formatFocusDuration(4320), formatFocusDuration(3600))
"
```

Expected stdout includes: `0m 0m 1m 1h 12m 1h` (if the runtime cannot import `.ts` directly, skip and rely on `pnpm lint` in a later task).

- [ ] **Step 5: Commit**

```bash
git add app/types/database.types.ts app/types/pomodoro.types.ts app/utils/formatFocusDuration.ts
git commit -m "$(cat <<'EOF'
Add pomodoro feature types and focus duration formatter.

EOF
)"
```

---



### Task 3: `usePomodoroSessions` composable

**Files:**

- Create: `app/composables/usePomodoroSessions.ts`

**Interfaces:**

- Consumes: `Database`, `PomodoroStats`, `EMPTY_POMODORO_STATS`, Supabase client
- Produces API:

```ts
{
  currentSessionId: Ref<string | null>
  stats: Ref<PomodoroStats>
  statsError: Ref<string | null>
  isStatsLoading: Ref<boolean>
  startSession: (taskId: string | null) => Promise<string | null>
  pauseSession: () => Promise<void>
  resumeSession: () => Promise<void>
  completeSession: () => Promise<void>
  abandonSession: () => Promise<void>
  fetchStats: (taskId?: string | null) => Promise<void>
}
```

- Wall-clock: accumulate seconds only while running; flush into `actual_seconds` on pause/complete/abandon
- Ignore `startSession` if `currentSessionId` is already set
- Do not send `user_id` from the client
- On write errors: `console.error` (toast optional); do not throw to the timer

- [ ] **Step 1: Create the composable**

```ts
import type { Database } from '~/types/database.types'
import {
  EMPTY_POMODORO_STATS,
  type PomodoroStats,
} from '~/types/pomodoro.types'

const DEFAULT_DURATION_MINUTES = 25

const toNumber = (value: number | string | null | undefined): number => {
  if (value == null) return 0
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

const mapStatsRow = (row: {
  completed_today: number | string
  seconds_today: number | string
  completed_week: number | string
  seconds_week: number | string
  completed_for_task: number | string
  seconds_for_task: number | string
}): PomodoroStats => ({
  completedToday: toNumber(row.completed_today),
  secondsToday: toNumber(row.seconds_today),
  completedWeek: toNumber(row.completed_week),
  secondsWeek: toNumber(row.seconds_week),
  completedForTask: toNumber(row.completed_for_task),
  secondsForTask: toNumber(row.seconds_for_task),
})

export const usePomodoroSessions = () => {
  const supabase = useSupabaseClient<Database>()

  const currentSessionId = useState<string | null>(
    'pomodoro.currentSessionId',
    () => null,
  )
  const stats = useState<PomodoroStats>(
    'pomodoro.stats',
    () => ({ ...EMPTY_POMODORO_STATS }),
  )
  const statsError = useState<string | null>('pomodoro.statsError', () => null)
  const isStatsLoading = useState<boolean>('pomodoro.statsLoading', () => false)

  const accumulatedSeconds = useState<number>(
    'pomodoro.accumulatedSeconds',
    () => 0,
  )
  const runningSinceMs = useState<number | null>(
    'pomodoro.runningSinceMs',
    () => null,
  )

  const flushElapsed = (): number => {
    if (runningSinceMs.value != null) {
      const delta = Math.max(
        0,
        Math.floor((Date.now() - runningSinceMs.value) / 1000),
      )
      accumulatedSeconds.value += delta
      runningSinceMs.value = null
    }
    return accumulatedSeconds.value
  }

  const resetTiming = () => {
    accumulatedSeconds.value = 0
    runningSinceMs.value = null
  }

  const clearSessionLocal = () => {
    currentSessionId.value = null
    resetTiming()
  }

  const startSession = async (taskId: string | null): Promise<string | null> => {
    if (currentSessionId.value) return currentSessionId.value

    resetTiming()
    runningSinceMs.value = Date.now()

    const { data, error } = await supabase
      .from('pomodoro_sessions')
      .insert({
        task_id: taskId,
        duration_minutes: DEFAULT_DURATION_MINUTES,
        status: 'running',
        was_completed: false,
        actual_seconds: 0,
      })
      .select('id')
      .single()

    if (error) {
      console.error('startSession:', error.message)
      resetTiming()
      return null
    }

    currentSessionId.value = data.id
    return data.id
  }

  const pauseSession = async () => {
    if (!currentSessionId.value) return
    const actual = flushElapsed()

    const { error } = await supabase
      .from('pomodoro_sessions')
      .update({ status: 'paused', actual_seconds: actual })
      .eq('id', currentSessionId.value)

    if (error) console.error('pauseSession:', error.message)
  }

  const resumeSession = async () => {
    if (!currentSessionId.value) return
    runningSinceMs.value = Date.now()

    const { error } = await supabase
      .from('pomodoro_sessions')
      .update({ status: 'running' })
      .eq('id', currentSessionId.value)

    if (error) console.error('resumeSession:', error.message)
  }

  const completeSession = async () => {
    if (!currentSessionId.value) return
    const actual = flushElapsed()
    const id = currentSessionId.value

    const { error } = await supabase
      .from('pomodoro_sessions')
      .update({
        status: 'completed',
        was_completed: true,
        completed_at: new Date().toISOString(),
        actual_seconds: actual,
      })
      .eq('id', id)

    if (error) console.error('completeSession:', error.message)
    clearSessionLocal()
  }

  const abandonSession = async () => {
    if (!currentSessionId.value) return
    const actual = flushElapsed()
    const id = currentSessionId.value

    const { error } = await supabase
      .from('pomodoro_sessions')
      .update({
        status: 'abandoned',
        was_completed: false,
        completed_at: new Date().toISOString(),
        actual_seconds: actual,
      })
      .eq('id', id)

    if (error) console.error('abandonSession:', error.message)
    clearSessionLocal()
  }

  const fetchStats = async (taskId: string | null = null) => {
    isStatsLoading.value = true
    statsError.value = null

    const { data, error } = await supabase.rpc('pomodoro_stats', {
      p_task_id: taskId,
    })

    isStatsLoading.value = false

    if (error) {
      console.error('fetchStats:', error.message)
      statsError.value = error.message
      return
    }

    const row = Array.isArray(data) ? data[0] : data
    stats.value = row ? mapStatsRow(row) : { ...EMPTY_POMODORO_STATS }
  }

  return {
    currentSessionId,
    stats,
    statsError,
    isStatsLoading,
    startSession,
    pauseSession,
    resumeSession,
    completeSession,
    abandonSession,
    fetchStats,
  }
}
```

- [ ] **Step 2: Lint the new file**

```bash
pnpm exec eslint app/composables/usePomodoroSessions.ts
```

Expected: no errors (fix any style issues before continuing).

- [ ] **Step 3: Commit**

```bash
git add app/composables/usePomodoroSessions.ts
git commit -m "$(cat <<'EOF'
Add usePomodoroSessions for lifecycle writes and stats RPC.

EOF
)"
```

---



### Task 4: Wire `PomidoroTimer` lifecycle + light stats

**Files:**

- Modify: `app/components/dashboard/PomidoroTimer.vue`
- Create: `app/components/dashboard/PomodoroStatsSummary.vue` (used here; reused in Task 5)

**Interfaces:**

- Consumes: `usePomodoroSessions`, `useTasks().focusedTask`, `formatFocusDuration`, `PomodoroStatsSummary`
- Behavior mapping:


| Timer event                                                  | Composable call                                                                                                  |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| First Start while `phase === work` and no `currentSessionId` | `startSession(focusedTask?.id ?? null)`                                                                          |
| Pause while Focus session active                             | `pauseSession()`                                                                                                 |
| Resume while Focus session active                            | `resumeSession()`                                                                                                |
| Focus timer hits 0 (`onPhaseComplete` work branch)           | `await completeSession()` then `fetchStats(focusedTask?.id ?? null)`                                             |
| Reset / manual leave Focus while session active              | `abandonSession()`                                                                                               |
| `onBeforeUnmount` / `pagehide`                               | best-effort `abandonSession()` only if session still active **and** Focus phase was in progress (session id set) |


- Remove reliance on local `completedPomodoros` for display — show `stats.completedToday` instead (keep local counter only if still needed for long-break cadence; long-break cadence may keep a **local** completed-count for the current browser session, separate from DB stats)

**Important:** Long-break every 4 pomodoros must keep working offline. Keep a local `completedPomodoros` ref for cadence only; UI “Completed pomodoros” label becomes today’s RPC count.

- [ ] **Step 1: Add** `PomodoroStatsSummary.vue`

```vue
<script setup lang="ts">
import { formatFocusDuration } from '~/utils/formatFocusDuration'
import type { PomodoroStats } from '~/types/pomodoro.types'

const props = defineProps<{
  stats: PomodoroStats
  focusedTaskTitle?: string | null
  compact?: boolean
}>()

const todayLine = computed(
  () =>
    `${props.stats.completedToday} pomodoros · ${formatFocusDuration(props.stats.secondsToday)}`,
)

const weekLine = computed(
  () =>
    `${props.stats.completedWeek} pomodoros · ${formatFocusDuration(props.stats.secondsWeek)}`,
)

const taskLine = computed(() => {
  if (!props.focusedTaskTitle) return null
  return `${props.focusedTaskTitle}: ${props.stats.completedForTask} · ${formatFocusDuration(props.stats.secondsForTask)} (week)`
})
</script>

<template>
  <div
    class="space-y-1 text-sm"
    :class="compact ? 'text-center text-muted' : 'text-muted'"
  >
    <p>
      <span class="font-medium text-highlighted">Today:</span>
      {{ todayLine }}
    </p>
    <p>
      <span class="font-medium text-highlighted">This week:</span>
      {{ weekLine }}
    </p>
    <p v-if="taskLine">
      <span class="font-medium text-highlighted">Focused task:</span>
      {{ taskLine }}
    </p>
  </div>
</template>
```

- [ ] **Step 2: Wire lifecycle in** `PomidoroTimer.vue`

In `<script setup>`, after existing imports/setup:

1. Import summary: `import PomodoroStatsSummary from '~/components/dashboard/PomodoroStatsSummary.vue'`
2. Destructure sessions:

```ts
const {
  currentSessionId,
  stats,
  startSession,
  pauseSession,
  resumeSession,
  completeSession,
  abandonSession,
  fetchStats,
} = usePomodoroSessions()
```

1. On mount, also `fetchStats(focusedTask.value?.id ?? null)` (in addition to `getTasks()`).
2. Watch `focusedTask` id for stats refresh when focus changes (does not rewrite an open session’s `task_id`):

```ts
watch(
  () => focusedTask.value?.id ?? null,
  (taskId) => {
    fetchStats(taskId)
  },
)
```

1. Change `toggleRunning` so that when entering running on Focus with no session → `void startSession(focusedTask.value?.id ?? null)`; when pausing with a session → `void pauseSession()`; when resuming with a session → `void resumeSession()`. Do not start a DB session for break phases.
2. In `onPhaseComplete`, when finishing Focus: `await completeSession(); await fetchStats(focusedTask.value?.id ?? null)` before advancing phase (keep local `completedPomodoros++` for long-break cadence).
3. In `resetSession` and in the phase `watch` when leaving Focus with an active session (and not `suppressPhaseWatch` from auto-cycle after complete — complete already cleared session id): `void abandonSession()`.
4. `onBeforeUnmount` + `window` `pagehide` listener: if `currentSessionId` set → `void abandonSession()`.
5. Replace the template counter block with:

```vue
<p class="text-center text-sm text-muted">
  Today:
  <span class="font-medium text-highlighted">{{ stats.completedToday }}</span>
  pomodoros
  <span class="text-muted"> · {{ /* week muted */ }}</span>
</p>
<PomodoroStatsSummary
  class="mt-2"
  :stats="stats"
  :focused-task-title="focusedTask?.title ?? null"
  compact
/>
```

Avoid duplicating the same numbers twice — prefer a single compact summary (today + muted week + task line) instead of both a separate “Today: N” line and the full summary. Final UI: one `PomodoroStatsSummary` under the controls is enough.

- [ ] **Step 3: Manual verify timer lifecycle**

```bash
pnpm dev
```

Open `/dashboard/pomidoro` (signed in). Optionally shorten `WORK_SEC` temporarily to `10` for faster checks, then revert before commit.

Check:

1. Start Focus → row `running` in Supabase.
2. Pause → `paused`, `actual_seconds` > 0.
3. Resume → `running`.
4. Let Focus finish → `completed`, `was_completed=true`; today count increments.
5. Reset mid-Focus → `abandoned`, `was_completed=false`; today count unchanged.
6. Start with a focused task → `task_id` set; clear focus mid-run → `task_id` unchanged on that row.
7. Break Start does not create a new session row.

Expected: all checks pass.

- [ ] **Step 4: Commit**

```bash
git add \
  app/components/dashboard/PomodoroStatsSummary.vue \
  app/components/dashboard/PomidoroTimer.vue
git commit -m "$(cat <<'EOF'
Persist Pomodoro focus sessions and show stats under the timer.

EOF
)"
```

---



### Task 5: Dashboard home stats summary

**Files:**

- Modify: `app/pages/dashboard/index.vue`

**Interfaces:**

- Consumes: `usePomodoroSessions().fetchStats/stats`, `useTasks().focusedTask/getTasks`, `PomodoroStatsSummary`

- [ ] **Step 1: Update dashboard home**

```vue
<script setup lang="ts">
import PomodoroStatsSummary from '~/components/dashboard/PomodoroStatsSummary.vue'

definePageMeta({ layout: 'dashboard' })

const currentUserStore = useCurrentUserStore()
const { focusedTask, getTasks } = useTasks()
const { stats, fetchStats, isStatsLoading, statsError } = usePomodoroSessions()

const displayName = computed(() => {
  const meta = currentUserStore.user?.user_metadata as
    | { full_name?: string }
    | undefined
  const fromMeta = meta?.full_name?.trim()
  if (fromMeta) return fromMeta
  const email = currentUserStore.user?.email
  if (email) return email.split('@')[0] ?? email
  return 'there'
})

onMounted(async () => {
  await getTasks()
  await fetchStats(focusedTask.value?.id ?? null)
})

watch(
  () => focusedTask.value?.id ?? null,
  (taskId) => {
    fetchStats(taskId)
  },
)
</script>

<template>
  <div class="p-6 md:p-10 max-w-3xl space-y-4">
    <UCard>
      <template #header>
        <div class="space-y-1">
          <h1 class="text-2xl font-semibold text-highlighted">
            Welcome back, {{ displayName }}
          </h1>
          <p class="text-sm text-muted">
            Pick a section from the sidebar to get started.
          </p>
        </div>
      </template>

      <p class="text-muted">
        Plan your
        <NuxtLink
          to="/dashboard/tasks"
          class="font-medium text-primary hover:underline"
        >
          Tasks
        </NuxtLink>
        and then start
        <NuxtLink
          to="/dashboard/pomidoro"
          class="font-medium text-primary hover:underline"
        >
          Pomidoro
        </NuxtLink>
        for a focused work session.
      </p>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold text-highlighted">Focus stats</h2>
      </template>
      <p v-if="isStatsLoading" class="text-sm text-muted">Loading stats…</p>
      <p v-else-if="statsError" class="text-sm text-muted">
        Couldn’t load stats.
      </p>
      <PomodoroStatsSummary
        v-else
        :stats="stats"
        :focused-task-title="focusedTask?.title ?? null"
      />
    </UCard>
  </div>
</template>
```

- [ ] **Step 2: Manual verify dashboard**

With at least one completed Focus session from Task 4:

1. Open `/dashboard` → Focus stats card shows today + week totals.
2. Set a focused task on Tasks, return home → focused-task week line appears.
3. Clear focus → task line disappears; today/week remain.

Expected: all three pass.

- [ ] **Step 3: Lint touched UI files**

```bash
pnpm exec eslint \
  app/pages/dashboard/index.vue \
  app/components/dashboard/PomidoroTimer.vue \
  app/components/dashboard/PomodoroStatsSummary.vue \
  app/composables/usePomodoroSessions.ts \
  app/types/pomodoro.types.ts \
  app/utils/formatFocusDuration.ts
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add app/pages/dashboard/index.vue
git commit -m "$(cat <<'EOF'
Show pomodoro focus stats on the dashboard home.

EOF
)"
```

---



## Spec coverage (self-review)


| Spec requirement                                      | Task                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| Focus-only rows / lifecycle writes                    | Task 1 + Task 3 + Task 4                                     |
| `task_id` frozen at Start                             | Task 3 `startSession` + Task 4 (no mid-session task updates) |
| Enum status + JWT user_id + RLS + indexes + SET NULL  | Task 1                                                       |
| Stale 3h abandon                                      | Task 1 (`pomodoro_stats` cleanup)                            |
| `pomodoro_stats` RPC fields + UTC week/day            | Task 1                                                       |
| `was_completed`-only aggregates                       | Task 1 SQL filters                                           |
| `pomodoro.types.ts` + composable                      | Task 2 + Task 3                                              |
| Timer wiring + best-effort abandon                    | Task 4                                                       |
| Dashboard summary + Pomodoro light stats              | Task 4 + Task 5                                              |
| Write failures don’t stop timer                       | Task 3 (log only) + Task 4 (`void` calls)                    |
| Manual / SQL smoke tests                              | Task 1 Step 4, Task 4 Step 3, Task 5 Step 2                  |
| Out of scope (breaks, heartbeats, resume, history UI) | Not planned                                                  |


**Placeholder scan:** none intentional.  
**Type consistency:** `PomodoroStats` camelCase in app; snake_case only at DB/RPC boundary via `mapStatsRow`.