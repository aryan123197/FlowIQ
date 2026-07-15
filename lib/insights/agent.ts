import Anthropic from '@anthropic-ai/sdk'
import { randomUUID } from 'crypto'
import { getRevenueTrend } from './tools/revenueTrend'
import { getAnomalies } from './tools/anomalies'
import { getPeriodComparison } from './tools/periodComparison'
import { getTopCustomers } from './tools/topCustomers'
import { getFailureRate } from './tools/failureRate'
import { getPlatformBreakdown } from './tools/platformBreakdown'
import { getCsvQuality } from './tools/csvQuality'
import { getTimeseriesData } from './tools/timeseries'
import type { Insight } from './types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_revenue_trend',
    description:
      'Get daily revenue buckets and trend slope over the last N days. Use to identify growth or decline patterns.',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: { type: 'number', description: 'Number of days to look back (default 30)' },
      },
      required: [],
    },
  },
  {
    name: 'get_anomalies',
    description: 'Detect days with abnormally high or low revenue using Z-score analysis.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sensitivitySigma: {
          type: 'number',
          description: 'Z-score threshold to flag as anomaly (default 2.0)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_period_comparison',
    description:
      'Compare revenue between current period and prior period (week-over-week or month-over-month).',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: { type: 'string', enum: ['week', 'month'], description: 'Comparison period' },
      },
      required: [],
    },
  },
  {
    name: 'get_top_customers',
    description: 'Get the top N customers by lifetime transaction value.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'Number of top customers to return (default 5)' },
      },
      required: [],
    },
  },
  {
    name: 'get_failure_rate',
    description:
      'Get the transaction failure rate for a recent window compared to a 7-day rolling average.',
    input_schema: {
      type: 'object' as const,
      properties: {
        windowHours: { type: 'number', description: 'Recent window in hours (default 24)' },
      },
      required: [],
    },
  },
  {
    name: 'get_platform_breakdown',
    description:
      'Get revenue and transaction count broken down by source platform (Stripe, Shopify, Salesforce, CSV).',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_timeseries_data',
    description:
      'Get the actual per-day, per-platform revenue rows for the last N days — the same underlying data the dashboard revenue chart and platform breakdown chart render. Use this to reason about the real shape of the series (step changes, plateaus, a platform dropping off) rather than just summary statistics.',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: { type: 'number', description: 'Number of days to look back (default 30, max 90)' },
      },
      required: [],
    },
  },
  {
    name: 'get_csv_quality',
    description:
      'Get raw upload details for the most recent CSV uploads: detected headers, total/error row counts, error rate, and sample rows that failed validation with the reason. Use this when get_platform_breakdown shows CSV-sourced data, to check for ingestion/data-quality problems.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'Number of recent uploads to inspect (default 3)' },
      },
      required: [],
    },
  },
]

interface ToolCallCache {
  lastTimeseriesRows?: { date: string; platform: string; revenue: number }[]
}

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  cache: ToolCallCache
): Promise<unknown> {
  switch (name) {
    case 'get_revenue_trend':
      return getRevenueTrend(input.days as number | undefined, cache.lastTimeseriesRows)
    case 'get_anomalies':
      return getAnomalies(input.sensitivitySigma as number | undefined)
    case 'get_period_comparison':
      return getPeriodComparison(input.period as 'week' | 'month' | undefined)
    case 'get_top_customers':
      return getTopCustomers(input.limit as number | undefined)
    case 'get_failure_rate':
      return getFailureRate(input.windowHours as number | undefined)
    case 'get_platform_breakdown':
      return getPlatformBreakdown()
    case 'get_timeseries_data': {
      const result = await getTimeseriesData(input.days as number | undefined)
      cache.lastTimeseriesRows = result.rows
      return result
    }
    case 'get_csv_quality':
      return getCsvQuality(input.limit as number | undefined)
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

export async function generateInsights(): Promise<Insight[]> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `You are an expert data analyst for a multi-platform e-commerce and CRM data integration platform.
      
Analyze the current data by calling the available tools. You should:
1. Call get_platform_breakdown first to understand the data landscape
2. Call get_timeseries_data to see the actual chart series (per-day, per-platform revenue) behind the dashboard charts
3. Call get_revenue_trend to identify growth patterns
4. Call get_period_comparison for month-over-month context
5. Call get_anomalies to flag unusual days
6. Call get_failure_rate to check transaction health
7. Call get_top_customers if there's significant revenue concentration
8. If get_platform_breakdown shows CSV-sourced data, call get_csv_quality to check for ingestion/data-quality problems worth surfacing

After gathering data, respond with a JSON array of insights. Each insight must have:
- id: unique string
- type: one of "trend"|"anomaly"|"period_comparison"|"top_customers"|"failure_rate"|"platform_breakdown"|"csv_quality"
- severity: "critical" (requires immediate action) | "warning" (worth monitoring) | "info" (positive or neutral)
- title: short, punchy title (max 60 chars)
- description: 1-2 sentence explanation with specific numbers
- value: the key numeric value (in dollars if revenue, as a ratio if rate)
- delta: percentage change (positive = increase, negative = decrease), null if not applicable
- recommendation: one actionable sentence

Return ONLY valid JSON array, no markdown, no explanation outside the array. If there is no data yet, return a single info insight explaining the platform is ready for data ingestion.`,
    },
  ]

  let loopCount = 0
  const MAX_LOOPS = 10
  const cache: ToolCallCache = {}

  while (loopCount < MAX_LOOPS) {
    loopCount++

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      tools: TOOLS,
      messages,
    })

    // Add assistant response to history
    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason === 'end_turn') {
      // Claude is done — extract JSON from text response
      const textBlock = response.content.find((b) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') return []

      try {
        const raw = JSON.parse(textBlock.text)
        const arr = Array.isArray(raw) ? raw : [raw]
        return arr.map((item) => ({
          ...item,
          id: item.id ?? randomUUID(),
          generatedAt: item.generatedAt ?? new Date().toISOString(),
        })) as Insight[]
      } catch {
        // Claude returned non-JSON text — wrap it
        return [
          {
            id: randomUUID(),
            type: 'trend' as const,
            severity: 'info' as const,
            title: 'Analysis complete',
            description: textBlock.text.slice(0, 200),
            recommendation: 'Review the full analysis in the dashboard.',
            generatedAt: new Date().toISOString(),
          },
        ]
      }
    }

    if (response.stop_reason === 'tool_use') {
      // Execute all requested tool calls
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue
        try {
          const result = await executeTool(
            block.name,
            block.input as Record<string, unknown>,
            cache
          )
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          })
        } catch (err) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: `Error: ${err instanceof Error ? err.message : String(err)}`,
            is_error: true,
          })
        }
      }

      messages.push({ role: 'user', content: toolResults })
    }
  }

  return []
}
