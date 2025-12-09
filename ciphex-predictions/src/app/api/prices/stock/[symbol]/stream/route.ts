import { NextRequest } from 'next/server';

const DATABENTO_SERVICE_URL = process.env.DATABENTO_SERVICE_URL || 'http://localhost:8080';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;

  if (!symbol) {
    return new Response('Symbol is required', { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Connect to the Databento SSE stream
        const url = `${DATABENTO_SERVICE_URL}/api/stocks/${symbol.toUpperCase()}/stream`;
        const response = await fetch(url);

        if (!response.ok || !response.body) {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ error: 'Failed to connect to stock data service' })}\n\n`
            )
          );
          controller.close();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Forward the SSE data
          const text = decoder.decode(value, { stream: true });
          controller.enqueue(encoder.encode(text));
        }
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ error: 'Stock data service unavailable' })}\n\n`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
