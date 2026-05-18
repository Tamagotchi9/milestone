import type {
  CreateTaskPayload,
  TaskItem,
  TaskPriority,
} from '~/types/tasks.types'
const STORAGE_KEY = 'milestone.tasks.v1'
const FOCUS_STORAGE_KEY = 'milestone.tasks.focus.v1'

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

const parseTasks = (value: string): TaskItem[] => {
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is TaskItem => {
      return (
        typeof item?.id === 'string' &&
        typeof item?.title === 'string' &&
        typeof item?.description === 'string' &&
        (item?.priority === 'low' ||
          item?.priority === 'medium' ||
          item?.priority === 'high') &&
        (typeof item?.deadline === 'string' || item?.deadline === null) &&
        typeof item?.createdAt === 'string' &&
        Array.isArray(item?.subtasks)
      )
    })
  } catch {
    return []
  }
}

export const useTasks = () => {
  const tasks = useState<TaskItem[]>('tasks.items', () => [])
  const focusedTaskId = useState<string | null>(
    'tasks.focusedTaskId',
    () => null,
  )
  const hasLoaded = useState<boolean>('tasks.loaded', () => false)
  const hasPersistence = useState<boolean>('tasks.persistence', () => false)

  if (import.meta.client && !hasLoaded.value) {
    const rawTasks = window.localStorage.getItem(STORAGE_KEY)
    if (rawTasks) {
      tasks.value = parseTasks(rawTasks)
    }

    const rawFocusedTaskId = window.localStorage.getItem(FOCUS_STORAGE_KEY)
    focusedTaskId.value =
      rawFocusedTaskId && rawFocusedTaskId.length > 0 ? rawFocusedTaskId : null
    hasLoaded.value = true
  }

  if (import.meta.client && !hasPersistence.value) {
    watch(
      tasks,
      () => {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks.value))
      },
      { deep: true },
    )

    watch(focusedTaskId, () => {
      if (focusedTaskId.value) {
        window.localStorage.setItem(FOCUS_STORAGE_KEY, focusedTaskId.value)
      } else {
        window.localStorage.removeItem(FOCUS_STORAGE_KEY)
      }
    })

    hasPersistence.value = true
  }

  const focusedTask = computed(() => {
    if (!focusedTaskId.value) return null
    return tasks.value.find((task) => task.id === focusedTaskId.value) ?? null
  })

  const addTask = async (payload: CreateTaskPayload) => {
    const title = payload.title.trim()
    if (!title) return null

    const task: TaskItem = {
      id: createId(),
      title,
      description: payload.description?.trim() ?? '',
      priority: payload.priority,
      deadline: normalizeDeadline(payload.deadline),
      createdAt: new Date().toISOString(),
      subtasks: [],
    }

    tasks.value.unshift(task)
    return task.id
    // Етап створення задачі в базі даних
    // const userId = user.value?.sub
    // if (!userId) {
    //   console.error('addTask: no authenticated user')
    //   return
    // }

    // const { data, error } = await supabase.from('tasks').insert({
    //   user_id: userId,
    //   title: payload.title,
    //   description: payload.description ?? null,
    //   priority: payload.priority,
    //   deadline: payload.deadline ?? null,
    // })
    // console.log(data, error)
  }

  const removeTask = (taskId: string) => {
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
    focusedTaskId,
    focusedTask,
    addTask,
    removeTask,
    setTaskPriority,
    setTaskDeadline,
    addSubtask,
    toggleSubtask,
    setFocusedTask,
  }
}
