import { beforeEach, describe, expect, it, vi } from 'vitest'
import { updateTaskPriority } from '@/app/dashboard/tasks/actions'
import { act, render, screen } from '@testing-library/react'
import TaskPriorityMenu, {
  type TaskPriorityMenuProps,
} from '@/components/tasks/TaskPriorityMenu'
import userEvent from '@testing-library/user-event'

vi.mock('@/app/dashboard/tasks/actions', () => ({
  updateTaskPriority: vi.fn(),
}))

const task = {
  id: 'cd9c54e5-1b6f-4c4e-9a3e-2f1d8b7a6c50',
  title: 'Test update task priority',
  priority: 'low',
} as const

const renderTaskPriorityMenu = () => {
  const { rerender } = render(
    <TaskPriorityMenu id={task.id} priority={task.priority} />,
  )
  const rerenderWith = (props: Partial<TaskPriorityMenuProps>) =>
    rerender(
      <TaskPriorityMenu id={task.id} priority={task.priority} {...props} />,
    )
  return { user: userEvent.setup(), rerenderWith }
}

const renderOpenMenu = async () => {
  const { user, rerenderWith } = renderTaskPriorityMenu()
  const priorityBadge = screen.getByRole('button', {
    name: 'Priority: Low. Change priority',
  })
  await user.click(priorityBadge)
  return { user, rerenderWith }
}

const mockPendingPriorityUpdate = () => {
  let resolveUpdate!: () => void
  vi.mocked(updateTaskPriority).mockReturnValue(
    new Promise((resolve) => {
      resolveUpdate = resolve
    }),
  )
  return () => act(async () => resolveUpdate())
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TaskPriorityMenu', () => {
  it('opens menu with current task priority has marked', async () => {
    await renderOpenMenu()

    expect(
      screen.getByRole('menuitemradio', {
        name: 'High',
      }),
    ).not.toBeChecked()
    expect(
      screen.getByRole('menuitemradio', {
        name: 'Low',
      }),
    ).toBeChecked()
  })
  it('shows the new priority while the update is pending', async () => {
    const finishUpdate = mockPendingPriorityUpdate()
    const { user } = await renderOpenMenu()

    await user.click(screen.getByRole('menuitemradio', { name: 'High' }))

    expect(
      screen.getByRole('button', { name: 'Priority: High. Change priority' }),
    ).toBeInTheDocument()
    expect(updateTaskPriority).toHaveBeenCalledExactlyOnceWith(task.id, 'high')

    await finishUpdate()
  })
  it('shows the priority from props once the update finishes', async () => {
    const finishUpdate = mockPendingPriorityUpdate()
    const { user, rerenderWith } = await renderOpenMenu()
    await user.click(screen.getByRole('menuitemradio', { name: 'High' }))

    // The server sends a priority that differs from the optimistic one,
    // e.g. it was changed in another tab. While the update is pending,
    // the optimistic value still wins.
    rerenderWith({ priority: 'medium' })
    expect(
      screen.getByRole('button', { name: 'Priority: High. Change priority' }),
    ).toBeInTheDocument()

    // act() waits for React to commit the end of the transition.
    await finishUpdate()

    expect(
      screen.getByRole('button', { name: 'Priority: Medium. Change priority' }),
    ).toBeInTheDocument()
  })
})
