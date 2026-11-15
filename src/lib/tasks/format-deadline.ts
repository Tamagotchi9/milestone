// deadline is a Postgres `date` ('YYYY-MM-DD'). Formatting by splitting
// the string avoids new Date(), which would shift the day in timezones
// behind UTC.
export const formatDeadline = (deadline: string) => {
  const [year, month, day] = deadline.split('-')
  if (!year || !month || !day) return deadline

  return `${day}.${month}.${year}`
}
