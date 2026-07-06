/**
 * GET /api/cases/[caseNumber]/activation/stream
 *
 * Guest-accessible SSE that pushes cascade step/asset completions live to the
 * Recovery Kit success screen. Purely additive — the client also polls the
 * durable /recovery-kit read, so losing this stream never loses data.
 */

import prisma from '@/app/lib/prisma';
import { cascadeConnections } from '@/app/lib/sse/cascadeStream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { caseNumber } = params;

  // Only open a stream for a real case (avoid unbounded map growth from probes).
  const exists = await prisma.caseActivation.findUnique({
    where: { caseNumber },
    select: { id: true },
  });
  if (!exists) return new Response('Not found', { status: 404 });

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', caseNumber })}\n\n`));

      if (!cascadeConnections.has(caseNumber)) cascadeConnections.set(caseNumber, new Set());
      cascadeConnections.get(caseNumber).add(controller);

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        const set = cascadeConnections.get(caseNumber);
        if (set) {
          set.delete(controller);
          if (set.size === 0) cascadeConnections.delete(caseNumber);
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
