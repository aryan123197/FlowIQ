import { NextRequest, NextResponse } from 'next/server'
import { generateInsights } from '@/lib/insights/agent'

export async function GET(_req: NextRequest) {
  try {
    const insights = await generateInsights()
    return NextResponse.json({ insights })
  } catch (err) {
    console.error('[insights] Error generating insights:', err)
    return NextResponse.json(
      { error: 'Failed to generate insights', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
