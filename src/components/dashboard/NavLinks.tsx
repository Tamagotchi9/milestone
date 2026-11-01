'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

const routes = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Tasks', href: '/dashboard/tasks' },
  { name: 'Pomidoro', href: '/dashboard/pomidoro' },
  { name: 'Habits', href: '/dashboard/habits' },
]

const NavLinks = () => {
  const currentRoute = usePathname()
  return (
    <nav>
      {routes.map(({ name, href }) => (
        <Link
          href={href}
          key={href}
          aria-current={currentRoute === href ? 'page' : undefined}
        >
          {name}
        </Link>
      ))}
    </nav>
  )
}

export default NavLinks
