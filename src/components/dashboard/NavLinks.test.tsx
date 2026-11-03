import { usePathname } from 'next/navigation'
import { describe, it, vi, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import NavLinks from './NavLinks'
import { SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}))

const routes = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Tasks', href: '/dashboard/tasks' },
  { name: 'Pomidoro', href: '/dashboard/pomidoro' },
  { name: 'Habits', href: '/dashboard/habits' },
]

const Providers = ({ children }: { children: React.ReactNode }) => (
  <TooltipProvider>
    <SidebarProvider>{children}</SidebarProvider>
  </TooltipProvider>
)

const renderNavLinks = (href: string = '/dashboard') => {
  vi.mocked(usePathname).mockReturnValue(href)
  render(<NavLinks />, { wrapper: Providers })
}

describe('NavLinks', () => {
  it.each(routes)('links $name to its $href', ({ name, href }) => {
    renderNavLinks()

    const link = screen.getByRole('link', { name })

    expect(link).toHaveAttribute('href', href)
  })
  it.each(routes)('marks $name as active on $href', ({ name, href }) => {
    renderNavLinks(href)
    const link = screen.getByRole('link', { name })

    expect(link).toHaveAttribute('aria-current', 'page')
  })
  it('marks only one link as active', () => {
    renderNavLinks('/dashboard/tasks')

    const links = screen.getAllByRole('link', { current: 'page' })
    expect(links).toHaveLength(1)
  })
  it('marks no link as active on an unknown page', () => {
    renderNavLinks('/dashboard/unknown')

    const link = screen.queryByRole('link', { current: 'page' })
    expect(link).not.toBeInTheDocument()
  })
})
