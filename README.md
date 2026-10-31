# Milestone

A productivity dashboard for tasks, habits and focus sessions. This branch rewrites the Nuxt + Supabase app (still on `develop`) in Next.js + Neon. The plan and open stages are tracked outside the repo; features are not ported yet.

## Tech stack

- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS 4, shadcn/ui (Radix)
- Neon Postgres (`pg`), Drizzle ORM
- Neon Auth (Managed Better Auth, `@neon/auth`)
- Vitest, React Testing Library
- ESLint, Prettier

## Getting started

```bash
pnpm install
cp .env.example .env
pnpm dev
```

App runs on `http://localhost:3000`. `neon deploy` pulls the Neon variables into `.env`; generate `NEON_AUTH_COOKIE_SECRET` yourself with `openssl rand -base64 32`. `pnpm db:pull` generates `drizzle/schema.ts` from the database in `DATABASE_URL_UNPOOLED`.

## Scripts

- `pnpm dev` - start development server
- `pnpm build` - build for production
- `pnpm start` - run the production build
- `pnpm test` - run unit tests
- `pnpm lint` - run ESLint
- `pnpm typecheck` - run the TypeScript compiler
- `pnpm format` - format with Prettier
- `pnpm db:pull` - generate the Drizzle schema from the database

## Database

`supabase/migrations` and `supabase/tests` hold the source SQL and pgTAP tests to adapt for Neon.
