import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getUserInitials } from '@/lib/user-initials'

interface UserMenuInfoProps {
  name: string
  email: string
  image: string | null | undefined
}

const UserMenuInfo = ({ name, email, image }: UserMenuInfoProps) => {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <Avatar>
        <AvatarImage src={image ?? undefined} alt="" />
        <AvatarFallback>{getUserInitials(name || email)}</AvatarFallback>
      </Avatar>
      <span className="grid flex-1 leading-tight">
        <span className="truncate font-medium">{name}</span>
        <span className="truncate text-xs text-muted-foreground">{email}</span>
      </span>
    </span>
  )
}

export default UserMenuInfo
