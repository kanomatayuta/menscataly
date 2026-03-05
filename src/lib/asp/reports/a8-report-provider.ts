/**
 * A8.net Report Provider
 * Phase A: CSV手動インポート (管理画面DL → パース → Supabase)
 * Phase B: 成果連携API (申請・審査後)
 */

import type {
  IASPReportProvider,
  NormalizedReportRecord,
  ReportFetchOptions,
} from './types'

export class A8ReportProvider implements IASPReportProvider {
  readonly aspName = 'a8'

  async validateCredentials(): Promise<boolean> {
    // Phase A: CSVモードでは常にtrue
    return true
  }

  async isAvailable(): Promise<boolean> {
    // 23:30〜01:00 JST はメンテナンス
    const now = new Date()
    const jstHour = (now.getUTCHours() + 9) % 24
    const jstMin = now.getUTCMinutes()
    if (jstHour === 23 && jstMin >= 30) return false
    if (jstHour === 0) return false
    return true
  }

  async fetchReport(_options: ReportFetchOptions): Promise<NormalizedReportRecord[]> {
    const apiKey = process.env.A8_REPORT_API_KEY
    if (!apiKey) {
      throw new Error('A8 成果連携API未設定。CSVインポートを使用してください。')
    }

    // Phase B: API実装 (申請後)
    throw new Error('A8 API連携は申請・審査後に実装予定です。')
  }

  /**
   * Phase A: CSV手動インポート
   * A8.net管理画面からDLしたCSVをパースして正規化
   */
  importFromCSV(csvContent: string): NormalizedReportRecord[] {
    const rows = parseA8CSV(csvContent)
    return rows.map((row) => ({
      date: row['日付'] || row['date'] || '',
      aspName: 'a8',
      programId: row['プログラムID'] || row['program_id'] || `a8-unknown-${hashString(row['プログラム名'] || '')}`,
      programName: row['プログラム名'] || row['program_name'] || '',
      impressions: safeParseInt(row['インプレッション'] || row['impressions']),
      clicks: safeParseInt(row['クリック'] || row['clicks']),
      conversionsPending: safeParseInt(row['発生件数'] || row['conversions_pending']),
      conversionsConfirmed: safeParseInt(row['確定件数'] || row['conversions_confirmed']),
      conversionsCancelled: safeParseInt(row['キャンセル件数'] || row['conversions_cancelled']),
      revenuePending: safeParseFloat(row['発生報酬'] || row['revenue_pending']),
      revenueConfirmed: safeParseFloat(row['確定報酬'] || row['revenue_confirmed']),
      revenueCancelled: safeParseFloat(row['キャンセル報酬'] || row['revenue_cancelled']),
      rawData: row,
    }))
  }
}

/** A8 CSVをパースする。ヘッダー行検出→レコードパース */
export function parseA8CSV(csvContent: string): Record<string, string>[] {
  const lines = csvContent.trim().split('\n')
  if (lines.length < 2) return []

  // BOM除去
  const firstLine = lines[0].replace(/^\uFEFF/, '')

  // ヘッダー行を検出 (日付 or date を含む行)
  let headerIndex = -1
  const allLines = [firstLine, ...lines.slice(1)]
  for (let i = 0; i < allLines.length; i++) {
    if (allLines[i].includes('日付') || allLines[i].toLowerCase().includes('date')) {
      headerIndex = i
      break
    }
  }

  if (headerIndex === -1) {
    // ヘッダーが見つからない場合、最初の行をヘッダーとみなす
    headerIndex = 0
  }

  const headers = parseCSVLine(allLines[headerIndex])
  const records: Record<string, string>[] = []

  for (let i = headerIndex + 1; i < allLines.length; i++) {
    const line = allLines[i].trim()
    if (!line) continue
    const values = parseCSVLine(line)
    const record: Record<string, string> = {}
    headers.forEach((header, idx) => {
      record[header.trim()] = (values[idx] || '').trim()
    })
    records.push(record)
  }

  return records
}

/** CSVの1行をパースする (ダブルクォート対応) */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
  }
  result.push(current)
  return result
}

function safeParseInt(value: string | undefined): number {
  if (!value) return 0
  const cleaned = value.replace(/[,\s]/g, '')
  const parsed = parseInt(cleaned, 10)
  return isNaN(parsed) ? 0 : parsed
}

function safeParseFloat(value: string | undefined): number {
  if (!value) return 0
  const cleaned = value.replace(/[,\s]/g, '')
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : parsed
}

function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}
