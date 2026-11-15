import { Suspense } from 'react'
import TaskList from '@/components/tasks/TaskList'
import TaskListSkeleton from '@/components/tasks/TaskListSkeleton'
import CreateTaskDialog from '@/components/tasks/CreateTaskDialog'

const TasksPage = async () => {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <CreateTaskDialog />
      </div>
      <Suspense fallback={<TaskListSkeleton />}>
        <TaskList />
      </Suspense>
    </div>
  )
}

export default TasksPage
