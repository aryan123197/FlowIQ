import { db } from '@/lib/db/client'
import { alertRules, alertTriggers } from '@/lib/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { calculateMetric } from './metricCalculator'
import { dispatchAlert } from './dispatcher'
import type { AlertRule } from '@/lib/db/schema'

function breachesThreshold(value: number, operator: AlertRule['comparisonOperator'], threshold: number): boolean {
  switch (operator) {
    case 'gt': return value > threshold
    case 'lt': return value < threshold
    case 'gte': return value >= threshold
    case 'lte': return value <= threshold
    case 'eq': return value === threshold
  }
}

export async function evaluateAlerts(): Promise<void> {
  const rules = await db.select().from(alertRules).where(eq(alertRules.enabled, true))

  for (const rule of rules) {
    const value = await calculateMetric(rule.metric, rule.timeWindow)
    const breached = breachesThreshold(value, rule.comparisonOperator, Number(rule.threshold))

    const [unresolved] = await db
      .select()
      .from(alertTriggers)
      .where(and(eq(alertTriggers.ruleId, rule.id), isNull(alertTriggers.resolvedAt)))
      .limit(1)

    if (breached && !unresolved) {
      await db.insert(alertTriggers).values({
        ruleId: rule.id,
        value: value.toString(),
        context: { metric: rule.metric, timeWindow: rule.timeWindow },
      })

      try {
        await dispatchAlert(rule, value)
      } catch (err) {
        console.error(`[alerts] Failed to dispatch alert for rule ${rule.id}:`, err)
      }
    } else if (!breached && unresolved) {
      await db
        .update(alertTriggers)
        .set({ resolvedAt: new Date() })
        .where(eq(alertTriggers.id, unresolved.id))
    }
  }
}
