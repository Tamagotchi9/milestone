import { ChevronsUpDown } from 'lucide-react'
import { auth } from '@/lib/auth/server'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import UserMenuDropdown from '@/components/dashboard/UserMenuDropdown'
import UserMenuInfo from '@/components/dashboard/UserMenuInfo'

const UserMenu = async () => {
  const { data: session } = await auth.getSession()

  if (!session || !session.user) {
    return null
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <UserMenuDropdown
          name={session.user.name}
          email={session.user.email}
          image={session.user.image}
        >
          <SidebarMenuButton size="lg">
            <UserMenuInfo
              name={session.user.name}
              email={session.user.email}
              image={session.user.image}
            />
            <ChevronsUpDown className="ml-auto" />
          </SidebarMenuButton>
        </UserMenuDropdown>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export default UserMenu
