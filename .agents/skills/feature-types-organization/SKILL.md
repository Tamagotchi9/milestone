---
name: feature-types-organization
description: Keep feature types and interfaces in dedicated app/types/{feature} files and keep composables/components focused on logic and UI. Use when creating or refactoring TypeScript models, interfaces, or shared feature types.
---

# Feature Types Organization

## Goal

Keep type definitions centralized and predictable.

## Rules

1. Put shared feature types in `app/types/{feature}.ts`.
2. Do not define feature-level model types inside `app/composables`, `app/components`, or `app/pages` unless they are local one-off inline types.
3. Import types with `import type { ... } from '~/types/{feature}'`.
4. If a composable currently exports types, move those types into `app/types/{feature}.ts` and update imports at all usages.
5. Keep naming consistent (`TaskItem`, `TaskSubtask`, `TaskPriority`, etc.) and avoid duplicate type declarations across files.

## Refactor Checklist

- Create or update `app/types/{feature}.ts`.
- Move interfaces/types there.
- Replace local declarations with `import type`.
- Update all references using project-wide search.
- Run lints for changed files.
