# Pomodoro browser tab title

## Goal

While a Pomodoro session is running, mirror the countdown and phase in the browser tab title so the user can see progress when the tab is in the background.

## Behavior

- **Running:** set `document` title to `{timeLabel} · {phaseLabel}` each second as the timer ticks.
  - Examples: `24:59 · Focus`, `04:12 · Short break`, `14:01 · Long break`
- **Not running** (paused, idle after reset, or before first start): do not override the title; keep the app default / page title.
- **Unmount / leave Pomodoro page:** clear the override so the default title returns.
- Phase labels must match the existing UTabs labels: `Focus`, `Short break`, `Long break`.
- Do not include the focused task name.
- Do not change favicon or add other tab chrome.

## Implementation

Change only `app/components/dashboard/PomidoroTimer.vue`:

1. Derive the phase label from the existing `tabItems` (or an equivalent map keyed by `phase`).
2. Compute a running title string from existing `timeLabel` and that label.
3. Sync via Nuxt `useHead` with a reactive `title`:
   - when `isRunning` is true → running title
   - when `isRunning` is false → stop overriding (`undefined` / clear) so the default title applies

No new composables, no page-level `useHead`, no lifting of timer state.

## Out of scope

- Showing the title while paused
- Keeping the title after navigating away
- Favicon / badge animations
- Desktop notifications changes (already exist separately)
- Focused-task name in the title

## Testing

Manual checks:

1. Start a Focus session → tab shows `MM:SS · Focus` and counts down.
2. Pause → default app/page title returns.
3. Resume → timer title returns.
4. Switch to Short / Long break and start → label matches that phase.
5. Reset while running → default title returns.
6. Navigate away from Pomodoro while running → default title for the new route (component unmount clears override).
