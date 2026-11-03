import { ChevronsUpDown } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { auth } from '@/lib/auth/server'
import { getUserInitials } from '@/lib/user-initials'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

const UserMenu = async () => {
  const { data: session } = await auth.getSession()

  if (!session || !session.user) {
    return null
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg">
          <Avatar>
            <AvatarImage src={session.user.image ?? undefined} alt="" />
            <AvatarFallback>
              {getUserInitials(session.user.name || session.user.email)}
            </AvatarFallback>
          </Avatar>
          <span className="grid flex-1 leading-tight">
            <span className="truncate font-medium">{session.user.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {session.user.email}
            </span>
          </span>
          <ChevronsUpDown className="ml-auto" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export default UserMenu
