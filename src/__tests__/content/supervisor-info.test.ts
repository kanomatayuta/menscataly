/**
 * 監修者・参考文献テンプレート Unit Tests
 * テンプレート生成・参考文献フォーマット・Schema.org構造化データのテスト
 */

import { describe, it, expect } from 'vitest'
import {
  getSupervisorTemplateForCategory,
  formatReferences,
  generateUpdateInfo,
  getRecommendedReferencesForCategory,
  getMinimumReferenceCount,
  getAllSupervisorTemplates,
  type SupervisorTemplate,
  type FormattedReference,
} from '@/lib/content/templates/supervisor-info'
import type { Reference } from '@/types/content'

// ==============================================================
// getSupervisorTemplateForCategory テスト
// ==============================================================

describe('getSupervisorTemplateForCategory', () => {
  const categories = ['aga', 'ed', 'hair-removal', 'skincare', 'supplement', 'column']

  for (const category of categories) {
    it(`${category} カテゴリのテンプレートを取得できること`, () => {
      const template = getSupervisorTemplateForCategory(category)

      expect(template).toBeDefined()
      expect(template.supervisor).toBeDefined()
      expect(template.supervisor.name).toBeDefined()
      expect(template.supervisor.credentials).toBeDefined()
      expect(template.supervisor.bio).toBeDefined()
      expect(Array.isArray(template.specialties)).toBe(true)
      expect(template.specialties.length).toBeGreaterThan(0)
      expect(Array.isArray(template.recommendedTypes)).toBe(true)
      expect(template.recommendedTypes.length).toBeGreaterThan(0)
      expect(template.profileHtml).toBeDefined()
      expect(template.profileHtml.length).toBeGreaterThan(0)
      expect(template.structuredData).toBeDefined()
    })
  }

  it('comparison カテゴリが column にマッピングされること', () => {
    const compTemplate = getSupervisorTemplateForCategory('comparison')
    const colTemplate = getSupervisorTemplateForCategory('column')

    expect(compTemplate.supervisor.credentials).toBe(colTemplate.supervisor.credentials)
  })

  it('不明なカテゴリで column のフォールバックが返されること', () => {
    const template = getSupervisorTemplateForCategory('unknown-category')
    const colTemplate = getSupervisorTemplateForCategory('column')

    expect(template.supervisor.credentials).toBe(colTemplate.supervisor.credentials)
  })

  it('AGAテンプレートに皮膚科専門医が含まれること', () => {
    const template = getSupervisorTemplateForCategory('aga')
    expect(template.supervisor.credentials).toContain('皮膚科専門医')
    expect(template.specialties).toContain('AGA治療')
  })

  it('EDテンプレートに泌尿器科専門医が含まれること', () => {
    const template = getSupervisorTemplateForCategory('ed')
    expect(template.supervisor.credentials).toContain('泌尿器科専門医')
    expect(template.specialties).toContain('ED治療')
  })

  it('脱毛テンプレートにレーザー専門医が含まれること', () => {
    const template = getSupervisorTemplateForCategory('hair-removal')
    expect(template.supervisor.credentials).toContain('レーザー専門医')
    expect(template.specialties).toContain('医療脱毛')
  })

  it('サプリメントテンプレートに管理栄養士が含まれること', () => {
    const template = getSupervisorTemplateForCategory('supplement')
    expect(template.supervisor.credentials).toContain('管理栄養士')
    expect(template.specialties).toContain('サプリメント')
  })

  // Schema.org 構造化データテスト
  describe('Schema.org 構造化データ', () => {
    it('全テンプレートに@context と @type が含まれること', () => {
      for (const category of categories) {
        const template = getSupervisorTemplateForCategory(category)
        expect(template.structuredData['@context']).toBe('https://schema.org')
        expect(template.structuredData['@type']).toBe('Person')
      }
    })

    it('全テンプレートにnameとjobTitleが含まれること', () => {
      for (const category of categories) {
        const template = getSupervisorTemplateForCategory(category)
        expect(template.structuredData['name']).toBeDefined()
        expect(template.structuredData['jobTitle']).toBeDefined()
      }
    })

    it('医療系テンプレートにmemberOfが含まれること', () => {
      const template = getSupervisorTemplateForCategory('aga')
      expect(template.structuredData['memberOf']).toBeDefined()
      expect(Array.isArray(template.structuredData['memberOf'])).toBe(true)
    })
  })

  // profileHtml テスト
  describe('profileHtml テンプレート', () => {
    it('Schema.org のitemscope属性が含まれること', () => {
      for (const category of categories) {
        const template = getSupervisorTemplateForCategory(category)
        expect(template.profileHtml).toContain('itemscope')
        expect(template.profileHtml).toContain('schema.org/Person')
      }
    })

    it('itemprop属性が含まれること', () => {
      const template = getSupervisorTemplateForCategory('aga')
      expect(template.profileHtml).toContain('itemprop="name"')
      expect(template.profileHtml).toContain('itemprop="jobTitle"')
    })

    it('プレースホルダーが含まれること', () => {
      const template = getSupervisorTemplateForCategory('aga')
      expect(template.profileHtml).toContain('{{SUPERVISOR_NAME}}')
      expect(template.profileHtml).toContain('{{YEARS}}')
    })
  })
})

