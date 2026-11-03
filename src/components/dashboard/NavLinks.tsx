'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, ListTodo, Sprout, Timer } from 'lucide-react'
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar'

const routes = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Tasks', href: '/dashboard/tasks', icon: ListTodo },
  { name: 'Pomidoro', href: '/dashboard/pomidoro', icon: Timer },
  { name: 'Habits', href: '/dashboard/habits', icon: Sprout },
]

const NavLinks = () => {
  const currentRoute = usePathname()
  const isActiveLink = (href: string) => currentRoute === href
  // On mobile the menu is an overlay, so close it once a page is chosen.
  const { setOpenMobile } = useSidebar()

  return (
    <SidebarMenu>
      {routes.map(({ name, href, icon: Icon }) => (
        <SidebarMenuItem key={href}>
          <SidebarMenuButton
            isActive={isActiveLink(href)}
            tooltip={name}
            asChild
          >
            <Link
              href={href}
              aria-current={isActiveLink(href) ? 'page' : undefined}
              onClick={() => setOpenMobile(false)}
            >
              <Icon />
              <span>{name}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

export default NavLinks
