import type { Database } from '~/types/database.types'
import type { CreateTaskDTO, TaskItem, TaskPriority } from '~/types/tasks.types'
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

const mapTaskRowToItem = (row: TaskRow, subtaskRows: TaskRow[]): TaskItem => ({
  id: row.id,
  title: row.title,
  description: row.description ?? '',
  priority: row.priority,
  deadline: row.deadline,
  createdAt: row.created_at ?? new Date().toISOString(),
  status: row.status,
  subtasks: subtaskRows.map((subtask) => ({
    id: subtask.id,
    title: subtask.title,
    status: subtask.status,
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

    const { error } = await supabase.from('tasks').insert(values)

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

  const toggleSubtask = async (subtaskId: string) => {
    const { error } = await supabase
      .from('tasks')
      .update({
        status: 'completed',
      })
      .eq('id', subtaskId)

    if (error) {
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
    setTaskPriority,
    setTaskDeadline,
    toggleSubtask,
    setFocusedTask,
  }
}
