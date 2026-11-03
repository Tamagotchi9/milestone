import { Skeleton } from '@/components/ui/skeleton'

// Mirrors the UserMenu button (size="lg") so the footer does not jump when the session loads.
const UserMenuSkeleton = () => {
  return (
    <div className="flex h-12 items-center gap-2 overflow-hidden p-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0">
      <Skeleton className="size-8 shrink-0 rounded-full" />
      <div className="grid flex-1 gap-1.5">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3 w-36" />
      </div>
    </div>
  )
}

export default UserMenuSkeleton
