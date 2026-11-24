'use client'
import { Edit2Icon } from 'lucide-react'
import TaskForm from '@/components/tasks/TaskForm'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useState } from 'react'
import { Task } from '@/db/types'
import { updateTask } from '@/app/dashboard/tasks/actions'

interface UpdateTaskDialogProps {
  task: Pick<Task, 'id' | 'title' | 'description'>
}

const UpdateTaskDialog = ({ task }: UpdateTaskDialogProps) => {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Update ${task.title}`}
          title="Update task"
        >
          <Edit2Icon />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update a task</DialogTitle>
        </DialogHeader>
        <TaskForm
          onSuccess={() => setOpen(false)}
          initialValues={task}
          action={updateTask.bind(null, task.id)}
          formDescription="Update current task"
          submitText="Update"
          submitLoadingText="Updating..."
        />
      </DialogContent>
    </Dialog>
  )
}

export default UpdateTaskDialog
