import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import TaskForm from '@/components/tasks/TaskForm'
import { createTask } from '@/app/dashboard/tasks/actions'
import userEvent from '@testing-library/user-event'
import { CreateTaskState } from '@/types/tasks'

vi.mock('@/app/dashboard/tasks/actions', () => ({
  createTask: vi.fn(),
}))

const onSuccessMock = vi.fn()

const renderTaskForm = () => {
  render(<TaskForm onSuccess={onSuccessMock} />)
  return userEvent.setup()
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TaskForm', () => {
  it('calls onSuccess after form is filled successfully', async () => {
    vi.mocked(createTask).mockResolvedValue({
      status: 'success',
      errors: {},
      values: { title: '', description: '' },
    })

    const user = renderTaskForm()

    const titleInput = screen.getByRole('textbox', { name: 'Title' })
    await user.type(titleInput, 'New task')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(onSuccessMock).toHaveBeenCalledOnce())
  })
  it('does not call onSuccess on form validation error', async () => {
    vi.mocked(createTask).mockResolvedValue({
      status: 'error',
      errors: { title: 'Title is required' },
      values: { title: '', description: '' },
    })

    const user = renderTaskForm()

    await user.click(screen.getByRole('button', { name: 'Create' }))

    await screen.findByRole('alert')
    expect(onSuccessMock).not.toHaveBeenCalled()
  })
  it('shows title validation error message on empty input', async () => {
    vi.mocked(createTask).mockResolvedValue({
      status: 'error',
      errors: { title: 'Title is required' },
      values: { title: '', description: '' },
    })

    const user = renderTaskForm()

    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Title is required',
    )
  })
  it('shows loading state of submit button while action is processing', async () => {
    let resolveCreateTask!: (state: CreateTaskState) => void
    vi.mocked(createTask).mockReturnValue(
      new Promise((resolve) => {
        resolveCreateTask = resolve
      }),
    )

    const user = renderTaskForm()

    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'New task')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(
      await screen.findByRole('button', { name: 'Creating...' }),
    ).toBeDisabled()

    resolveCreateTask({
      status: 'success',
      errors: {},
      values: { title: '', description: '' },
    })

    expect(await screen.findByRole('button', { name: 'Create' })).toBeEnabled()
  })
})
