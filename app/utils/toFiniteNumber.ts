export const toFiniteNumber = (
  value: number | string | null | undefined,
): number => {
  if (value == null) return 0
  const numberValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}
