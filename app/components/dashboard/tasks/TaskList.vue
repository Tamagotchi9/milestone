<script setup lang="ts">
import type {
  CreateTaskDTO,
  TaskItem,
  TaskPriority,
  TaskStatus,
} from '~/types/tasks.types'
import {
  TASK_BOARD_STATUSES,
  TASK_PRIORITY_RANK,
  TASK_STATUS,
  TASK_STATUS_LABEL,
} from '~/types/tasks.types'
import DashboardTask from '~/components/dashboard/tasks/Task.vue'

const props = defineProps<{
  tasks: TaskItem[]
  focusedTaskId: string | null
  loading?: boolean
  updatingStatusIds?: string[]
  updatingPriorityIds?: string[]
}>()

const emit = defineEmits<{
  focus: [taskId: string]
  remove: [taskId: string]
  addSubtask: [payload: CreateTaskDTO]
  toggleSubtask: [subtaskId: string]
  changeStatus: [taskId: string, status: TaskStatus]
  changePriority: [taskId: string, priority: TaskPriority]
}>()

const statusColors = {
  created: 'bg-muted',
  in_progress: 'bg-primary',
  on_hold: 'bg-warning',
  blocked: 'bg-error',
  abandoned: 'bg-dimmed',
} as const

const statuses = TASK_BOARD_STATUSES.map((value) => ({
  value,
  color: statusColors[value],
}))
const board = useTemplateRef<HTMLElement>('board')
const subtaskDrafts = reactive<Record<string, string>>({})
const draggedTaskId = ref<string | null>(null)
const targetStatus = ref<TaskStatus | null>(null)
const pointer = ref({ x: 0, y: 0 })
const announcement = ref('')
const showCompleted = ref(false)
let pointerId: number | null = null
let dragHandle: HTMLElement | null = null
let animationFrame = 0
let pendingFocus: { taskId: string; key: string } | null = null
const SCROLL_EDGE = 64
const SCROLL_STEP = 12

const sortTasks = (tasks: TaskItem[]) =>
  [...tasks].sort((a, b) => {
    const priorityDiff =
      TASK_PRIORITY_RANK[a.priority] - TASK_PRIORITY_RANK[b.priority]
    if (priorityDiff !== 0) return priorityDiff
    if (a.deadline && b.deadline && a.deadline !== b.deadline)
      return a.deadline.localeCompare(b.deadline)
    if (a.deadline && !b.deadline) return -1
    if (!a.deadline && b.deadline) return 1
    return b.createdAt.localeCompare(a.createdAt)
  })

const groups = computed(() =>
  statuses.map((status) => ({
    ...status,
    label: TASK_STATUS_LABEL[status.value],
    tasks: sortTasks(
      props.tasks.filter((task) => task.status === status.value),
    ),
  })),
)

const completedTasks = computed(() =>
  sortTasks(
    props.tasks.filter((task) => task.status === TASK_STATUS.COMPLETED),
  ),
)

const activeTaskCount = computed(
  () => props.tasks.length - completedTasks.value.length,
)

const rememberFocus = () => {
  if (!import.meta.client) return
  const activeElement = document.activeElement
  if (!(activeElement instanceof HTMLElement)) return
  const taskCard = activeElement.closest<HTMLElement>('[data-task-card-id]')
  const taskId = taskCard?.dataset.taskCardId
  const key = activeElement.dataset.taskFocus
  if (!taskId || !key || !board.value?.contains(taskCard)) return
  pendingFocus = { taskId, key }
}

const restoreFocus = () => {
  if (!pendingFocus) return
  const focusToRestore = pendingFocus
  pendingFocus = null
  const focusableElements =
    board.value?.querySelectorAll<HTMLElement>('[data-task-focus]')
  const target = Array.from(focusableElements ?? []).find(
    (element) =>
      element.dataset.taskFocus === focusToRestore.key &&
      element.closest<HTMLElement>('[data-task-card-id]')?.dataset
        .taskCardId === focusToRestore.taskId,
  )
  target?.focus()
}

const setSubtaskDraft = (taskId: string, draft: string) => {
  subtaskDrafts[taskId] = draft
}

const moveTask = (taskId: string, status: TaskStatus) => {
  const task = props.tasks.find((item) => item.id === taskId)
  if (
    !task ||
    task.status === status ||
    props.updatingStatusIds?.includes(taskId)
  )
    return
  rememberFocus()
  pendingFocus ??= { taskId, key: 'move-status' }
  emit('changeStatus', taskId, status)
  announcement.value = `Moving ${task.title} to ${TASK_STATUS_LABEL[status]}.`
}

const findTarget = () => {
  const element = document
    .elementFromPoint(pointer.value.x, pointer.value.y)
    ?.closest('[data-status]')
  const value = element?.getAttribute('data-status')
  targetStatus.value = board.value?.contains(element ?? null)
    ? (statuses.find((status) => status.value === value)?.value ?? null)
    : null
}

