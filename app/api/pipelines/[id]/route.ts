import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { pipelines } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
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

const putSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  graphJson: z.object({
    nodes: z.array(nodeSchema),
    edges: z.array(edgeSchema),
  }).optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [pipeline] = await db.select().from(pipelines).where(eq(pipelines.id, id))

  if (!pipeline) {
    return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })
  }

  return NextResponse.json(pipeline)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const [pipeline] = await db
    .update(pipelines)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(pipelines.id, id))
    .returning()

  if (!pipeline) {
    return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })
  }

  return NextResponse.json(pipeline)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [pipeline] = await db.delete(pipelines).where(eq(pipelines.id, id)).returning()

  if (!pipeline) {
    return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
