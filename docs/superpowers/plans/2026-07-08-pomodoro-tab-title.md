# Pomodoro Tab Title Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While the Pomodoro timer is running, show `{MM:SS} · {phase label}` in the browser tab title; restore the default title when paused, reset, or unmounted.

**Architecture:** Keep all logic inside `PomidoroTimer.vue`. Add a computed running title from existing `timeLabel` + `tabItems` phase labels, then sync it with Nuxt `useHead` only when `isRunning` is true. No new files or composables.

**Tech Stack:** Nuxt 4 (`useHead`), Vue 3 `<script setup>`, existing Pomodoro component state.

**Spec:** `docs/superpowers/specs/2026-07-08-pomodoro-tab-title-design.md`

**Note on tests:** This repo has no unit-test runner. Verification is manual in the browser per the steps below (matches the spec’s Testing section).

---

## File map

| File | Responsibility |
|------|----------------|
| `app/components/dashboard/PomidoroTimer.vue` | Only file to modify: compute tab title + `useHead` while running |
| `docs/superpowers/specs/2026-07-08-pomodoro-tab-title-design.md` | Behavior source of truth (read-only during implementation) |

---

### Task 1: Sync browser tab title while Pomodoro is running

**Files:**
- Modify: `app/components/dashboard/PomidoroTimer.vue` (after `timeLabel` computed, before `clearTick`)

- [ ] **Step 1: Add phase-label lookup and running tab title**

In `app/components/dashboard/PomidoroTimer.vue`, immediately after the existing `timeLabel` computed, add:

```ts
const phaseLabel = computed(
  () => tabItems.find((item) => item.value === phase.value)?.label ?? 'Focus',
)

const runningTabTitle = computed(
  () => `${timeLabel.value} · ${phaseLabel.value}`,
)

useHead(() => ({
  title: isRunning.value ? runningTabTitle.value : undefined,
}))
```

Keep arrow/`const` style consistent with the rest of the file. Do not add a new composable file. Do not change timer tick / pause / reset logic — they already flip `isRunning`, which drives the title.

- [ ] **Step 2: Manual verify in the browser**

Run: `npm run dev`  
Open `/dashboard/pomidoro` (or the app’s Pomodoro route).

Check:

1. Start Focus → tab title is `MM:SS · Focus` and counts down each second.
2. Pause → default app/page title returns (not the timer string).
3. Resume → timer title returns.
4. Switch to Short break / Long break, start → title uses `Short break` / `Long break`.
5. Reset while running → default title returns.
6. Start timer, navigate to another dashboard page → new route’s default title (override cleared on unmount).

Expected: all six checks pass.

- [ ] **Step 3: Commit**

```bash
git add app/components/dashboard/PomidoroTimer.vue
git commit -m "$(cat <<'EOF'
Show running Pomodoro time and phase in the browser tab title.

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Title `MM:SS · phase` while running | Task 1 Step 1 |
| Labels Focus / Short break / Long break | Task 1 (`tabItems`) |
| No override when not running | Task 1 (`isRunning` gate) |
| Clear on leave page | Task 1 (`useHead` lifecycle + unmount) |
| No task name / favicon / new composables | Task 1 (YAGNI) |
| Manual test checklist | Task 1 Step 2 |
