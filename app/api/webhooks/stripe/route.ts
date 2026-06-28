import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { db } from '@/lib/db/client'
import { transactions } from '@/lib/db/schema'
import { stripeChargeToUnified } from '@/lib/normalization/adapters/stripe.adapter'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '')

const CHARGE_EVENTS = new Set([
  'charge.succeeded',
  'charge.failed',
  'charge.refunded',
  'charge.updated',
])

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Missing stripe-signature header or webhook secret' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    return NextResponse.json(
      { error: `Webhook verification failed: ${err instanceof Error ? err.message : 'Unknown'}` },
      { status: 400 }
    )
  }

  if (CHARGE_EVENTS.has(event.type)) {
    const charge = event.data.object as Stripe.Charge
    const unified = stripeChargeToUnified(charge)

    await db
      .insert(transactions)
      .values({
        customerId: null,
        sourcePlatform: 'stripe',
        sourceTransactionId: unified.sourceTransactionId,
        amount: unified.amount,
        currency: unified.currency,
        status: unified.status,
        transactionDate: unified.transactionDate,
        rawPayload: unified.rawPayload ?? {},
      })
      .onConflictDoUpdate({
        target: [transactions.sourcePlatform, transactions.sourceTransactionId],
        set: {
          status: unified.status,
          amount: unified.amount,
          rawPayload: unified.rawPayload ?? {},
        },
      })
  }

  return NextResponse.json({ received: true })
}
