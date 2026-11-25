import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DashboardError from '@/app/dashboard/error'

const retryMock = vi.fn()

const renderDashboardError = (error: unknown) => {
  render(<DashboardError error={error} retry={retryMock} />)
  return userEvent.setup()
}

const serverError = (digest: string) =>
  Object.assign(new Error('relation "tasks" does not exist'), { digest })

beforeEach(() => {
  // The component logs the error; keep the test output clean.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  retryMock.mockReset()
})

describe('DashboardError', () => {
  it('shows an alert with a heading', () => {
    renderDashboardError(new Error('Boom'))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Something went wrong' }),
    ).toBeInTheDocument()
  })

  it('retries when the button is clicked', async () => {
    const user = renderDashboardError(new Error('Boom'))

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(retryMock).toHaveBeenCalledOnce()
  })

  it('does not show the error message', () => {
    renderDashboardError(serverError('2353948211'))

    expect(screen.queryByText(/relation "tasks"/)).not.toBeInTheDocument()
  })

  it('shows the digest of a server error as an error code', () => {
    renderDashboardError(serverError('2353948211'))

    expect(screen.getByText('2353948211')).toBeInTheDocument()
  })

  it.each([
    ['an error without a digest', new Error('Boom')],
    ['a thrown string', 'Boom'],
    ['a thrown object with a digest', { digest: '2353948211' }],
  ])('shows no error code for %s', (_, error) => {
    renderDashboardError(error)

    expect(screen.queryByText(/error code/i)).not.toBeInTheDocument()
  })

  it('logs the error', () => {
    const error = new Error('Boom')
    renderDashboardError(error)

    expect(console.error).toHaveBeenCalledWith(error)
  })
})
