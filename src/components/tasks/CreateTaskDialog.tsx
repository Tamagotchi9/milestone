'use client'
import { createTask } from '@/app/dashboard/tasks/actions'
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

const CreateTaskDialog = () => {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create task</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a task</DialogTitle>
        </DialogHeader>
        <TaskForm
          onSuccess={() => setOpen(false)}
          action={createTask}
          formDescription="Create a new task for yourself"
          submitText="Create"
          submitLoadingText="Creating..."
        />
      </DialogContent>
    </Dialog>
  )
}

export default CreateTaskDialog
