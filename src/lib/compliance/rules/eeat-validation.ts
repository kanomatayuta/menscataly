/**
 * E-E-A-T バリデーター
 * Experience（経験）, Expertise（専門性）, Authoritativeness（権威性）,
 * Trustworthiness（信頼性）の各次元でスコアリング
 *
 * YMYL（Your Money or Your Life）コンテンツとしての品質基準を検証
 */

import type { Article } from '@/types/content'

// ============================================================
// 型定義
// ============================================================

/** E-E-A-T スコア */
export interface EEATScore {
  /** 総合スコア (0-100) */
  total: number
  /** Experience スコア (0-25) */
  experience: number
  /** Expertise スコア (0-25) */
  expertise: number
  /** Authoritativeness スコア (0-25) */
  authoritativeness: number
  /** Trustworthiness スコア (0-25) */
  trustworthiness: number
  /** 採点詳細 */
  details: string[]
}

// ============================================================
// バリデーター
// ============================================================

/**
 * E-E-A-T バリデーター
 *
 * 各次元を 0-25 点でスコアリングし、合計 0-100 点で評価する。
 *
 * @example
 * ```ts
 * const validator = new EEATValidator();
 * const score = validator.validate(article);
 * console.log(score.total); // 75
 * console.log(score.details); // ['参考文献が3件以上含まれています (+5)', ...]
 * ```
 */
export class EEATValidator {
  /**
   * 記事の E-E-A-T スコアを算出する
   * @param article 評価対象の記事
   * @returns E-E-A-T スコア
   */
  validate(article: Article): EEATScore {
    const details: string[] = []

    const experience = this.scoreExperience(article, details)
    const expertise = this.scoreExpertise(article, details)
    const authoritativeness = this.scoreAuthoritativeness(article, details)
    const trustworthiness = this.scoreTrustworthiness(article, details)

    const total = experience + expertise + authoritativeness + trustworthiness

    return {
      total,
      experience,
      expertise,
      authoritativeness,
      trustworthiness,
      details,
    }
  }

  // ============================================================
  // Experience（経験）スコアリング — 0-25
  // ============================================================

  private scoreExperience(article: Article, details: string[]): number {
    let score = 0
    const content = article.content

    // 体験・実績に言及しているか
    const experiencePatterns = [
      /実際に/,
      /体験/,
      /経験/,
      /使用してみ/,
      /試してみ/,
      /受けてみ/,
      /症例/,
      /実績/,
      /利用者の声/,
      /ユーザーレビュー/,
    ]
    const experienceMatches = experiencePatterns.filter((p) => p.test(content))
    if (experienceMatches.length >= 3) {
      score += 10
      details.push('Experience: 体験・実績への言及が十分です (+10)')
    } else if (experienceMatches.length >= 1) {
      score += 5
      details.push(`Experience: 体験・実績への言及が${experienceMatches.length}件あります (+5)`)
    } else {
      details.push('Experience: 体験・実績への言及がありません (0)')
    }

    // 具体的な数値データの引用があるか
    const dataPatterns = [
      /\d+[%％]/,
      /\d+[人名例件]/,
      /\d+年/,
      /調査/,
      /臨床/,
      /データ/,
    ]
    const dataMatches = dataPatterns.filter((p) => p.test(content))
    if (dataMatches.length >= 3) {
      score += 10
      details.push('Experience: 具体的なデータ・数値の引用が豊富です (+10)')
    } else if (dataMatches.length >= 1) {
      score += 5
      details.push(`Experience: 具体的なデータ・数値の引用が${dataMatches.length}件あります (+5)`)
    } else {
      details.push('Experience: 具体的なデータ・数値の引用がありません (0)')
    }

    // セクション構成の充実度
    if (article.sections.length >= 5) {
      score += 5
      details.push('Experience: 記事のセクション数が十分です (+5)')
    } else if (article.sections.length >= 3) {
      score += 3
      details.push(`Experience: セクション数は${article.sections.length}件です (+3)`)
    } else {
      details.push(`Experience: セクション数が不足しています（${article.sections.length}件） (0)`)
    }

    return Math.min(25, score)
  }

  // ============================================================
  // Expertise（専門性）スコアリング — 0-25
  // ============================================================

  private scoreExpertise(article: Article, details: string[]): number {
    let score = 0
    const content = article.content

    // 監修者情報の有無
    if (article.supervisor) {
      if (article.supervisor.credentials && article.supervisor.credentials.length > 0) {
        score += 10
        details.push('Expertise: 監修者の資格情報が記載されています (+10)')
      } else {
        score += 5
        details.push('Expertise: 監修者情報がありますが、資格情報が不足しています (+5)')
      }
    } else {
      details.push('Expertise: 監修者情報が設定されていません (0)')
    }

    // 専門用語の適切な使用
    const medicalTermPatterns = [
      /フィナステリド|デュタステリド|ミノキシジル/,
      /DHT|5αリダクターゼ|テストステロン/,
      /シルデナフィル|タダラフィル|バルデナフィル/,
      /レーザー|IPL|ダイオード/,
      /レチノール|ナイアシンアミド|ビタミンC誘導体|セラミド/,
      /ガイドライン|エビデンス|RCT|臨床試験/,
    ]
    const termMatches = medicalTermPatterns.filter((p) => p.test(content))
    if (termMatches.length >= 3) {
      score += 8
      details.push('Expertise: 専門用語が適切に使用されています (+8)')
    } else if (termMatches.length >= 1) {
      score += 4
      details.push(`Expertise: 専門用語の使用が${termMatches.length}件あります (+4)`)
    } else {
      details.push('Expertise: 専門用語の使用が不足しています (0)')
    }

    // 著者情報の質
    if (article.author) {
      if (article.author.bio && article.author.bio.length >= 30) {
        score += 4
        details.push('Expertise: 著者プロフィールが充実しています (+4)')
      } else {
        score += 2
        details.push('Expertise: 著者情報がありますが、プロフィールが簡素です (+2)')
      }
    } else {
      details.push('Expertise: 著者情報が設定されていません (0)')
    }

    // カテゴリに応じた専門知識の反映
    if (article.category && content.length > 500) {
      score += 3
      details.push('Expertise: カテゴリ専門のコンテンツが十分な量で記載されています (+3)')
    }

    return Math.min(25, score)
  }

