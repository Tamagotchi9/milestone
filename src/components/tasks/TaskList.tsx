import Task from '@/components/tasks/Task'
import { tasks } from '@/db/schema'
import { withUserDb } from '@/db/with-user-db'
import { desc } from 'drizzle-orm'

const TaskList = async () => {
  const taskList = await withUserDb((tx) =>
    tx.select().from(tasks).orderBy(desc(tasks.createdAt)),
  )

  return (
    <div>
      {taskList.map((task) => (
        <Task
          key={task.id}
          title={task.title}
          description={task.description}
          createdAt={task.createdAt}
        />
      ))}
    </div>
  )
}

export default TaskList
