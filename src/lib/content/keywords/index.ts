/**
 * キーワードターゲット管理モジュール
 * カテゴリ・優先度・IDによるキーワード検索ユーティリティ
 */

import type { ContentCategory } from '@/types/content'
import type { KeywordPriority, KeywordTarget } from '@/types/batch-generation'
import { KEYWORD_TARGETS } from './targets'

/**
 * カテゴリでキーワードを絞り込む
 * @param category コンテンツカテゴリ
 * @returns 指定カテゴリのキーワードターゲット配列
 */
export function getKeywordsByCategory(category: ContentCategory): KeywordTarget[] {
  return KEYWORD_TARGETS.filter((kw) => kw.category === category)
}

/**
 * 優先度でキーワードを絞り込む
 * @param priority キーワード優先度
 * @returns 指定優先度のキーワードターゲット配列
 */
export function getKeywordsByPriority(priority: KeywordPriority): KeywordTarget[] {
  return KEYWORD_TARGETS.filter((kw) => kw.priority === priority)
}

/**
 * 全キーワードターゲットを取得する
 * @returns 全30件のキーワードターゲット配列
 */
export function getAllKeywords(): KeywordTarget[] {
  return [...KEYWORD_TARGETS]
}

/**
 * IDでキーワードターゲットを取得する
 * @param id キーワードID
 * @returns 該当するキーワードターゲット（見つからない場合は undefined）
 */
export function getKeywordById(id: string): KeywordTarget | undefined {
  return KEYWORD_TARGETS.find((kw) => kw.id === id)
}

// re-export
export { KEYWORD_TARGETS } from './targets'
