import type { Task } from '@/db/types'

type TaskProps = Pick<Task, 'title' | 'description' | 'createdAt'>

const Task = ({ title }: TaskProps) => {
  return (
    <div>
      <h3>{title}</h3>
    </div>
  )
}

export default Task