const scrollWhileDragging = () => {
  if (!draggedTaskId.value) return
  let container = board.value?.parentElement
  while (container) {
    if (
      /(auto|scroll)/.test(getComputedStyle(container).overflowY) &&
      container.scrollHeight > container.clientHeight
    )
      break
    container = container.parentElement
  }
  const scrollElement = container ?? document.scrollingElement
  const bounds = container?.getBoundingClientRect()
  const top = Math.max(bounds?.top ?? 0, 0)
  const bottom = Math.min(
    bounds?.bottom ?? window.innerHeight,
    window.innerHeight,
  )
  if (scrollElement) {
    const step =
      pointer.value.y < top + SCROLL_EDGE
        ? -SCROLL_STEP
        : pointer.value.y > bottom - SCROLL_EDGE
          ? SCROLL_STEP
          : 0
    if (step) scrollElement.scrollBy({ top: step, behavior: 'instant' })
  }
  findTarget()
  animationFrame = requestAnimationFrame(scrollWhileDragging)
}

const cancelDrag = () => {
  cancelAnimationFrame(animationFrame)
  const handle = dragHandle
  const id = pointerId
  draggedTaskId.value = null
  targetStatus.value = null
  pointerId = null
  dragHandle = null
  if (id !== null && handle?.hasPointerCapture(id))
    handle.releasePointerCapture(id)
}

const startDrag = (event: PointerEvent, taskId: string) => {
  if (
    event.button !== 0 ||
    draggedTaskId.value ||
    props.updatingStatusIds?.includes(taskId)
  )
    return
  dragHandle = event.currentTarget as HTMLElement
  pointerId = event.pointerId
  dragHandle.setPointerCapture(event.pointerId)
  draggedTaskId.value = taskId
  pointer.value = { x: event.clientX, y: event.clientY }
  scrollWhileDragging()
}

const moveDrag = (event: PointerEvent) => {
  if (event.pointerId !== pointerId) return
  pointer.value = { x: event.clientX, y: event.clientY }
  findTarget()
}

const finishDrag = (event: PointerEvent) => {
  if (event.pointerId !== pointerId) return
  pointer.value = { x: event.clientX, y: event.clientY }
  findTarget()
  const taskId = draggedTaskId.value
  const status = targetStatus.value
  cancelDrag()
  if (taskId && status) moveTask(taskId, status)
}

onBeforeUnmount(cancelDrag)
onBeforeUpdate(rememberFocus)
onUpdated(restoreFocus)

watch(
  () => props.tasks.map((task) => task.id),
  (taskIds) => {
    const currentTaskIds = new Set(taskIds)
    for (const taskId of Object.keys(subtaskDrafts)) {
      if (!currentTaskIds.has(taskId)) delete subtaskDrafts[taskId]
    }
  },
)
</script>

