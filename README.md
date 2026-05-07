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

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

App runs on `http://localhost:3000`.

## Scripts

- `npm run dev` - start development server
- `npm run build` - build for production
- `npm run preview` - preview production build locally
- `npm run generate` - generate static output
- `npm run lint` - run ESLint
- `npm run lint:fix` - fix lint issues
- `npm run format` - format with Prettier
- `npm run format:check` - check formatting

## Project structure

- `app/pages/dashboard/index.vue` - dashboard landing page
- `app/pages/dashboard/pomidoro.vue` - Pomidoro route
- `app/components/dashboard/PomidoroTimer.vue` - timer UI and cycle logic
- `app/layouts/dashboard.vue` - dashboard layout shell

## Notes

- This repository currently uses the spelling **Pomidoro** in routes/components.
- If you plan to standardize to **Pomodoro**, update route/component names and links together.
