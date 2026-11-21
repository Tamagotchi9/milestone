import { beforeEach, describe, vi, it, expect } from 'vitest'
import DeleteTaskDialog from '@/components/tasks/DeleteTaskDialog'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/react'
import { deleteTask } from '@/app/dashboard/tasks/actions'

vi.mock('@/app/dashboard/tasks/actions', () => ({
  deleteTask: vi.fn(),
}))

const task = {
  id: 'cd9c54e5-1b6f-4c4e-9a3e-2f1d8b7a6c50',
  title: 'Write task cards',
} as const

const renderDeleteTaskDialog = () => {
  render(<DeleteTaskDialog taskId={task.id} taskTitle={task.title} />)
  return userEvent.setup()
}
const renderOpenDialog = async () => {
  const user = renderDeleteTaskDialog()
  await user.click(
    screen.getByRole('button', { name: 'Delete Write task cards' }),
  )
  return user
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DeleteTaskDialog', () => {
  it('opens the dialog with the task title on trigger click', async () => {
    const user = renderDeleteTaskDialog()
    const deleteTaskButton = screen.getByRole('button', {
      name: 'Delete Write task cards',
    })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(deleteTaskButton)

    expect(screen.getByRole('dialog')).toHaveTextContent('Write task cards')
  })
  it('closes without deleting on "Cancel" click', async () => {
    const user = await renderOpenDialog()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(deleteTask).not.toHaveBeenCalled()
  })
  it('calls deleteTask with the task id on "Delete" click', async () => {
    const user = await renderOpenDialog()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(deleteTask).toHaveBeenCalledWith(task.id)
  })
  it('shows loading state while deleting', async () => {
    let resolveDeleteTask!: () => void
    vi.mocked(deleteTask).mockReturnValue(
      new Promise((resolve) => {
        resolveDeleteTask = resolve
      }),
    )

    const user = await renderOpenDialog()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()

    resolveDeleteTask()

    // Only this state change waits for the promise, so only it needs findBy.
    expect(await screen.findByRole('button', { name: 'Delete' })).toBeEnabled()
  })
})
