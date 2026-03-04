/**
 * 脱毛 拡張コンプライアンス辞書（6エントリ）
 * Phase 3: IPL/医療レーザー・家庭用脱毛器に特化したNG表現
 *
 * 薬機法第66条・67条準拠
 * 景表法・医師法準拠
 */

import type { DictionaryFile } from '../types'

const hairRemovalTermsDictionary: DictionaryFile = {
  category: 'hair_removal',
  description: '脱毛 Phase3 拡張辞書 — IPL・医療レーザー・家庭用脱毛器のNG表現6件',
  entries: [
    // -- IPL/医療レーザー関連 --
    {
      id: 'hr_ext_001',
      ng: 'IPL脱毛で永久脱毛',
      ok: 'IPL脱毛は光エネルギーにより長期的な減毛効果が期待できます（個人差があります）',
      reason: '薬機法第66条・医師法：エステのIPL脱毛で「永久脱毛」は医療行為の誇示に該当',
      severity: 'high',
    },
    {
      id: 'hr_ext_002',
      ng: '医療レーザーなら確実に脱毛',
      ok: '医療レーザー脱毛は高い効果が期待できます（効果には個人差があり、複数回の施術が推奨されます）',
      reason: '薬機法第66条：確実性の断定禁止',
      severity: 'high',
    },
    {
      id: 'hr_ext_003',
      ng: 'レーザー脱毛は安全で無害',
      ok: 'レーザー脱毛は医師の管理下で行われる安全性に配慮した施術です（赤み等が一時的に生じる場合があります）',
      reason: '薬機法第66条：無害・完全安全の断定禁止',
      severity: 'high',
    },
    // -- 家庭用脱毛器関連 --
    {
      id: 'hr_ext_004',
      ng: '家庭用脱毛器でサロン同等の効果',
      ok: '家庭用脱毛器でムダ毛ケアをサポートできます（効果はサロンとは異なり、個人差があります）',
      reason: '薬機法第66条：家庭用機器とサロンの同等表現は効果の過大表現に該当',
      severity: 'high',
    },
    {
      id: 'hr_ext_005',
      ng: '自宅で永久脱毛できる',
      ok: '自宅で手軽にムダ毛ケアが行えます（家庭用機器による永久脱毛はできません）',
      reason: '薬機法第66条・医師法：家庭用機器での永久脱毛表現は禁止',
      severity: 'high',
    },
    {
      id: 'hr_ext_006',
      ng: '家庭用脱毛器は痛みゼロ',
      ok: '家庭用脱毛器は痛みに配慮した設計です（感じ方には個人差があります）',
      reason: '薬機法第66条：痛みの完全否定禁止',
      severity: 'medium',
    },
  ],
}

export default hairRemovalTermsDictionary
