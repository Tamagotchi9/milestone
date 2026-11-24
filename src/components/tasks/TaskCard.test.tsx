import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import TaskCard from '@/components/tasks/TaskCard'

// The delete dialog imports the action, which pulls in Neon Auth and
// next/headers. The card tests only check rendering.
vi.mock('@/app/dashboard/tasks/actions', () => ({
  deleteTask: vi.fn(),
  updateTask: vi.fn(),
}))

const task = {
  id: 'cd9c54e5-1b6f-4c4e-9a3e-2f1d8b7a6c50',
  title: 'Write task cards',
  description: 'Port the card design from the Nuxt app',
  priority: 'high',
  status: 'in_progress',
  deadline: '2026-11-20',
} as const

describe('TaskCard', () => {
  it('shows the title as a heading', () => {
    render(<TaskCard task={task} />)

    expect(
      screen.getByRole('heading', { name: 'Write task cards' }),
    ).toBeInTheDocument()
  })
  it('shows description, priority and status labels', () => {
    render(<TaskCard task={task} />)

    expect(
      screen.getByText('Port the card design from the Nuxt app'),
    ).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('In progress')).toBeInTheDocument()
  })
  it('shows the deadline as DD.MM.YYYY with a machine-readable date', () => {
    render(<TaskCard task={task} />)

    const deadline = screen.getByText('20.11.2026')
    expect(deadline.tagName).toBe('TIME')
    expect(deadline).toHaveAttribute('dateTime', '2026-11-20')
  })
  it('hides description and deadline when they are not set', () => {
    render(<TaskCard task={{ ...task, description: null, deadline: null }} />)

    expect(
      screen.queryByText('Port the card design from the Nuxt app'),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/deadline/i)).not.toBeInTheDocument()
  })
  it('has a delete button named after the task', () => {
    render(<TaskCard task={task} />)

    expect(
      screen.getByRole('button', { name: 'Delete Write task cards' }),
    ).toBeInTheDocument()
  })
})
