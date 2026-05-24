import type { Database } from '~/types/database.types'
import type {
  CreateTaskPayload,
  TaskItem,
  TaskPriority,
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

const createId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const normalizeDeadline = (deadline?: string | null): string | null => {
  if (!deadline) return null
  return deadline
}

const mapTaskRowToItem = (row: TaskRow, subtaskRows: TaskRow[]): TaskItem => ({
  id: row.id,
  title: row.title,
  description: row.description ?? '',
  priority: row.priority,
  deadline: row.deadline,
  createdAt: row.created_at ?? new Date().toISOString(),
  subtasks: subtaskRows.map((subtask) => ({
    id: subtask.id,
    title: subtask.title,
    completed: subtask.status === 'completed',
  })),
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

  const addTask = async (payload: CreateTaskPayload) => {
    const title = payload.title.trim()
    if (!title) return null

    const { error } = await supabase.from('tasks').insert({
      title,
      description: payload.description?.trim() ?? null,
      priority: payload.priority,
      deadline: normalizeDeadline(payload.deadline),
    })

    if (error) {
      console.error('addTask:', error.message)
      return null
    }

    await getTasks()
    return tasks.value[0]?.id ?? null
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

  const setTaskPriority = (taskId: string, priority: TaskPriority) => {
    const task = tasks.value.find((item) => item.id === taskId)
    if (!task) return
    task.priority = priority
  }

  const setTaskDeadline = (taskId: string, deadline: string | null) => {
    const task = tasks.value.find((item) => item.id === taskId)
    if (!task) return
    task.deadline = normalizeDeadline(deadline)
  }

  const addSubtask = (taskId: string, title: string) => {
    const task = tasks.value.find((item) => item.id === taskId)
    if (!task) return
    const normalizedTitle = title.trim()
    if (!normalizedTitle) return
    task.subtasks.push({
      id: createId(),
      title: normalizedTitle,
      completed: false,
    })
  }

  const toggleSubtask = (taskId: string, subtaskId: string) => {
    const task = tasks.value.find((item) => item.id === taskId)
    if (!task) return
    const subtask = task.subtasks.find((item) => item.id === subtaskId)
    if (!subtask) return
    subtask.completed = !subtask.completed
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
    setTaskPriority,
    setTaskDeadline,
    addSubtask,
    toggleSubtask,
    setFocusedTask,
  }
}
