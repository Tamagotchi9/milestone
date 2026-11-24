'use client'

import { useActionState } from 'react'
import LoadingButton from '@/components/LoadingButton'
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
import { TaskFormState } from '@/types/tasks'
import { Task } from '@/db/types'

export interface TaskFormProps {
  onSuccess: () => void
  initialValues?: Pick<Task, 'title' | 'description'>
  action: (prev: TaskFormState, formData: FormData) => Promise<TaskFormState>
  formDescription: string
  submitText: string
  submitLoadingText: string
}

const TaskForm = ({
  onSuccess,
  initialValues,
  action,
  formDescription,
  submitText,
  submitLoadingText,
}: TaskFormProps) => {
  const [state, formAction, isPending] = useActionState(
    async (prev: TaskFormState, formData: FormData) => {
      const result = await action(prev, formData)
      if (result.status === 'success') {
        onSuccess()
      }
      return result
    },
    initialCreateTaskState(
      initialValues
        ? { title: initialValues.title, description: initialValues.description }
        : {},
    ),
  )

  return (
    <form action={formAction}>
      <FieldSet>
        <FieldDescription>{formDescription}</FieldDescription>
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
      <LoadingButton
        type="submit"
        loading={isPending}
        loadingText={submitLoadingText}
        className="mt-5"
      >
        {submitText}
      </LoadingButton>
    </form>
  )
}

export default TaskForm
