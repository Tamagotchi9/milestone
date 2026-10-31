import {
  pgTable,
  pgSchema,
  unique,
  uuid,
  text,
  boolean,
  timestamp,
  index,
  foreignKey,
  pgPolicy,
  date,
  check,
  integer,
  primaryKey,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const neonAuth = pgSchema('neon_auth')
export const pomodoroSessionStatus = pgEnum('pomodoro_session_status', [
  'running',
  'paused',
  'completed',
  'abandoned',
])
export const tasksPriority = pgEnum('tasks_priority', ['low', 'medium', 'high'])
export const tasksStatus = pgEnum('tasks_status', [
  'created',
  'in_progress',
  'completed',
  'on_hold',
  'blocked',
  'abandoned',
])

export const userInNeonAuth = neonAuth.table(
  'user',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    email: text().notNull(),
    emailVerified: boolean().notNull(),
    image: text(),
    createdAt: timestamp({ withTimezone: true, mode: 'string' })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: 'string' })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    role: text(),
    banned: boolean(),
    banReason: text(),
    banExpires: timestamp({ withTimezone: true, mode: 'string' }),
  },
  (table) => [unique('user_email_key').on(table.email)],
)

export const tasks = pgTable(
  'tasks',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id')
      .default(sql`auth.uid()`)
      .notNull(),
    parentTaskId: uuid('parent_task_id'),
    title: text().notNull(),
    description: text(),
    priority: tasksPriority().default('medium').notNull(),
    status: tasksStatus().default('created').notNull(),
    deadline: date(),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
    updatedAt: timestamp('updated_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
  },
  (table) => [
    index('tasks_parent_task_id_idx')
      .using('btree', table.parentTaskId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(parent_task_id IS NOT NULL)`),
    index('tasks_user_created_idx').using(
      'btree',
      table.userId.asc().nullsLast().op('uuid_ops'),
      table.createdAt.desc().nullsFirst().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [userInNeonAuth.id],
      name: 'tasks_user_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.userId, table.parentTaskId],
      foreignColumns: [table.id, table.userId],
      name: 'tasks_parent_task_id_fkey',
    }).onDelete('cascade'),
    unique('tasks_id_user_id_key').on(table.userId, table.id),
    pgPolicy('Users see own tasks', {
      as: 'permissive',
      for: 'all',
      to: ['authenticated'],
      using: sql`(( SELECT auth.uid() AS uid) = user_id)`,
      withCheck: sql`(( SELECT auth.uid() AS uid) = user_id)`,
    }),
  ],
)

export const pomodoroSessions = pgTable(
  'pomodoro_sessions',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id')
      .default(sql`auth.uid()`)
      .notNull(),
    taskId: uuid('task_id'),
    durationMinutes: integer('duration_minutes').default(25).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    completedAt: timestamp('completed_at', {
      withTimezone: true,
      mode: 'string',
    }),
    actualSeconds: integer('actual_seconds'),
    status: pomodoroSessionStatus().default('running').notNull(),
    wasCompleted: boolean('was_completed').default(false).notNull(),
  },
  (table) => [
    index('pomodoro_sessions_user_completed_at_idx')
      .using(
        'btree',
        table.userId.asc().nullsLast().op('timestamptz_ops'),
        table.completedAt.desc().nullsFirst().op('timestamptz_ops'),
      )
      .where(sql`(status = 'completed'::pomodoro_session_status)`),
    index('pomodoro_sessions_user_running_idx')
      .using('btree', table.userId.asc().nullsLast().op('uuid_ops'))
      .where(sql`(status = 'running'::pomodoro_session_status)`),
    index('pomodoro_sessions_user_started_at_idx').using(
      'btree',
      table.userId.asc().nullsLast().op('timestamptz_ops'),
      table.startedAt.desc().nullsFirst().op('timestamptz_ops'),
    ),
    index('pomodoro_sessions_user_task_id_idx')
      .using(
        'btree',
        table.userId.asc().nullsLast().op('uuid_ops'),
        table.taskId.asc().nullsLast().op('uuid_ops'),
      )
      .where(sql`(task_id IS NOT NULL)`),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [userInNeonAuth.id],
      name: 'pomodoro_sessions_user_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.userId, table.taskId],
      foreignColumns: [tasks.id, tasks.userId],
      name: 'pomodoro_sessions_task_id_fkey',
    }).onDelete('set null'),
    pgPolicy('Users manage own pomodoro sessions', {
      as: 'permissive',
      for: 'all',
      to: ['authenticated'],
      using: sql`(( SELECT auth.uid() AS uid) = user_id)`,
      withCheck: sql`(( SELECT auth.uid() AS uid) = user_id)`,
    }),
    check(
      'pomodoro_sessions_actual_seconds_check',
      sql`(actual_seconds IS NULL) OR (actual_seconds >= 0)`,
    ),
    check(
      'pomodoro_sessions_completion_consistency_check',
      sql`((status = ANY (ARRAY['completed'::pomodoro_session_status, 'abandoned'::pomodoro_session_status])) AND (completed_at IS NOT NULL)) OR ((status = ANY (ARRAY['running'::pomodoro_session_status, 'paused'::pomodoro_session_status])) AND (completed_at IS NULL))`,
    ),
    check(
      'pomodoro_sessions_legacy_completed_sync_check',
      sql`was_completed = (status = 'completed'::pomodoro_session_status)`,
    ),
  ],
)

export const habits = pgTable(
  'habits',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id')
      .default(sql`auth.uid()`)
      .notNull(),
    name: text().notNull(),
    startsOn: date('starts_on').notNull(),
    archivedOn: date('archived_on'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('habits_user_archived_created_idx').using(
      'btree',
      table.userId.asc().nullsLast().op('date_ops'),
      table.archivedOn.asc().nullsLast().op('date_ops'),
      table.createdAt.desc().nullsFirst().op('date_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [userInNeonAuth.id],
      name: 'habits_user_id_fkey',
    }).onDelete('cascade'),
    unique('habits_id_user_id_key').on(table.userId, table.id),
    pgPolicy('Users update own habits', {
      as: 'permissive',
      for: 'update',
      to: ['authenticated'],
      using: sql`(( SELECT auth.uid() AS uid) = user_id)`,
      withCheck: sql`(( SELECT auth.uid() AS uid) = user_id)`,
    }),
    pgPolicy('Users create own habits', {
      as: 'permissive',
      for: 'insert',
      to: ['authenticated'],
    }),
    pgPolicy('Users read own habits', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
    }),
    check(
      'habits_name_check',
      sql`(name = btrim(name)) AND ((char_length(name) >= 1) AND (char_length(name) <= 80))`,
    ),
    check(
      'habits_archive_date_check',
      sql`(archived_on IS NULL) OR (archived_on >= starts_on)`,
    ),
  ],
)

export const habitCheckins = pgTable(
  'habit_checkins',
  {
    habitId: uuid('habit_id').notNull(),
    userId: uuid('user_id')
      .default(sql`auth.uid()`)
      .notNull(),
    completedOn: date('completed_on').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('habit_checkins_user_completed_idx').using(
      'btree',
      table.userId.asc().nullsLast().op('date_ops'),
      table.completedOn.desc().nullsFirst().op('date_ops'),
    ),
    foreignKey({
      columns: [table.habitId, table.userId],
      foreignColumns: [habits.id, habits.userId],
      name: 'habit_checkins_habit_owner_fkey',
    }).onDelete('cascade'),
    primaryKey({
      columns: [table.habitId, table.completedOn],
      name: 'habit_checkins_pkey',
    }),
    pgPolicy('Users delete own habit check-ins', {
      as: 'permissive',
      for: 'delete',
      to: ['authenticated'],
      using: sql`((( SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1
   FROM habits h
  WHERE ((h.id = habit_checkins.habit_id) AND (h.user_id = habit_checkins.user_id) AND (h.archived_on IS NULL)))))`,
    }),
    pgPolicy('Users create valid habit check-ins', {
      as: 'permissive',
      for: 'insert',
      to: ['authenticated'],
    }),
    pgPolicy('Users read own habit check-ins', {
      as: 'permissive',
      for: 'select',
      to: ['authenticated'],
    }),
  ],
)
