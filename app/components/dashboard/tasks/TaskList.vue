<script setup lang="ts">
import type {
  CreateTaskDTO,
  TaskItem,
  TaskPriority,
  TaskStatus,
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

const priorities = [
  { value: 'high', label: 'High', color: 'bg-error' },
  { value: 'medium', label: 'Medium', color: 'bg-warning' },
  { value: 'low', label: 'Low', color: 'bg-success' },
] as const
const board = useTemplateRef<HTMLElement>('board')
const subtaskDrafts = reactive<Record<string, string>>({})
const draggedTaskId = ref<string | null>(null)
const targetPriority = ref<TaskPriority | null>(null)
const pointer = ref({ x: 0, y: 0 })
const announcement = ref('')
let pointerId: number | null = null
let dragHandle: HTMLElement | null = null
let animationFrame = 0
let pendingFocus: { taskId: string; key: string } | null = null
const SCROLL_EDGE = 64
const SCROLL_STEP = 12

const groups = computed(() =>
  priorities.map((priority) => ({
    ...priority,
    tasks: props.tasks
      .filter((task) => task.priority === priority.value)
      .sort((a, b) => {
        if (a.deadline && b.deadline && a.deadline !== b.deadline)
          return a.deadline.localeCompare(b.deadline)
        if (a.deadline && !b.deadline) return -1
        if (!a.deadline && b.deadline) return 1
        return b.createdAt.localeCompare(a.createdAt)
      }),
  })),
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

const moveTask = (taskId: string, priority: TaskPriority) => {
  const task = props.tasks.find((item) => item.id === taskId)
  if (
    !task ||
    task.priority === priority ||
    props.updatingPriorityIds?.includes(taskId)
  )
    return
  rememberFocus()
  pendingFocus ??= { taskId, key: 'move-priority' }
  emit('changePriority', taskId, priority)
  announcement.value = `Moving ${task.title} to ${priority} priority.`
}

const findTarget = () => {
  const element = document
    .elementFromPoint(pointer.value.x, pointer.value.y)
    ?.closest('[data-priority]')
  const value = element?.getAttribute('data-priority')
  targetPriority.value = board.value?.contains(element ?? null)
    ? (priorities.find((priority) => priority.value === value)?.value ?? null)
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
  targetPriority.value = null
  pointerId = null
  dragHandle = null
  if (id !== null && handle?.hasPointerCapture(id))
    handle.releasePointerCapture(id)
}

const startDrag = (event: PointerEvent, taskId: string) => {
  if (
    event.button !== 0 ||
    draggedTaskId.value ||
    props.updatingPriorityIds?.includes(taskId)
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
  const priority = targetPriority.value
  cancelDrag()
  if (taskId && priority) moveTask(taskId, priority)
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
        {{ tasks.length }} {{ tasks.length === 1 ? 'task' : 'tasks' }} · Sorted
        by due date
      </p>
      <p id="task-move-help" class="mt-2 text-sm text-muted">
        Drag the grip to change priority, or use the Move to menu.
      </p>
    </div>
    <p class="sr-only" role="status">{{ announcement }}</p>
    <UCard v-if="loading"
      ><p class="text-sm text-muted">Loading tasks…</p></UCard
    >
    <div v-else ref="board" class="grid items-start gap-4 xl:grid-cols-3">
      <section
        v-for="group in groups"
        :key="group.value"
        :data-priority="group.value"
        :aria-labelledby="`priority-${group.value}`"
        class="min-w-0 rounded-xl border border-default bg-elevated/40 p-3 transition-colors"
        :class="
          targetPriority === group.value
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
            :id="`priority-${group.value}`"
            class="font-semibold text-highlighted"
          >
            {{ group.label }} priority
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
            :class="draggedTaskId === task.id ? 'opacity-50' : ''"
            @change-status="
              (taskId, status) => emit('changeStatus', taskId, status)
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
                  data-task-focus="drag-priority"
                  type="button"
                  class="order-last flex size-9 touch-none items-center justify-center rounded-md text-dimmed hover:bg-elevated hover:text-default focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
                  :class="
                    draggedTaskId === task.id
                      ? 'cursor-grabbing'
                      : 'cursor-grab'
                  "
                  :disabled="updatingPriorityIds?.includes(task.id)"
                  :aria-label="`Drag ${task.title} to change priority`"
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
                    priorities.map((priority) => ({
                      label: `${priority.label} priority`,
                      disabled:
                        task.priority === priority.value ||
                        updatingPriorityIds?.includes(task.id),
                      onSelect: () => moveTask(task.id, priority.value),
                    }))
                  "
                >
                  <UButton
                    data-task-focus="move-priority"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    trailing-icon="i-lucide-chevron-down"
                    :loading="updatingPriorityIds?.includes(task.id)"
                    :aria-label="`Move ${task.title} to priority`"
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
