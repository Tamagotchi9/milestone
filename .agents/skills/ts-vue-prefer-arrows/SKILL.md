---
name: ts-vue-prefer-arrows
description: >-
  Prefer `const name = () => {}` arrow functions over the `function` keyword in
  TypeScript and Vue `<script setup>` when hoisting or `this` binding is not
  required. Extract only repeated or semantic literals to named `const` at
  module scope (or the narrowest shared scope), and keep simple one-off UI
  strings inline. Use when writing or refactoring Vue/TS files, or when the
  user asks for this style.
---

# TypeScript / Vue: arrows and constants

## Arrow functions

- Prefer **`const fn = () => { ... }`** (or `const fn = async () => { ... }`) instead of **`function fn() { ... }`** for plain helpers, handlers, and composable logic in `<script setup>`.
- **Keep `function`** when you need:
  - **Hoisting** (rare): the function must be called above its definition in the same block.
  - **`this`**: methods that rely on dynamic `this` (unusual in Composition API).
- Order declarations so dependencies resolve: define callees **above** callers when using `const` (no hoisting).

## Magic strings and values

- Extract **only repeated or semantic literals** (used in multiple places or carrying behavior meaning) to **`const SOME_NAME = '...'`**.
- Keep **simple one-off UI strings** inline in template/script (e.g. `'Start'`, `'Reset'`, short headings, labels).
- Replace **magic numbers** that carry behavior meaning (e.g. “every 4 pomodoros”, tick interval) with named constants.

## Vue `<script setup>`

- Top-level `const` values are **automatically** available in the template; use them for labels and icons referenced from both script and template.
- `type` / `interface` aliases are fine; this skill does not require changing them.

