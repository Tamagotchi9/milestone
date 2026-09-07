---
name: coding-standards
description: >-
  Apply this project's Vue and TypeScript conventions when writing or
  refactoring Vue/TS files: prefer arrow functions, extract meaningful
  constants, explicitly import local Vue components, and organize shared
  feature types in app/types/{feature}.ts.
---

# Coding Standards

## Functions and constants

- Prefer `const fn = () => { ... }` or `const fn = async () => { ... }` for TypeScript helpers, handlers, and composable logic in Vue `<script setup>`.
- Keep `function` when hoisting is required to call a function above its definition, or when a function relies on dynamic `this`.
- Define dependencies above their callers when using `const` functions.
- Extract only repeated or semantic literals to named constants at module scope or the narrowest shared scope.
- Replace numbers that carry behavior meaning, such as timer intervals, with named constants.
- Keep simple one-off UI strings, such as `'Start'`, `'Reset'`, headings, and labels, inline.
- Top-level `const` values in `<script setup>` are available in the template; use them for labels and icons shared between script and template.

## Component imports

- Prefer explicit default imports for local Vue SFC components in pages, layouts, and other `<script setup>` usage.
- Avoid framework component auto-imports for app-local components unless the user specifically requests them.
- Keep import paths stable and readable, for example:
  `import DashboardPomidoroTimer from '~/components/dashboard/PomidoroTimer.vue'`.
- Ensure components referenced in a template have matching imports unless intentionally provided globally by a plugin or library.

## Feature types

- Put shared feature types and interfaces in `app/types/{feature}.ts` so components and composables stay focused on UI and logic.
- Do not define feature-level model types inside `app/composables`, `app/components`, or `app/pages`; local one-off inline types may stay there.
- Import types with `import type { ... } from '~/types/{feature}'`.
- Move types exported by composables into `app/types/{feature}.ts` and update imports at all usages.
- Keep naming consistent, such as `TaskItem`, `TaskSubtask`, and `TaskPriority`, and avoid duplicate type declarations.
- Both `type` and `interface` are allowed; do not convert between them solely for style.

When relocating feature types, create or update the feature type file, move the definitions, replace imports with `import type`, update all references using project-wide search, and run lint checks for changed files.
