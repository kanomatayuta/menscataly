/**
 * GA4 Click Provider
 * GA4 Data API で affiliate_link_click イベントを集計し、
 * NormalizedReportRecord に変換する。
 *
 * 環境変数 GA4_PROPERTY_ID / GOOGLE_APPLICATION_CREDENTIALS 未設定時は
 * isAvailable() = false を返す。
 */

import type {
  IASPReportProvider,
  NormalizedReportRecord,
  ReportFetchOptions,
} from './types'

export class GA4ClickProvider implements IASPReportProvider {
  readonly aspName = 'ga4'

  async validateCredentials(): Promise<boolean> {
    return (
      !!process.env.GA4_PROPERTY_ID &&
      !!process.env.GOOGLE_APPLICATION_CREDENTIALS
    )
  }

  async isAvailable(): Promise<boolean> {
    return this.validateCredentials()
  }

  async fetchReport(options: ReportFetchOptions): Promise<NormalizedReportRecord[]> {
    if (!(await this.isAvailable())) {
      return []
    }

    // Dynamic import to avoid build errors when @google-analytics/data is not installed
    let BetaAnalyticsDataClient: unknown
    try {
      const mod = await (Function('return import("@google-analytics/data")')() as Promise<Record<string, unknown>>)
      BetaAnalyticsDataClient = mod.BetaAnalyticsDataClient
    } catch {
      console.warn('[GA4ClickProvider] @google-analytics/data not installed, skipping')
      return []
    }

    const propertyId = process.env.GA4_PROPERTY_ID!
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new (BetaAnalyticsDataClient as any)()

    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{
        startDate: options.startDate,
        endDate: options.endDate,
      }],
      dimensions: [
        { name: 'date' },
        { name: 'customEvent:asp_name' },
        { name: 'customEvent:program_id' },
        { name: 'pagePath' },
      ],
      metrics: [
        { name: 'eventCount' },
      ],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: {
            value: 'affiliate_link_click',
          },
        },
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (response.rows ?? []).map((row: any) => {
      const [date, aspName, programId, pagePath] =
        row.dimensionValues.map((d: { value: string }) => d.value)
      const clicks = parseInt(row.metricValues[0].value)
      const articleSlug = extractSlugFromPath(pagePath)

      return {
        date: formatGA4Date(date),
        aspName,
        programId,
        programName: '',
        impressions: 0,
        clicks,
        conversionsPending: 0,
        conversionsConfirmed: 0,
        conversionsCancelled: 0,
        revenuePending: 0,
        revenueConfirmed: 0,
        revenueCancelled: 0,
        articleSlug,
      }
    })
  }
}

/** /articles/{slug} → slug 抽出 */
export function extractSlugFromPath(pagePath: string): string | undefined {
  const match = pagePath.match(/^\/articles\/([^/?#]+)/)
  return match?.[1]
}

/** YYYYMMDD → YYYY-MM-DD */
export function formatGA4Date(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`
}
