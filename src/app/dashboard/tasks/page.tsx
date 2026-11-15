import { Suspense } from 'react'
import TaskList from '@/components/tasks/TaskList'
import CreateTaskDialog from '@/components/tasks/CreateTaskDialog'

const TasksPage = async () => {
  return (
    <div>
      <CreateTaskDialog />
      <Suspense fallback="Loading...">
        <TaskList />
      </Suspense>
    </div>
  )
}

export default TasksPage