// ==============================================================
// formatReferences テスト
// ==============================================================

describe('formatReferences', () => {
  const sampleRefs: Reference[] = [
    {
      title: 'AGA診療ガイドライン 2017年版',
      url: 'https://www.dermatol.or.jp/uploads/AGA_GL2017.pdf',
      source: '日本皮膚科学会',
      year: 2017,
    },
    {
      title: 'Finasteride in the treatment of AGA',
      url: 'https://pubmed.ncbi.nlm.nih.gov/9777765/',
      author: 'Kaufman KD, et al.',
      source: 'J Am Acad Dermatol',
      year: 1998,
    },
    {
      title: 'プロペシア錠 添付文書',
      url: 'https://www.pmda.go.jp/',
      source: 'PMDA（医薬品医療機器総合機構）',
    },
    {
      title: '一般メディア記事',
      url: 'https://example.com/article',
      source: 'ニュースメディア',
    },
  ]

  it('参考文献リストをフォーマットできること', () => {
    const formatted = formatReferences(sampleRefs)
    expect(formatted.length).toBe(sampleRefs.length)

    for (const ref of formatted) {
      expect(ref.formattedText).toBeDefined()
      expect(ref.formattedText.length).toBeGreaterThan(0)
      expect(ref.htmlText).toBeDefined()
      expect(ref.htmlText.length).toBeGreaterThan(0)
      expect(ref.trustLevel).toBeDefined()
    }
  })

  it('信頼度レベルが正しく判定されること', () => {
    const formatted = formatReferences(sampleRefs)

    // PubMed -> academic
    const pubmedRef = formatted.find((f) => f.reference.url.includes('pubmed'))
    expect(pubmedRef).toBeDefined()
    expect(pubmedRef!.trustLevel).toBe('academic')

    // .go.jp / PMDA -> government
    const govRef = formatted.find((f) => f.reference.url.includes('pmda.go.jp'))
    expect(govRef).toBeDefined()
    expect(govRef!.trustLevel).toBe('government')

    // 学会 -> professional
    const profRef = formatted.find((f) => f.reference.source?.includes('学会'))
    expect(profRef).toBeDefined()
    expect(profRef!.trustLevel).toBe('professional')

    // ニュースメディア -> media
    const mediaRef = formatted.find((f) => f.reference.source?.includes('ニュース'))
    expect(mediaRef).toBeDefined()
    expect(mediaRef!.trustLevel).toBe('media')
  })

  it('信頼度の高い順にソートされること', () => {
    const formatted = formatReferences(sampleRefs)
    const trustOrder = { academic: 1, government: 2, professional: 3, media: 4, other: 5 }

    for (let i = 1; i < formatted.length; i++) {
      const currentOrder = trustOrder[formatted[i].trustLevel]
      const prevOrder = trustOrder[formatted[i - 1].trustLevel]
      expect(currentOrder).toBeGreaterThanOrEqual(prevOrder)
    }
  })

  it('APA風フォーマットが正しいこと', () => {
    const formatted = formatReferences([sampleRefs[1]])
    expect(formatted[0].formattedText).toContain('Kaufman KD, et al.')
    expect(formatted[0].formattedText).toContain('(1998)')
    expect(formatted[0].formattedText).toContain('Finasteride')
  })

  it('HTMLテキストにリンクが含まれること', () => {
    const formatted = formatReferences([sampleRefs[0]])
    expect(formatted[0].htmlText).toContain('<a href=')
    expect(formatted[0].htmlText).toContain('target="_blank"')
    expect(formatted[0].htmlText).toContain('rel="noopener noreferrer"')
  })

  it('HTMLテキストにdata-trust属性が含まれること', () => {
    const formatted = formatReferences([sampleRefs[0]])
    expect(formatted[0].htmlText).toContain('data-trust=')
  })

  it('空配列で空の結果を返すこと', () => {
    const formatted = formatReferences([])
    expect(formatted).toHaveLength(0)
  })
})

// ==============================================================
// generateUpdateInfo テスト
// ==============================================================

