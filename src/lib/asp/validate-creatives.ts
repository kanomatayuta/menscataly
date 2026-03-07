/**
 * AdCreatives バリデーション (共通ユーティリティ)
 * /api/admin/asp (POST) と /api/admin/asp/[id] (PUT) で共用
 */

export function validateAdCreatives(creatives: unknown[]): string | null {
  if (!Array.isArray(creatives)) return 'adCreatives must be an array'

  for (let i = 0; i < creatives.length; i++) {
    const item = creatives[i]
    if (typeof item !== 'object' || item === null) {
      return `adCreatives[${i}]: must be an object`
    }
    const c = item as Record<string, unknown>
    if (typeof c.id !== 'string' || !c.id) {
      return `adCreatives[${i}].id: must be a non-empty string`
    }
    if (!['text', 'banner'].includes(c.type as string)) {
      return `adCreatives[${i}].type: must be 'text' or 'banner'`
    }
    // rawHtml が設定されている場合、affiliateUrl は不要（rawHtml内に含まれる）
    const hasRawHtml = typeof c.rawHtml === 'string' && c.rawHtml.length > 0
    if (!hasRawHtml && (typeof c.affiliateUrl !== 'string' || !c.affiliateUrl)) {
      return `adCreatives[${i}].affiliateUrl: must be a non-empty string (or provide rawHtml)`
    }
    if (typeof c.isActive !== 'boolean') {
      return `adCreatives[${i}].isActive: must be a boolean`
    }
  }
  return null
}
