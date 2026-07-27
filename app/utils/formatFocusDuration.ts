export const formatFocusDuration = (totalSeconds: number): string => {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const totalMinutes = Math.floor(safe / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours <= 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}
