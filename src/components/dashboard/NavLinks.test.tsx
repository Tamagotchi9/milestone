import { usePathname } from 'next/navigation'
import { describe, it, vi, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import NavLinks from './NavLinks'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}))

const routes = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Tasks', href: '/dashboard/tasks' },
  { name: 'Pomidoro', href: '/dashboard/pomidoro' },
  { name: 'Habits', href: '/dashboard/habits' },
]

beforeEach(() => {
  vi.mocked(usePathname).mockReturnValue('/dashboard')
})

describe('NavLinks', () => {
  it.each(routes)('links $name to its $href', ({ name, href }) => {
    render(<NavLinks />)

    const link = screen.getByRole('link', { name })

    expect(link).toHaveAttribute('href', href)
  })
  it.each(routes)('marks $name as active on $href', ({ name, href }) => {
    vi.mocked(usePathname).mockReturnValue(href)
    render(<NavLinks />)
    const link = screen.getByRole('link', { name })

    expect(link).toHaveAttribute('aria-current', 'page')
  })
  it('marks only one link as active', () => {
    vi.mocked(usePathname).mockReturnValue('/dashboard/tasks')
    render(<NavLinks />)

    const links = screen.getAllByRole('link', { current: 'page' })
    expect(links).toHaveLength(1)
  })
  it('marks no link as active on an unknown page', () => {
    vi.mocked(usePathname).mockReturnValue('/dashboard/unknown')
    render(<NavLinks />)

    const link = screen.queryByRole('link', { current: 'page' })
    expect(link).not.toBeInTheDocument()
  })
})
