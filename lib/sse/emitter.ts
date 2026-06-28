export type SSEPushFn = (event: string, data: unknown) => void

export function createSSEStream(
  handler: (push: SSEPushFn, close: () => void) => void | Promise<void>
): Response {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const push: SSEPushFn = (event, data) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          )
        } catch {
          // controller already closed
        }
      }

      const close = () => {
        try {
          controller.close()
        } catch {
          // already closed
        }
      }

      try {
        await handler(push, close)
      } catch (err) {
        push('error', { message: err instanceof Error ? err.message : 'Unknown error' })
        close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
