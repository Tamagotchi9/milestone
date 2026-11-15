'use client'

import { useActionState } from 'react'
import { createTask } from '@/app/dashboard/tasks/actions'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { initialCreateTaskState } from '@/lib/tasks/initial-create-task-state'
import { CreateTaskState } from '@/types/tasks'

interface TaskFormProps {
  onSuccess: () => void
}

const TaskForm = ({ onSuccess }: TaskFormProps) => {
  const [state, formAction, isPending] = useActionState(
    async (prev: CreateTaskState, formData: FormData) => {
      const result = await createTask(prev, formData)
      if (result.status === 'success') {
        onSuccess()
      }
      return result
    },
    initialCreateTaskState,
  )
  return (
    <form action={formAction}>
      <FieldSet>
        <FieldDescription>Create a new task for yourself</FieldDescription>
        <FieldGroup>
          <Field data-invalid={!!state.errors.title}>
            <FieldLabel htmlFor="title">Title</FieldLabel>
            <Input
              id="title"
              name="title"
              aria-invalid={!!state.errors.title}
              defaultValue={state.values.title}
            />
            <FieldError>{state.errors.title}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="description">Description</FieldLabel>
            <Textarea
              id="description"
              name="description"
              defaultValue={state.values.description}
            />
          </Field>
        </FieldGroup>
      </FieldSet>
      <Button type="submit" disabled={isPending} className="mt-5">
        {isPending ? 'Creating...' : 'Create'}
      </Button>
    </form>
  )
}

export default TaskForm