  // ============================================================
  // Authoritativeness（権威性）スコアリング — 0-25
  // ============================================================

  private scoreAuthoritativeness(article: Article, details: string[]): number {
    let score = 0

    // 参考文献の数
    const refCount = article.references.length
    if (refCount >= 5) {
      score += 10
      details.push(`Authoritativeness: 参考文献が${refCount}件あります (+10)`)
    } else if (refCount >= 3) {
      score += 7
      details.push(`Authoritativeness: 参考文献が${refCount}件あります (+7)`)
    } else if (refCount >= 1) {
      score += 3
      details.push(`Authoritativeness: 参考文献が${refCount}件あります (+3)`)
    } else {
      details.push('Authoritativeness: 参考文献がありません (0)')
    }

    // 権威性の高い参考文献（政府機関、学会、PubMed）
    const authoritativeSources = [
      /mhlw\.go\.jp/,       // 厚生労働省
      /pmda\.go\.jp/,       // PMDA
      /caa\.go\.jp/,        // 消費者庁
      /dermatol\.or\.jp/,   // 日本皮膚科学会
      /urol\.or\.jp/,       // 日本泌尿器科学会
      /pubmed/i,            // PubMed
      /ncbi\.nlm\.nih/,     // NCBI
      /jslsm\.gr\.jp/,      // 日本レーザー医学会
    ]
    const authoritativeRefs = article.references.filter((r) =>
      authoritativeSources.some((p) => p.test(r.url))
    )
    if (authoritativeRefs.length >= 3) {
      score += 10
      details.push(`Authoritativeness: 権威性の高い参考文献が${authoritativeRefs.length}件あります (+10)`)
    } else if (authoritativeRefs.length >= 1) {
      score += 5
      details.push(`Authoritativeness: 権威性の高い参考文献が${authoritativeRefs.length}件あります (+5)`)
    } else {
      details.push('Authoritativeness: 権威性の高い参考文献（政府機関・学会・PubMed）がありません (0)')
    }

    // 監修者の権威性
    if (article.supervisor?.credentials) {
      const highCredentials = /専門医|認定医|教授|准教授|学会/
      if (highCredentials.test(article.supervisor.credentials)) {
        score += 5
        details.push('Authoritativeness: 監修者に高い権威性があります (+5)')
      } else {
        score += 2
        details.push('Authoritativeness: 監修者の権威性は中程度です (+2)')
      }
    } else {
      details.push('Authoritativeness: 監修者の権威性を評価できません (0)')
    }

    return Math.min(25, score)
  }

  // ============================================================
  // Trustworthiness（信頼性）スコアリング — 0-25
  // ============================================================

  private scoreTrustworthiness(article: Article, details: string[]): number {
    let score = 0
    const content = article.content

    // 公開日・更新日の記載
    if (article.publishedAt) {
      score += 3
      details.push('Trustworthiness: 公開日が記載されています (+3)')
    } else {
      details.push('Trustworthiness: 公開日が未設定です (0)')
    }
    if (article.updatedAt) {
      score += 3
      details.push('Trustworthiness: 更新日が記載されています (+3)')
    } else {
      details.push('Trustworthiness: 更新日が未設定です (0)')
    }

    // PR表記の有無
    if (article.hasPRDisclosure) {
      score += 5
      details.push('Trustworthiness: PR表記が含まれています (+5)')
    } else {
      details.push('Trustworthiness: PR表記がありません (0)')
    }

    // コンプライアンス情報
    if (article.isCompliant) {
      score += 4
      details.push('Trustworthiness: コンプライアンスチェック合格です (+4)')
    } else {
      details.push('Trustworthiness: コンプライアンスチェック未合格です (0)')
    }

    // 個人差・注意書きの記載
    const disclaimerPatterns = [
      /個人差/,
      /効果には.*差があります/,
      /※/,
      /注意/,
      /医師.*相談/,
      /専門医.*ご相談/,
      /自己判断.*避け/,
    ]
    const disclaimerMatches = disclaimerPatterns.filter((p) => p.test(content))
    if (disclaimerMatches.length >= 3) {
      score += 5
      details.push('Trustworthiness: 注意書き・免責事項が十分に記載されています (+5)')
    } else if (disclaimerMatches.length >= 1) {
      score += 3
      details.push(`Trustworthiness: 注意書き・免責事項が${disclaimerMatches.length}件あります (+3)`)
    } else {
      details.push('Trustworthiness: 注意書き・免責事項がありません (0)')
    }

    // 情報鮮度の注記
    const freshnessPatterns = [
      /情報は.*時点/,
      /最新情報は.*確認/,
      /価格.*変更.*場合/,
      /YYYY年|20[2-3]\d年/,
    ]
    const hasFreshnessNote = freshnessPatterns.some((p) => p.test(content))
    if (hasFreshnessNote) {
      score += 5
      details.push('Trustworthiness: 情報鮮度に関する注記があります (+5)')
    } else {
      details.push('Trustworthiness: 情報鮮度に関する注記がありません (0)')
    }

    return Math.min(25, score)
  }
}
