import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import LoadingButton from '@/components/LoadingButton'

describe('LoadingButton', () => {
  it('shows its label and is enabled when not loading', () => {
    render(
      <LoadingButton loading={false} loadingText="Saving...">
        Save
      </LoadingButton>,
    )

    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toBeEnabled()
    expect(button).not.toHaveAttribute('aria-busy', 'true')
    expect(button.querySelector('[data-slot="spinner"]')).toBeNull()
  })
  it('shows a spinner with the loading text and is disabled while loading', () => {
    render(
      <LoadingButton loading loadingText="Saving...">
        Save
      </LoadingButton>,
    )

    const button = screen.getByRole('button', { name: 'Saving...' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button.querySelector('[data-slot="spinner"]')).toBeInTheDocument()
  })
  it('stays disabled when disabled is passed and it is not loading', () => {
    render(
      <LoadingButton loading={false} loadingText="Saving..." disabled>
        Save
      </LoadingButton>,
    )

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })
})
