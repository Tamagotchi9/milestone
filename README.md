# Milestone

A Nuxt 4 productivity dashboard with Supabase auth/data and a Pomidoro timer flow.

## What this project includes

- Dashboard layout with authenticated user context
- Pomidoro timer page (`/dashboard/pomidoro`) with work/break cycles
- Supabase integration for auth and app data
- Nuxt UI + TailwindCSS for the interface
- Pinia for client-side state

## Tech stack

- Nuxt 4
- Vue 3 + TypeScript
- `@nuxt/ui`
- `@nuxtjs/supabase` + `@supabase/supabase-js`
- Pinia
- TailwindCSS
- ESLint + Prettier

## Getting started

This project uses [pnpm](https://pnpm.io/) as its package manager.

### Install pnpm

**With Corepack** (recommended; included with Node.js 16.13+):

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

**With npm:**

```bash
npm install -g pnpm
```

**Standalone installer** (macOS/Linux):

```bash
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

See the [pnpm installation docs](https://pnpm.io/installation) for other platforms and options.

### Setup and run

Install dependencies:

```bash
pnpm install
```

Run the development server:

```bash
pnpm dev
```

App runs on `http://localhost:3000`.

## Scripts

- `pnpm dev` - start development server
- `pnpm build` - build for production
- `pnpm preview` - preview production build locally
- `pnpm generate` - generate static output
- `pnpm lint` - run ESLint
- `pnpm lint:fix` - fix lint issues
- `pnpm format` - format with Prettier
- `pnpm format:check` - check formatting

## Project structure

- `app/pages/dashboard/index.vue` - dashboard landing page
- `app/pages/dashboard/pomidoro.vue` - Pomidoro route
- `app/components/dashboard/PomidoroTimer.vue` - timer UI and cycle logic
- `app/layouts/dashboard.vue` - dashboard layout shell

## Notes

- This repository currently uses the spelling **Pomidoro** in routes/components.
- If you plan to standardize to **Pomodoro**, update route/component names and links together.
