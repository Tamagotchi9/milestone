import { CalendarIcon } from 'lucide-react'
import type { Task } from '@/db/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { formatDeadline } from '@/lib/tasks/format-deadline'
import { TASK_STATUS_LABEL } from '@/lib/tasks/labels'
import DeleteTaskDialog from '@/components/tasks/DeleteTaskDialog'
import UpdateTaskDialog from '@/components/tasks/UpdateTaskDialog'
import TaskPriorityMenu from '@/components/tasks/TaskPriorityMenu'

interface TaskCardProps {
  task: Pick<
    Task,
    'id' | 'title' | 'description' | 'priority' | 'status' | 'deadline'
  >
}

const TaskCard = ({ task }: TaskCardProps) => {
  return (
    <Card className="h-full transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-wrap items-center gap-2">
        <TaskPriorityMenu id={task.id} priority={task.priority} />
        <Badge variant="outline">{TASK_STATUS_LABEL[task.status]}</Badge>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2">
        <h3 className="text-base leading-6 font-semibold [overflow-wrap:anywhere]">
          {task.title}
        </h3>
        {task.description && (
          <p className="line-clamp-3 text-sm leading-relaxed [overflow-wrap:anywhere] text-muted-foreground">
            {task.description}
          </p>
        )}
        {task.deadline && (
          <p className="mt-auto inline-flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
            <CalendarIcon aria-hidden className="size-3.5 shrink-0" />
            <span className="sr-only">Deadline:</span>
            <time dateTime={task.deadline}>
              {formatDeadline(task.deadline)}
            </time>
          </p>
        )}
      </CardContent>
      <CardFooter className="justify-end py-2">
        <UpdateTaskDialog task={task} />
        <DeleteTaskDialog taskId={task.id} taskTitle={task.title} />
      </CardFooter>
    </Card>
  )
}

export default TaskCard
