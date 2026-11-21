'use client'
import { Trash2Icon } from 'lucide-react'
import { useTransition } from 'react'
import { deleteTask } from '@/app/dashboard/tasks/actions'
import LoadingButton from '@/components/LoadingButton'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface DeleteTaskDialogProps {
  taskId: string
  taskTitle: string
}

const DeleteTaskDialog = ({ taskId, taskTitle }: DeleteTaskDialogProps) => {
  const [isPending, startTransition] = useTransition()

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${taskTitle}`}
          title="Delete task"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2Icon />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete task?</DialogTitle>
          <DialogDescription>
            &quot;{taskTitle}&quot; and its subtasks will be deleted. This
            cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <LoadingButton
            variant="destructive"
            loading={isPending}
            loadingText="Deleting..."
            onClick={() =>
              startTransition(async () => {
                await deleteTask(taskId)
              })
            }
          >
            Delete
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DeleteTaskDialog
