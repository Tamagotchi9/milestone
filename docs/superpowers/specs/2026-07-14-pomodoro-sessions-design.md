# Pomodoro sessions persistence

## Goal

Persist Focus-phase pomodoro attempts in Supabase with a full lifecycle (`running` → `paused` / `completed` / `abandoned`), and surface compact stats on the dashboard home and Pomodoro page via a Postgres RPC.

## Decisions

| Topic | Choice |
|-------|--------|
| What a row is | One Focus (work) phase attempt |
| Breaks | Not stored |
| Write model | Full lifecycle (create on Start, update on pause/complete/abandon) |
| Stats approach | Client writes + Postgres RPC (`pomodoro_stats`) |
| Task link | `task_id` frozen at Start (or null); mid-session focus changes do not rewrite the row |
| Abandon | Reset / leave Focus mid-timer → abandon; tab close / unmount → best-effort |
| Completed stats | Only rows with `was_completed = true` |
| Week definition | UTC Monday 00:00 → next Monday (v1; no local timezone) |
| UI | Dashboard home summary + light counts on Pomodoro |
| Cross-device resume / heartbeats | Out of scope |

## Data model

Existing table `public.pomodoro_sessions` (already reflected in `database.types.ts`). Migration tightens it:

| Column | Role |
|--------|------|
| `id` | UUID primary key |
| `user_id` | Owner; default + triggers from `auth.uid()` (same pattern as `tasks`) |
| `task_id` | Optional FK → `tasks.id`, frozen at Start; `ON DELETE SET NULL` |
| `duration_minutes` | Planned length (default 25) |
| `started_at` | When Start was pressed |
| `completed_at` | Set when status becomes `completed` or `abandoned` |
| `actual_seconds` | Wall-clock focus time excluding pause intervals |
| `status` | Enum `pomodoro_session_status`: `running` \| `paused` \| `completed` \| `abandoned` |
| `was_completed` | `true` only when the Focus timer reaches zero |

### Schema work

- Create `pomodoro_session_status` enum; alter `status` to use it (replace free `text` if present).
- Default `user_id` from JWT; before-insert trigger sets `user_id`; before-update prevents changing `user_id`.
- RLS: authenticated user may only select/insert/update/delete own rows (`auth.uid() = user_id`).
- Indexes: `(user_id, started_at desc)`; partial `(user_id, task_id)` where `task_id is not null`.
- Ensure `task_id` FK uses `ON DELETE SET NULL`.
- Stale cleanup: on next stats/session load (or a small SQL helper), sessions still `running`/`paused` with `started_at` older than 3 hours become `abandoned` with `was_completed = false` and `completed_at = now()`.

### Out of schema for v1

- `session_type` / break rows
- Heartbeat columns
- Soft-delete / user-editable history

## Write path (client)

`PomidoroTimer` drives lifecycle through `usePomodoroSessions`. Phase UI (tabs, ticks, notifications, tab title) stays local.

| Event | DB action |
|-------|-----------|
| Start Focus | `INSERT` `status=running`, `task_id` from current focused task or null, `duration_minutes=25`, `started_at` |
| Pause | `UPDATE` `status=paused`, refresh `actual_seconds` |
| Resume | `UPDATE` `status=running` |
| Timer hits 0 on Focus | `UPDATE` `status=completed`, `was_completed=true`, `completed_at`, final `actual_seconds` |
| Reset / switch away from Focus mid-session | `UPDATE` `status=abandoned`, `was_completed=false`, `completed_at`, `actual_seconds` |
| Tab close / component unmount | Best-effort abandon or flush `actual_seconds` (may fail) |

### Timing rules

- Accumulate `actual_seconds` only while status is conceptually running (wall clock between resume and pause/complete).
- Do not trust `setInterval` alone for elapsed time across background tabs.
- Hold the current session `id` in composable state; ignore Start if a non-terminal session is already active in that state.
- Failed writes: log / toast; timer continues locally so focus is not blocked by network.

## Stats RPC

Security-invoker (or equivalent RLS-safe) function, e.g. `public.pomodoro_stats(p_task_id uuid default null)`, scoped to `auth.uid()`.

Returns at least:

| Field | Meaning |
|-------|---------|
| `completed_today` | Count of `was_completed` rows with `started_at` in current UTC day |
| `seconds_today` | Sum of `actual_seconds` for those rows |
| `completed_week` | Count for current UTC week (Monday 00:00 UTC) |
| `seconds_week` | Sum for that week |
| `completed_for_task` | Count for `p_task_id` in the current UTC week (0 if null arg) |
| `seconds_for_task` | Sum for that task in the current UTC week (0 if null arg) |

Only `was_completed = true` rows contribute to these totals. Abandoned / running / paused do not.

Regenerate `app/types/database.types.ts` after the migration so the RPC is typed.

## App structure

Follow existing tasks patterns and the feature-types skill:

| Unit | Responsibility |
|------|----------------|
| `app/types/pomodoro.types.ts` | Session status union, stats DTO, any insert/update helpers types |
| `app/composables/usePomodoroSessions.ts` | `start` / `pause` / `resume` / `complete` / `abandon`, current session id, `fetchStats(taskId?)` → RPC |
| `PomidoroTimer.vue` | Wire lifecycle events; show light today (and optional week / focused-task) counts |
| Dashboard home | Compact summary card: today, week, and focused-task week line when a focused task exists |
| Small presentational component(s) | Optional shared stats display to avoid duplicating formatting |

## UI

### Dashboard home (`/dashboard`)

Under the existing welcome card content (or as a sibling card):

- Today: `N pomodoros · {formatted duration}`
- This week: same shape
- If `focusedTask` is set: one muted line for that task’s week totals
- Keep existing Tasks / Pomidoro links; no charts or history table

### Pomodoro page

- Replace local-only “Completed pomodoros” with **today’s** `completed_today` from the RPC
- Refresh stats after a successful `complete`
- Optional muted week total
- If focusing a task: small “on this task (week)” line
- Stay within existing Nuxt UI / dashboard look (`UCard`, muted text); stats stay secondary to the timer

## Error handling

- Write failures do not stop the local timer.
- Stats fetch failure: muted empty or error state; no crash.
- Occasional stale `running`/`paused` rows after hard tab kills are acceptable; stale cleanup + `was_completed`-only stats keep totals honest.

## Testing

Manual:

1. Start → pause → resume → complete Focus → row ends `completed` / `was_completed=true`; today count increments on Pomodoro and dashboard.
2. Reset mid-Focus → row `abandoned` / `was_completed=false`; completed counts unchanged.
3. Start with focused task → `task_id` set; clear focus mid-session → same `task_id` remains; per-task week line updates only on complete.
4. Start with no focus → `task_id` null; still counts in today/week.
5. SQL smoke: empty user → zeros; one completed row → today/week increment; `p_task_id` filter matches.

No new E2E framework required for v1.

## Out of scope

- Persisting short/long breaks
- Heartbeats and cross-device resume
- History list, editing/deleting sessions in UI
- Local-timezone week boundaries
- Streak UI, calendars, charts
- Changing Pomodoro durations / custom lengths (still fixed 25/5/15 in the timer)
