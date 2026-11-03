import { describe, it, vi, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UserMenuDropdown from './UserMenuDropdown'
import { signOutUser } from '@/app/auth/actions'
import { SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

vi.mock('@/app/auth/actions', () => ({
  signOutUser: vi.fn(),
}))

const Providers = ({ children }: { children: React.ReactNode }) => (
  <TooltipProvider>
    <SidebarProvider>{children}</SidebarProvider>
  </TooltipProvider>
)

const renderDropdown = () => {
  render(
    <UserMenuDropdown
      name="Jimmy Neutron"
      email="jimmy@example.com"
      image={null}
    >
      <button>Account</button>
    </UserMenuDropdown>,
    { wrapper: Providers },
  )
  return userEvent.setup()
}

beforeEach(() => {
  vi.mocked(signOutUser).mockClear()
})

describe('UserMenuDropdown', () => {
  it('keeps the menu closed until the trigger is clicked', () => {
    renderDropdown()

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Account' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('shows the user name, email and initials when opened', async () => {
    const user = renderDropdown()

    await user.click(screen.getByRole('button', { name: 'Account' }))

    const menu = screen.getByRole('menu')
    expect(menu).toHaveTextContent('Jimmy Neutron')
    expect(menu).toHaveTextContent('jimmy@example.com')
    expect(menu).toHaveTextContent('JN')
  })

  it('signs out when Sign out is clicked', async () => {
    const user = renderDropdown()

    await user.click(screen.getByRole('button', { name: 'Account' }))
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }))

    expect(signOutUser).toHaveBeenCalledOnce()
  })

  it('signs out with the keyboard', async () => {
    const user = renderDropdown()

    await user.tab()
    await user.keyboard('{Enter}')
    await user.keyboard('{Enter}')

    expect(signOutUser).toHaveBeenCalledOnce()
  })
})
