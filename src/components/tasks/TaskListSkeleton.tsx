import TaskGrid from '@/components/tasks/TaskGrid'
import { Skeleton } from '@/components/ui/skeleton'

const TaskListSkeleton = () => {
  return (
    <TaskGrid aria-busy="true" aria-label="Loading tasks">
      {Array.from({ length: 6 }, (_, index) => (
        <li key={index}>
          <Skeleton className="h-36 rounded-xl" />
        </li>
      ))}
    </TaskGrid>
  )
}

export default TaskListSkeleton
