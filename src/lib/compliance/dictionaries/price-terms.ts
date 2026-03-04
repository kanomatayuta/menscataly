/**
 * 価格・費用 拡張コンプライアンス辞書（10エントリ）
 * Phase 2: 全カテゴリ共通の価格関連NG表現
 *
 * 景表法（不当景品類及び不当表示防止法）準拠
 * 有利誤認表示の防止
 */

import type { DictionaryFile } from '../types'

const priceTermsDictionary: DictionaryFile = {
  category: 'common',
  description: '価格・費用 Phase2 拡張辞書 — 全カテゴリ共通の価格関連NG表現10件',
  entries: [
    // -- 最大級価格表現 --
    {
      id: 'price_001',
      ng: '業界最安水準',
      ok: '調査時点（YYYY年MM月DD日）での業界内で低価格帯のサービス',
      reason: '景表法：「最安水準」も最大級表現に該当。調査根拠・日時が必要',
      severity: 'high',
    },
    {
      id: 'price_002',
      ng: '破格の安さ',
      ok: 'お手頃な価格設定です（※YYYY年MM月時点の価格です）',
      reason: '景表法：有利誤認を招く誇張的価格表現禁止',
      severity: 'medium',
    },
    {
      id: 'price_003',
      ng: '他社より圧倒的に安い',
      ok: '他社と比較して価格面で優位性があります（※〇〇調査 YYYY年MM月DD日時点）',
      reason: '景表法：比較広告には客観的根拠・調査日時が必要',
      severity: 'high',
    },
    // -- 無料・割引関連 --
    {
      id: 'price_004',
      ng: '今なら無料',
      ok: '初回限定無料キャンペーン実施中（※YYYY年MM月DD日まで。条件あり）',
      reason: '景表法：有利誤認防止。無料の条件・期間の明記義務',
      severity: 'high',
    },
    {
      id: 'price_005',
      ng: '追加費用一切なし',
      ok: '基本プランに含まれる費用以外の追加料金はありません（※オプションメニューを除く）',
      reason: '景表法：「一切なし」は例外がある場合に有利誤認に該当',
      severity: 'high',
    },
    {
      id: 'price_006',
      ng: '返金保証で安心',
      ok: '返金保証制度あり（※適用条件・期限については公式サイトでご確認ください）',
      reason: '景表法：返金保証の条件を明記しない場合は有利誤認に該当',
      severity: 'medium',
    },
    // -- 期間限定・煽り表現 --
    {
      id: 'price_007',
      ng: '残りわずか',
      ok: 'ご検討の際は最新の空き状況をご確認ください',
      reason: '景表法：根拠のない希少性演出は不当表示に該当する可能性',
      severity: 'medium',
    },
    {
      id: 'price_008',
      ng: '定価の半額以下',
      ok: '参考価格〇〇円に対し、〇〇円でご提供中です（※YYYY年MM月DD日時点）',
      reason: '景表法：二重価格表示には合理的な根拠（過去の販売実績等）が必要',
      severity: 'high',
    },
    // -- コスパ・値段関連 --
    {
      id: 'price_009',
      ng: 'コスパ最強',
      ok: 'コストパフォーマンスに優れたサービスです',
      reason: '景表法：最大級表現「最強」の使用禁止',
      severity: 'medium',
    },
    {
      id: 'price_010',
      ng: 'ワンコインで治療開始',
      ok: '〇〇円（税込）から治療を開始できるプランがあります（※YYYY年MM月時点。別途費用が発生する場合があります）',
      reason: '景表法：有利誤認防止。具体的な金額と条件の明記義務',
      severity: 'medium',
    },
  ],
}

export default priceTermsDictionary
