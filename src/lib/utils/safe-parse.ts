/**
 * Safely parse integer from query parameter with bounds validation
 */
export function safeParseInt(value: string | null, defaultValue: number, min = 0, max = 1000): number {
  if (!value) return defaultValue
  const parsed = parseInt(value, 10)
  if (isNaN(parsed)) return defaultValue
  return Math.max(min, Math.min(parsed, max))
}

/**
 * Safely parse float, returning defaultValue on NaN
 */
export function safeParseFloat(value: unknown, defaultValue = 0): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : defaultValue
}
