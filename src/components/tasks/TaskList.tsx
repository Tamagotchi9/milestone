import TaskCard from '@/components/tasks/TaskCard'
import TaskGrid from '@/components/tasks/TaskGrid'
import { tasks } from '@/db/schema'
import { withUserDb } from '@/db/with-user-db'
import { desc } from 'drizzle-orm'

const TaskList = async () => {
  const taskList = await withUserDb((tx) =>
    tx
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        priority: tasks.priority,
        status: tasks.status,
        deadline: tasks.deadline,
      })
      .from(tasks)
      .orderBy(desc(tasks.createdAt)),
  )

  if (!taskList.length) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="font-medium">No tasks yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create your first task to get started.
        </p>
      </div>
    )
  }

  return (
    <TaskGrid>
      {taskList.map((task) => (
        <li key={task.id}>
          <TaskCard task={task} />
        </li>
      ))}
    </TaskGrid>
  )
}

export default TaskList
