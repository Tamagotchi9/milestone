'use client'

import UserMenuInfo from '@/components/dashboard/UserMenuInfo'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSidebar } from '@/components/ui/sidebar'
import { signOutUser } from '@/app/auth/actions'

interface UserMenuDropdownProps {
  name: string
  email: string
  image: string | null | undefined
  children: React.ReactNode
}

const UserMenuDropdown = ({
  name,
  email,
  image,
  children,
}: UserMenuDropdownProps) => {
  // Open to the right of the sidebar on desktop, where a collapsed sidebar is only 48px wide.
  const { isMobile } = useSidebar()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-56"
        side={isMobile ? 'bottom' : 'right'}
        align="end"
      >
        <DropdownMenuLabel className="p-1 text-sm font-normal text-popover-foreground">
          <UserMenuInfo name={name} email={email} image={image} />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => signOutUser()}>
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default UserMenuDropdown
