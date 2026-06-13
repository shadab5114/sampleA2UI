import { NextRequest, NextResponse } from 'next/server';
import { runAgent, CartItemData } from '@/lib/agent/agent';
import { activeProviderName } from '@/lib/agent/llm';
import { normalizeContext } from '@/lib/context/channelContext';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const cartItems: CartItemData[] | undefined = Array.isArray(body?.cartItems)
      ? body.cartItems
      : undefined;

    // Contextual Awareness: normalise the channel context from the request
    // (falls back to sensible defaults for any missing/invalid fields).
    const context = normalizeContext(body?.context);

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // Key check is per-provider — only the active provider's key is required
    const provider = activeProviderName();
    const keyName = provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
    if (!process.env[keyName]) {
      return NextResponse.json(
        { error: `${keyName} is not set. Add it to .env.local (LLM_PROVIDER=${provider}).` },
        { status: 503 },
      );
    }

    const { messages, decision } = await runAgent(message, cartItems, context);
    return NextResponse.json({ messages, decision });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[/api/agent]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
