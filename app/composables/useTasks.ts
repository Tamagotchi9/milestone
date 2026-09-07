import type { Database } from '~/types/database.types'
import {
  TASK_STATUS,
  type CreateTaskDTO,
  type TaskItem,
} from '~/types/tasks.types'
const FOCUS_STORAGE_KEY = 'milestone.tasks.focus.v1'

const TASK_SELECT =
  'id, title, description, priority, deadline, created_at, parent_task_id, status' as const

type TaskRow = Pick<
  Database['public']['Tables']['tasks']['Row'],
  | 'id'
  | 'title'
  | 'description'
  | 'priority'
  | 'deadline'
  | 'created_at'
  | 'parent_task_id'
  | 'status'
>

const normalizeDeadline = (deadline?: string | null): string | null => {
  if (!deadline) return null
  return deadline
}

const mapTaskRowToSubtask = (row: TaskRow) => ({
  id: row.id,
  title: row.title,
  status: row.status,
})

const mapTaskRowToItem = (row: TaskRow, subtaskRows: TaskRow[]): TaskItem => ({
  id: row.id,
  title: row.title,
  description: row.description ?? '',
  priority: row.priority,
  deadline: row.deadline,
  createdAt: row.created_at ?? new Date().toISOString(),
  status: row.status,
  subtasks: subtaskRows.map(mapTaskRowToSubtask),
})

const rowsToTaskItems = (rows: TaskRow[]): TaskItem[] => {
  const childrenByParent = new Map<string, TaskRow[]>()

  for (const row of rows) {
    if (!row.parent_task_id) continue
    const siblings = childrenByParent.get(row.parent_task_id) ?? []
    siblings.push(row)
    childrenByParent.set(row.parent_task_id, siblings)
  }

  return rows
    .filter((row) => !row.parent_task_id)
    .map((row) => mapTaskRowToItem(row, childrenByParent.get(row.id) ?? []))
}

export const useTasks = () => {
  const supabase = useSupabaseClient<Database>()
  const tasks = useState<TaskItem[]>('tasks.items', () => [])
  const focusedTaskId = useState<string | null>(
    'tasks.focusedTaskId',
    () => null,
  )
  const isLoading = useState<boolean>('tasks.loading', () => false)
  const hasFocusPersistence = useState<boolean>(
    'tasks.focusPersistence',
    () => false,
  )

  if (import.meta.client && !hasFocusPersistence.value) {
    const rawFocusedTaskId = window.localStorage.getItem(FOCUS_STORAGE_KEY)
    focusedTaskId.value =
      rawFocusedTaskId && rawFocusedTaskId.length > 0 ? rawFocusedTaskId : null

    watch(focusedTaskId, () => {
      if (focusedTaskId.value) {
        window.localStorage.setItem(FOCUS_STORAGE_KEY, focusedTaskId.value)
      } else {
        window.localStorage.removeItem(FOCUS_STORAGE_KEY)
      }
    })

    hasFocusPersistence.value = true
  }

  const focusedTask = computed(() => {
    if (!focusedTaskId.value) return null
    return tasks.value.find((task) => task.id === focusedTaskId.value) ?? null
  })

  const getTasks = async () => {
    isLoading.value = true

    const { data, error } = await supabase
      .from('tasks')
      .select(TASK_SELECT)
      .order('created_at', { ascending: false })

    isLoading.value = false
    if (error) {
      console.error('getTasks:', error.message)
      return
    }

    tasks.value = rowsToTaskItems(data ?? [])
  }

  const addTask = async (payload: CreateTaskDTO) => {
    const title = payload.title.trim()
    if (!title) return null

    const values: Database['public']['Tables']['tasks']['Insert'] = {
      title,
      description: payload.description?.trim() ?? null,
      priority: payload.priority,
      deadline: normalizeDeadline(payload.deadline),
    }

    if (payload.parentTaskId) {
      values['parent_task_id'] = payload.parentTaskId
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert(values)
      .select(TASK_SELECT)
      .single()

    if (error) {
      console.error('addTask:', error.message)
      return null
    }

    if (data.parent_task_id) {
      tasks.value = tasks.value.map((task) =>
        task.id === data.parent_task_id
          ? {
              ...task,
              subtasks: [...task.subtasks, mapTaskRowToSubtask(data)],
            }
          : task,
      )
    } else {
      tasks.value = [
        mapTaskRowToItem(data, []),
        ...tasks.value.filter((task) => task.id !== data.id),
      ]
    }

    return data
  }

  const removeTask = async (taskId: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)

    if (error) {
      console.error('removeTask:', error.message)
      return
    }

    tasks.value = tasks.value.filter((task) => task.id !== taskId)
    if (focusedTaskId.value === taskId) {
      focusedTaskId.value = null
    }
  }

  const toggleSubtask = async (subtaskId: string) => {
    const subtask = tasks.value
      .flatMap((task) => task.subtasks)
      .find((item) => item.id === subtaskId)
    if (!subtask) return

    const previousStatus = subtask.status
    const nextStatus =
      previousStatus === TASK_STATUS.COMPLETED
        ? TASK_STATUS.CREATED
        : TASK_STATUS.COMPLETED
    subtask.status = nextStatus

    const { error } = await supabase
      .from('tasks')
      .update({
        status: nextStatus,
      })
      .eq('id', subtaskId)
      .select(TASK_SELECT)
      .single()

    if (error) {
      subtask.status = previousStatus
      // TODO: toast error
      console.error('toggleSubtask:', error.message)
      return
    }
  }

  const setFocusedTask = (taskId: string | null) => {
    focusedTaskId.value = taskId
  }

  return {
    tasks,
    isLoading,
    focusedTaskId,
    focusedTask,
    getTasks,
    addTask,
    removeTask,
    toggleSubtask,
    setFocusedTask,
  }
}
