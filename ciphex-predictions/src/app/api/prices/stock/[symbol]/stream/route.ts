import { NextRequest } from 'next/server';

const DATABENTO_SERVICE_URL = process.env.DATABENTO_SERVICE_URL || 'http://localhost:8080';
const CIPHEX_API_URL = process.env.CIPHEX_API_URL || 'https://api.ciphex.io';
const CIPHEX_API_KEY = process.env.CIPHEX_API_KEY || '';

// Poll interval for Ciphex price fallback (seconds)
const POLL_INTERVAL = 10;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;

  if (!symbol) {
    return new Response('Symbol is required', { status: 400 });
  }

  const encoder = new TextEncoder();

  // Try Databento first, fall back to Ciphex polling
  const databentoAvailable = await checkDatabento(symbol);

  const stream = new ReadableStream({
    async start(controller) {
      if (databentoAvailable) {
        await streamFromDatabento(symbol, controller, encoder);
      } else {
        await streamFromCiphexPolling(symbol, controller, encoder, request.signal);
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

async function checkDatabento(symbol: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${DATABENTO_SERVICE_URL}/api/stocks/${symbol.toUpperCase()}/candles?limit=1`,
      { signal: AbortSignal.timeout(2000) }
    );
    return response.ok;
  } catch {
    return false;
  }
}

async function streamFromDatabento(
  symbol: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
) {
  try {
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
      const text = decoder.decode(value, { stream: true });
      controller.enqueue(encoder.encode(text));
    }
  } catch {
    controller.enqueue(
      encoder.encode(
        `event: error\ndata: ${JSON.stringify({ error: 'Stock data service unavailable' })}\n\n`
      )
    );
  } finally {
    controller.close();
  }
}

async function streamFromCiphexPolling(
  symbol: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  abortSignal: AbortSignal
) {
  let lastTimestamp = 0;

  const poll = async () => {
    try {
      const response = await fetch(
        `${CIPHEX_API_URL}/v1/prices/latest?symbols=${encodeURIComponent(symbol.toUpperCase())}`,
        {
          headers: {
            'X-API-Key': CIPHEX_API_KEY,
          },
          signal: AbortSignal.timeout(8000),
        }
      );

      if (!response.ok) return;

      const data = await response.json();
      const priceEntry = data?.prices?.find(
        (p: { symbol: string }) => p.symbol.toUpperCase() === symbol.toUpperCase()
      );

      if (priceEntry && priceEntry.timestamp !== lastTimestamp) {
        lastTimestamp = priceEntry.timestamp;

        const candle = {
          time: priceEntry.timestamp,
          open: priceEntry.open,
          high: priceEntry.high,
          low: priceEntry.low,
          close: priceEntry.close,
          volume: priceEntry.volume ?? 0,
        };

        controller.enqueue(
          encoder.encode(`event: candle\ndata: ${JSON.stringify(candle)}\n\n`)
        );
      }
    } catch {
      // Silently ignore poll errors — next tick will retry
    }
  };

  // Initial poll
  await poll();

  // Continue polling until client disconnects
  const interval = setInterval(poll, POLL_INTERVAL * 1000);

  // Wait for abort (client disconnect)
  await new Promise<void>((resolve) => {
    abortSignal.addEventListener('abort', () => {
      clearInterval(interval);
      resolve();
    });
  });

  controller.close();
}
