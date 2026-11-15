import { cn } from 'cn'

const TaskGrid = ({ className, ...props }: React.ComponentProps<'ul'>) => {
  return (
    <ul
      className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-3', className)}
      {...props}
    />
  )
}

export default TaskGrid
