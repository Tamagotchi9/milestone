import { relations } from 'drizzle-orm/relations'
import {
  userInNeonAuth,
  tasks,
  pomodoroSessions,
  habits,
  habitCheckins,
} from './schema'

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  userInNeonAuth: one(userInNeonAuth, {
    fields: [tasks.userId],
    references: [userInNeonAuth.id],
  }),
  task: one(tasks, {
    fields: [tasks.userId],
    references: [tasks.id],
    relationName: 'tasks_userId_tasks_id',
  }),
  tasks: many(tasks, {
    relationName: 'tasks_userId_tasks_id',
  }),
  pomodoroSessions: many(pomodoroSessions),
}))

export const userInNeonAuthRelations = relations(
  userInNeonAuth,
  ({ many }) => ({
    tasks: many(tasks),
    pomodoroSessions: many(pomodoroSessions),
    habits: many(habits),
  }),
)

export const pomodoroSessionsRelations = relations(
  pomodoroSessions,
  ({ one }) => ({
    userInNeonAuth: one(userInNeonAuth, {
      fields: [pomodoroSessions.userId],
      references: [userInNeonAuth.id],
    }),
    task: one(tasks, {
      fields: [pomodoroSessions.userId],
      references: [tasks.id],
    }),
  }),
)

export const habitsRelations = relations(habits, ({ one, many }) => ({
  userInNeonAuth: one(userInNeonAuth, {
    fields: [habits.userId],
    references: [userInNeonAuth.id],
  }),
  habitCheckins: many(habitCheckins),
}))

export const habitCheckinsRelations = relations(habitCheckins, ({ one }) => ({
  habit: one(habits, {
    fields: [habitCheckins.habitId],
    references: [habits.id],
  }),
}))