<template>
  <section
    class="space-y-4"
    aria-labelledby="task-list-heading"
    @keydown.esc="cancelDrag"
  >
    <div>
      <h2 id="task-list-heading" class="font-medium text-highlighted">
        Your tasks
      </h2>
      <p class="text-xs text-muted">
        {{ activeTaskCount }}
        {{ activeTaskCount === 1 ? 'task' : 'tasks' }} · Sorted by priority
      </p>
      <p id="task-move-help" class="mt-2 text-sm text-muted">
        Drag the grip to change status, or use the Move to menu.
      </p>
    </div>
    <p class="sr-only" role="status">{{ announcement }}</p>
    <UCard v-if="loading"
      ><p class="text-sm text-muted">Loading tasks…</p></UCard
    >
    <div v-else ref="board" class="space-y-4">
      <div class="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-5">
        <section
          v-for="group in groups"
          :key="group.value"
          :data-status="group.value"
          :aria-labelledby="`status-${group.value}`"
          class="min-w-0 rounded-xl border border-default bg-elevated/40 p-3 transition-colors"
          :class="
            targetStatus === group.value
              ? 'ring-2 ring-primary bg-primary/5'
              : ''
          "
        >
          <header class="mb-3 flex items-center gap-2 p-1">
            <span
              class="size-2 rounded-full"
              :class="group.color"
              aria-hidden="true"
            />
            <h3
              :id="`status-${group.value}`"
              class="font-semibold text-highlighted"
            >
              {{ group.label }}
            </h3>
            <span class="ml-auto text-sm text-muted">{{
              group.tasks.length
            }}</span>
          </header>
          <div class="min-h-28 space-y-3">
            <DashboardTask
              v-for="task in group.tasks"
              :key="task.id"
              :task="task"
              :subtask-draft="subtaskDrafts[task.id]"
              :focused-task-id="focusedTaskId"
              :updating-status="updatingStatusIds?.includes(task.id)"
              :updating-priority="updatingPriorityIds?.includes(task.id)"
              :class="draggedTaskId === task.id ? 'opacity-50' : ''"
              @change-status="
                (taskId, status) => emit('changeStatus', taskId, status)
              "
              @change-priority="
                (taskId, priority) => emit('changePriority', taskId, priority)
              "
              @focus="(taskId) => emit('focus', taskId)"
              @remove="(taskId) => emit('remove', taskId)"
              @add-subtask="(payload) => emit('addSubtask', payload)"
              @toggle-subtask="(subtaskId) => emit('toggleSubtask', subtaskId)"
              @update:subtask-draft="(draft) => setSubtaskDraft(task.id, draft)"
            >
              <template #move>
                <div class="ml-auto flex shrink-0 items-center gap-1">
                  <button
                    data-task-focus="drag-status"
                    type="button"
                    class="order-last flex size-9 touch-none items-center justify-center rounded-md text-dimmed hover:bg-elevated hover:text-default focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
                    :class="
                      draggedTaskId === task.id
                        ? 'cursor-grabbing'
                        : 'cursor-grab'
                    "
                    :disabled="updatingStatusIds?.includes(task.id)"
                    :aria-label="`Drag ${task.title} to change status`"
                    aria-describedby="task-move-help"
                    @pointerdown="startDrag($event, task.id)"
                    @pointermove="moveDrag"
                    @pointerup="finishDrag"
                    @pointercancel="cancelDrag"
                    @lostpointercapture="cancelDrag"
                    @dragstart.prevent
                  >
                    <UIcon name="i-lucide-grip-vertical" class="size-4" />
                  </button>
                  <UDropdownMenu
                    :items="
                      statuses.map((status) => ({
                        label: TASK_STATUS_LABEL[status.value],
                        disabled:
                          task.status === status.value ||
                          updatingStatusIds?.includes(task.id),
                        onSelect: () => moveTask(task.id, status.value),
                      }))
                    "
                  >
                    <UButton
                      data-task-focus="move-status"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      trailing-icon="i-lucide-chevron-down"
                      :loading="updatingStatusIds?.includes(task.id)"
                      :aria-label="`Move ${task.title} to status`"
                      >Move to</UButton
                    >
                  </UDropdownMenu>
                </div>
              </template>
            </DashboardTask>
            <p
              v-if="!group.tasks.length"
              class="rounded-lg border border-dashed border-default px-3 py-8 text-center text-sm text-muted"
            >
              Drop a task here
            </p>
          </div>
        </section>
      </div>
      <div class="border-t border-default pt-4">
        <button
          type="button"
          data-completed-toggle
          class="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-elevated"
          :aria-expanded="showCompleted"
          aria-controls="completed-tasks"
          @click="showCompleted = !showCompleted"
        >
          <UIcon
            :name="
              showCompleted ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'
            "
            class="size-4 text-muted"
          />
          <span class="font-semibold text-highlighted">Completed tasks</span>
          <span class="ml-auto text-sm text-muted">{{
            completedTasks.length
          }}</span>
        </button>
        <div v-if="showCompleted" id="completed-tasks" class="mt-3 space-y-3">
          <DashboardTask
            v-for="task in completedTasks"
            :key="task.id"
            :task="task"
            :subtask-draft="subtaskDrafts[task.id]"
            :focused-task-id="focusedTaskId"
            :updating-status="updatingStatusIds?.includes(task.id)"
            :updating-priority="updatingPriorityIds?.includes(task.id)"
            @change-status="
              (taskId, status) => emit('changeStatus', taskId, status)
            "
            @change-priority="
              (taskId, priority) => emit('changePriority', taskId, priority)
            "
            @focus="(taskId) => emit('focus', taskId)"
            @remove="(taskId) => emit('remove', taskId)"
            @add-subtask="(payload) => emit('addSubtask', payload)"
            @toggle-subtask="(subtaskId) => emit('toggleSubtask', subtaskId)"
            @update:subtask-draft="(draft) => setSubtaskDraft(task.id, draft)"
          />
          <p
            v-if="!completedTasks.length"
            class="rounded-lg border border-dashed border-default px-3 py-8 text-center text-sm text-muted"
          >
            No completed tasks
          </p>
        </div>
      </div>
    </div>
    <Teleport to="body">
      <div
        v-if="draggedTaskId"
        class="pointer-events-none fixed z-50 max-w-60 truncate rounded-lg border border-primary bg-default px-3 py-2 text-sm shadow-lg"
        :style="{ left: `${pointer.x + 12}px`, top: `${pointer.y + 12}px` }"
        aria-hidden="true"
      >
        {{ tasks.find((task) => task.id === draggedTaskId)?.title }}
      </div>
    </Teleport>
  </section>
</template>
