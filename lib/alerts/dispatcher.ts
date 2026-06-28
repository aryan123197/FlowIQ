import nodemailer from 'nodemailer'
import type { AlertRule } from '@/lib/db/schema'

export async function dispatchAlert(
  rule: AlertRule,
  value: number
): Promise<void> {
  const message = `Alert "${rule.name}" triggered: ${rule.metric} is ${value} (threshold: ${rule.comparisonOperator} ${rule.threshold})`

  if (rule.actionType === 'email') {
    const to = rule.actionConfig?.to
    if (!to) throw new Error(`Alert rule ${rule.id} has actionType=email but no "to" address configured`)

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject: `FlowIQ Alert: ${rule.name}`,
      text: message,
    })
  } else if (rule.actionType === 'slack') {
    const webhookUrl = rule.actionConfig?.webhookUrl
    if (!webhookUrl) throw new Error(`Alert rule ${rule.id} has actionType=slack but no "webhookUrl" configured`)

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    })

    if (!res.ok) throw new Error(`Slack webhook responded with status ${res.status}`)
  }
}
