import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { pipelines } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'
import { z } from 'zod'

const nodeSchema = z.object({
  id: z.string(),
  type: z.enum(['source', 'transform', 'sink']),
  data: z.record(z.string(), z.unknown()),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
})

const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
})

const bodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  graphJson: z.object({
    nodes: z.array(nodeSchema),
    edges: z.array(edgeSchema),
  }),
})

export async function GET() {
  const rows = await db.select().from(pipelines).orderBy(desc(pipelines.createdAt))
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }

  const [pipeline] = await db
    .insert(pipelines)
    .values({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      graphJson: parsed.data.graphJson,
    })
    .returning()

  return NextResponse.json(pipeline, { status: 201 })
}
