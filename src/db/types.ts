import { tasks } from '@/db/schema'

export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert
