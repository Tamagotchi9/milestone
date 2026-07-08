export const useDateFormat = () => {
  const formatDateToDotted = (deadline: string | null): string => {
    if (!deadline) return 'Not set'

    const datePart = deadline.split('T')[0] ?? deadline
    const [year, month, day] = datePart.split('-')
    if (!year || !month || !day) return deadline

    return `${day}.${month}.${year}`
  }

  return { formatDateToDotted }
}
