import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import TaskForm, { TaskFormProps } from '@/components/tasks/TaskForm'
import userEvent from '@testing-library/user-event'
import { TaskFormState } from '@/types/tasks'

const onSuccessMock = vi.fn()
const actionMock = vi.fn<TaskFormProps['action']>()

const renderTaskForm = (props: Partial<TaskFormProps> = {}) => {
  render(
    <TaskForm
      onSuccess={onSuccessMock}
      action={actionMock}
      formDescription="Create a new task for yourself"
      submitText="Create"
      submitLoadingText="Creating..."
      {...props}
    />,
  )
  return userEvent.setup()
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TaskForm', () => {
  it('calls onSuccess after form is filled successfully', async () => {
    actionMock.mockResolvedValue({
      status: 'success',
      errors: {},
      values: { title: '', description: '' },
    })

    const user = renderTaskForm()

    const titleInput = screen.getByRole('textbox', { name: 'Title' })
    await user.type(titleInput, 'New task')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(onSuccessMock).toHaveBeenCalledOnce())
    const [, formData] = actionMock.mock.calls[0]
    expect(formData.get('title')).toBe('New task')
  })
  it('does not call onSuccess on form validation error', async () => {
    actionMock.mockResolvedValue({
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
    actionMock.mockResolvedValue({
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
    let resolveAction!: (state: TaskFormState) => void
    actionMock.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve
      }),
    )

    const user = renderTaskForm()

    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'New task')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(
      await screen.findByRole('button', { name: 'Creating...' }),
    ).toBeDisabled()

    resolveAction({
      status: 'success',
      errors: {},
      values: { title: '', description: '' },
    })

    expect(await screen.findByRole('button', { name: 'Create' })).toBeEnabled()
  })
  it('receives values for title and description in edit mode', async () => {
    renderTaskForm({
      initialValues: {
        title: 'Created task',
        description: 'Its an old task',
      },
    })

    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue(
      'Created task',
    )
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue(
      'Its an old task',
    )
  })
})
