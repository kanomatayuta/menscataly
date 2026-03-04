/**
 * 環境変数バリデーション
 * 起動時に必須環境変数をチェックし、不足があれば警告/エラーを出力する
 */

// ============================================================
// 環境変数定義
// ============================================================

interface EnvVarDef {
  /** 環境変数名 */
  name: string
  /** 説明 */
  description: string
  /** 必須かどうか (本番環境) */
  required: boolean
  /** 開発環境でも必須かどうか */
  requiredInDev?: boolean
}

/** 必須環境変数一覧 */
const ENV_VARS: EnvVarDef[] = [
  // Supabase
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    description: 'Supabase プロジェクト URL',
    required: true,
    requiredInDev: false,
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    description: 'Supabase 匿名キー (RLS適用)',
    required: true,
    requiredInDev: false,
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    description: 'Supabase サービスロールキー (RLSバイパス)',
    required: true,
    requiredInDev: false,
  },

  // microCMS
  {
    name: 'MICROCMS_SERVICE_DOMAIN',
    description: 'microCMS サービスドメイン',
    required: true,
    requiredInDev: false,
  },
  {
    name: 'MICROCMS_API_KEY',
    description: 'microCMS APIキー',
    required: true,
    requiredInDev: false,
  },

  // 認証
  {
    name: 'ADMIN_API_KEY',
    description: '管理者APIキー',
    required: true,
    requiredInDev: false,
  },
  {
    name: 'PIPELINE_API_KEY',
    description: 'パイプラインAPIキー',
    required: true,
    requiredInDev: false,
  },

  // AI
  {
    name: 'ANTHROPIC_API_KEY',
    description: 'Anthropic APIキー (Claude)',
    required: true,
    requiredInDev: false,
  },

  // Cron (Vercel Cron Jobs)
  {
    name: 'CRON_SECRET',
    description: 'Vercel Cron Jobs 認証シークレット',
    required: false,
  },

  // Image
  {
    name: 'CLOUDINARY_CLOUD_NAME',
    description: 'Cloudinary クラウド名',
    required: false,
  },
  {
    name: 'CLOUDINARY_API_KEY',
    description: 'Cloudinary APIキー',
    required: false,
  },
  {
    name: 'CLOUDINARY_API_SECRET',
    description: 'Cloudinary APIシークレット',
    required: false,
  },
  {
    name: 'IDEOGRAM_API_KEY',
    description: 'Ideogram APIキー',
    required: false,
  },

  // ASP
  {
    name: 'A8_MEDIA_ID',
    description: 'A8.net メディアID',
    required: false,
  },
]

// ============================================================
// バリデーション結果
// ============================================================

export interface EnvValidationResult {
  valid: boolean
  missing: { name: string; description: string }[]
  warnings: { name: string; description: string }[]
}

// ============================================================
// バリデーション関数
// ============================================================

/**
 * 環境変数をバリデーションする
 * @returns バリデーション結果
 */
export function validateEnv(): EnvValidationResult {
  const isDev = process.env.NODE_ENV === 'development'
  const missing: { name: string; description: string }[] = []
  const warnings: { name: string; description: string }[] = []

  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.name]
    const isEmpty = !value || value.trim() === ''

    if (isEmpty) {
      if (isDev) {
        // 開発環境: requiredInDev が true の場合のみ必須
        if (envVar.requiredInDev) {
          missing.push({ name: envVar.name, description: envVar.description })
        } else if (envVar.required) {
          warnings.push({ name: envVar.name, description: envVar.description })
        }
      } else {
        // 本番環境
        if (envVar.required) {
          missing.push({ name: envVar.name, description: envVar.description })
        }
      }
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  }
}

/**
 * 環境変数をバリデーションし、結果をコンソールに出力する
 * 本番環境で必須変数が不足している場合は例外を投げる
 */
export function validateEnvOrThrow(): void {
  const result = validateEnv()

  // 警告を出力
  if (result.warnings.length > 0) {
    console.warn(
      '[EnvCheck] Missing optional environment variables:',
      result.warnings.map((w) => `${w.name} (${w.description})`).join(', ')
    )
  }

  // 必須変数の不足
  if (!result.valid) {
    const errorMsg = result.missing
      .map((m) => `  - ${m.name}: ${m.description}`)
      .join('\n')

    const fullMsg = `[EnvCheck] Missing required environment variables:\n${errorMsg}`

    if (process.env.NODE_ENV === 'production') {
      throw new Error(fullMsg)
    } else {
      console.error(fullMsg)
    }
  }
}

/**
 * 特定の環境変数を取得する (型安全)
 * 未設定の場合は例外を投げる
 */
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.trim() === '') {
    throw new Error(`Required environment variable ${name} is not set`)
  }
  return value
}

/**
 * 特定の環境変数を取得する (デフォルト値あり)
 */
export function getEnv(name: string, defaultValue: string): string {
  const value = process.env[name]
  if (!value || value.trim() === '') {
    return defaultValue
  }
  return value
}
