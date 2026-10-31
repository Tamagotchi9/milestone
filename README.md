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

App runs on `http://localhost:3000`. `neon deploy` pulls the Neon variables into `.env`; generate `NEON_AUTH_COOKIE_SECRET` yourself with `openssl rand -base64 32`. See [Database](#database) for `DATABASE_AUTHENTICATED_URL`.

## Scripts

- `pnpm dev` - start development server
- `pnpm build` - build for production
- `pnpm start` - run the production build
- `pnpm test` - run unit tests
- `pnpm lint` - run ESLint
- `pnpm typecheck` - run the TypeScript compiler
- `pnpm format` - format with Prettier
- `pnpm db:migration <name>` - create an empty SQL migration
- `pnpm db:migrate` - apply migrations to `DATABASE_URL_UNPOOLED`
- `pnpm db:pull` - regenerate `src/db/schema.ts` and `relations.ts` from the database
- `pnpm db:test` - run the pgTAP tests in `drizzle/tests`

## Database

SQL migrations in `drizzle/` are the source of truth, because RLS policies, triggers and functions live there. `src/db/schema.ts` is generated from the database with `pnpm db:pull`: do not edit it by hand, and do not use `drizzle-kit generate` without `--custom`.

The app connects as `authenticated_backend`, which is subject to RLS. Policies read the user from `auth.uid()`, which returns the `sub` claim of `request.jwt.claims`, so queries must set that claim inside a transaction after verifying the Neon Auth JWT. Without it, queries see no rows.

Migrations create the role without login. After migrating a new project, enable it once and put the matching pooled URL into `DATABASE_AUTHENTICATED_URL`:

```sql
alter role authenticated_backend login password '<openssl rand -hex 32>';
```