describe('generateUpdateInfo', () => {
  it('デフォルト値で更新情報を生成できること', () => {
    const info = generateUpdateInfo()

    expect(info.publishedAtText).toContain('公開日:')
    expect(info.updatedAtText).toContain('最終更新日:')
    expect(info.freshnessNote).toContain('時点のもの')
    expect(info.disclaimerText).toContain('免責事項')
    expect(info.disclaimerHtml).toContain('disclaimer-box')
  })

  it('指定日時で正しくフォーマットされること', () => {
    const info = generateUpdateInfo('2026-01-15T00:00:00Z', '2026-03-01T00:00:00Z')

    expect(info.publishedAtText).toContain('2026年1月15日')
    expect(info.updatedAtText).toContain('2026年3月1日')
    expect(info.freshnessNote).toContain('2026年3月')
  })

  it('AGAカテゴリの免責事項に治療関連の注意書きが含まれること', () => {
    const info = generateUpdateInfo(undefined, undefined, 'aga')
    expect(info.disclaimerText).toContain('医師の診察')
    expect(info.disclaimerText).toContain('自己判断')
  })

  it('EDカテゴリの免責事項に治療関連の注意書きが含まれること', () => {
    const info = generateUpdateInfo(undefined, undefined, 'ed')
    expect(info.disclaimerText).toContain('医師の診察')
  })

  it('脱毛カテゴリの免責事項に施術関連の注意書きが含まれること', () => {
    const info = generateUpdateInfo(undefined, undefined, 'hair-removal')
    expect(info.disclaimerText).toContain('個人差')
    expect(info.disclaimerText).toContain('カウンセリング')
  })

  it('スキンケアカテゴリの免責事項に化粧品関連の注意書きが含まれること', () => {
    const info = generateUpdateInfo(undefined, undefined, 'skincare')
    expect(info.disclaimerText).toContain('個人差')
    expect(info.disclaimerText).toContain('皮膚科')
  })

  it('サプリカテゴリの免責事項に食品関連の注意書きが含まれること', () => {
    const info = generateUpdateInfo(undefined, undefined, 'supplement')
    expect(info.disclaimerText).toContain('医薬品ではありません')
    expect(info.disclaimerText).toContain('医師・薬剤師')
  })

  it('全カテゴリでPR表記が含まれること', () => {
    const categories = ['aga', 'ed', 'hair-removal', 'skincare', 'supplement', 'column']
    for (const category of categories) {
      const info = generateUpdateInfo(undefined, undefined, category)
      expect(info.disclaimerText).toContain('アフィリエイト広告（PR）')
    }
  })

  it('免責事項HTMLにdisclaimer-boxクラスが含まれること', () => {
    const info = generateUpdateInfo(undefined, undefined, 'aga')
    expect(info.disclaimerHtml).toContain('class="disclaimer-box"')
    expect(info.disclaimerHtml).toContain('class="pr-disclosure"')
    expect(info.disclaimerHtml).toContain('class="freshness-note"')
  })
})

// ==============================================================
// getRecommendedReferencesForCategory テスト
// ==============================================================

describe('getRecommendedReferencesForCategory', () => {
  const categories = ['aga', 'ed', 'hair-removal', 'skincare', 'supplement', 'column']

  for (const category of categories) {
    it(`${category} カテゴリの推奨参考文献を取得できること`, () => {
      const refs = getRecommendedReferencesForCategory(category)
      expect(refs.length).toBeGreaterThan(0)

      for (const ref of refs) {
        expect(ref.title).toBeDefined()
        expect(ref.url).toBeDefined()
      }
    })
  }

  it('comparison が column にマッピングされること', () => {
    const compRefs = getRecommendedReferencesForCategory('comparison')
    const colRefs = getRecommendedReferencesForCategory('column')

    expect(compRefs.length).toBe(colRefs.length)
    expect(compRefs[0].title).toBe(colRefs[0].title)
  })

  it('返されたリストが元データのコピーであること（ミュータブルではないこと）', () => {
    const refs1 = getRecommendedReferencesForCategory('aga')
    const refs2 = getRecommendedReferencesForCategory('aga')

    expect(refs1).not.toBe(refs2) // 同じ参照ではない
    expect(refs1.length).toBe(refs2.length)
  })
})

// ==============================================================
// getMinimumReferenceCount テスト
// ==============================================================

describe('getMinimumReferenceCount', () => {
  it('医療系カテゴリ（AGA/ED）は最低4件であること', () => {
    expect(getMinimumReferenceCount('aga')).toBe(4)
    expect(getMinimumReferenceCount('ed')).toBe(4)
  })

  it('美容系カテゴリは最低3件であること', () => {
    expect(getMinimumReferenceCount('hair-removal')).toBe(3)
    expect(getMinimumReferenceCount('skincare')).toBe(3)
  })

  it('サプリカテゴリは最低3件であること', () => {
    expect(getMinimumReferenceCount('supplement')).toBe(3)
  })

  it('コラム等は最低2件であること', () => {
    expect(getMinimumReferenceCount('column')).toBe(2)
    expect(getMinimumReferenceCount('comparison')).toBe(2)
  })
})

// ==============================================================
// getAllSupervisorTemplates テスト
// ==============================================================

describe('getAllSupervisorTemplates', () => {
  it('全カテゴリのテンプレートが取得できること', () => {
    const templates = getAllSupervisorTemplates()
    const expectedKeys = ['aga', 'ed', 'hair-removal', 'skincare', 'supplement', 'column']

    for (const key of expectedKeys) {
      expect(templates[key]).toBeDefined()
    }
  })

  it('返されたオブジェクトが元データのコピーであること', () => {
    const templates1 = getAllSupervisorTemplates()
    const templates2 = getAllSupervisorTemplates()

    expect(templates1).not.toBe(templates2)
  })
})
