import { db } from '@/lib/db/client'
import { transactions, pipelineOutputs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { runTransform } from './transformRegistry'
import type { Platform } from '@/types'

export interface GraphNode {
  id: string
  type: 'source' | 'transform' | 'sink'
  data: Record<string, unknown>
}

export async function executeNode(
  node: GraphNode,
  inputRows: Record<string, unknown>[],
  runId: string
): Promise<Record<string, unknown>[]> {
  switch (node.type) {
    case 'source': {
      const platform = node.data.platform as Platform | undefined
      const rows = await db
        .select()
        .from(transactions)
        .where(platform ? eq(transactions.sourcePlatform, platform) : undefined)
      return rows as unknown as Record<string, unknown>[]
    }

    case 'transform': {
      const ruleType = node.data.ruleType as string
      const config = (node.data.config as Record<string, unknown>) ?? {}
      return runTransform(ruleType, inputRows, config)
    }

    case 'sink': {
      if (inputRows.length > 0) {
        await db.insert(pipelineOutputs).values(
          inputRows.map((row) => ({ runId, nodeId: node.id, row }))
        )
      }
      return inputRows
    }

    default:
      throw new Error(`Unknown node type: ${(node as GraphNode).type}`)
  }
}
