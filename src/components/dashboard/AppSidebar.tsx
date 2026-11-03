import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
} from '@/components/ui/sidebar'
import NavLinks from '@/components/dashboard/NavLinks'
import { Suspense } from 'react'
import UserMenu from './UserMenu'
import UserMenuSkeleton from './UserMenuSkeleton'

const AppSidebar = () => {
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <NavLinks />
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Suspense fallback={<UserMenuSkeleton />}>
          <UserMenu />
        </Suspense>
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
