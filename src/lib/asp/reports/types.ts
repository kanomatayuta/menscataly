/**
 * ASPレポート共通型定義
 * IASPReportProvider インターフェース + 同期結果型
 */

/** ASPレポートの正規化された1レコード */
export interface NormalizedReportRecord {
  date: string // YYYY-MM-DD
  aspName: string
  programId: string
  programName: string
  impressions: number
  clicks: number
  conversionsPending: number
  conversionsConfirmed: number
  conversionsCancelled: number
  revenuePending: number
  revenueConfirmed: number
  revenueCancelled: number
  articleSlug?: string
  rawData?: Record<string, unknown>
}

/** レポート取得オプション */
export interface ReportFetchOptions {
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  programIds?: string[]
}

/** ASPレポートプロバイダーの共通インターフェース */
export interface IASPReportProvider {
  readonly aspName: string
  validateCredentials(): Promise<boolean>
  fetchReport(options: ReportFetchOptions): Promise<NormalizedReportRecord[]>
  isAvailable(): Promise<boolean>
}

/** 同期結果 */
export interface SyncResult {
  date: string
  providers: ProviderResult[]
  totalRecords: number
  errors: SyncError[]
}

/** プロバイダーごとの結果 */
export interface ProviderResult {
  aspName: string
  status: 'success' | 'skipped' | 'error'
  recordCount?: number
  reason?: string
}

/** 同期エラー */
export interface SyncError {
  aspName: string
  error: string
}
