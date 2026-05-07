---
name: vue-explicit-component-imports
description: >-
  Prefer explicit default imports for local Vue single-file components in
  pages, layouts, and other `<script setup>` usage instead of relying on
  framework auto-import component registration. Use when writing or refactoring
  Vue files, or when the user asks to avoid auto imports.
---

# Vue: explicit component imports

## Component imports

- Prefer explicit default imports for local Vue SFC components in `<script setup>`.
- Avoid implicit framework component auto-import behavior for app-local components unless the user specifically requests it.
- Keep import paths stable and readable, for example:
  `import DashboardPomidoroTimer from '~/components/dashboard/PomidoroTimer.vue'`.
- If a component is referenced in a template, ensure it has a matching import in `<script setup>` unless it is intentionally provided globally by a plugin/library.

## Scope

- This skill governs import style only.
- Function style and literal extraction rules belong in separate skills.
