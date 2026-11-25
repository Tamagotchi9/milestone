'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Task } from '@/db/types'
import { startTransition, useOptimistic } from 'react'
import { cn } from 'cn'
import { TASK_PRIORITY_LABEL } from '@/lib/tasks/labels'
import { updateTaskPriority } from '@/app/dashboard/tasks/actions'
import { Badge } from '@/components/ui/badge'
import { isTaskPriority } from '@/lib/tasks/is-task-priority'
import { ChevronDownIcon } from 'lucide-react'

const priorityClassName: Record<Task['priority'], string> = {
  high: 'bg-destructive/10 text-destructive dark:bg-destructive/20',
  medium:
    'bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  low: 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
}

export interface TaskPriorityMenuProps {
  id: string
  priority: Task['priority']
}

const TaskPriorityMenu = ({ id, priority }: TaskPriorityMenuProps) => {
  const [optimisticPriority, setOptimisticPriority] = useOptimistic(priority)

  const handlePriorityChange = (nextPriority: string) => {
    if (!isTaskPriority(nextPriority)) return
    startTransition(async () => {
      setOptimisticPriority(nextPriority)
      await updateTaskPriority(id, nextPriority)
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Badge
          asChild
          className={cn(
            'cursor-pointer gap-1.5',
            priorityClassName[optimisticPriority],
          )}
        >
          <button
            type="button"
            aria-label={`Priority: ${TASK_PRIORITY_LABEL[optimisticPriority]}. Change priority`}
          >
            <span aria-hidden className="size-1.5 rounded-full bg-current" />
            {TASK_PRIORITY_LABEL[optimisticPriority]}
            {/* Radix sets data-state on the trigger, which is this badge */}
            <ChevronDownIcon className="transition-transform duration-200 group-data-[state=open]/badge:rotate-180 motion-reduce:transition-none" />
          </button>
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuRadioGroup
          value={optimisticPriority}
          onValueChange={handlePriorityChange}
        >
          {Object.entries(TASK_PRIORITY_LABEL).map(([value, label]) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default TaskPriorityMenu
