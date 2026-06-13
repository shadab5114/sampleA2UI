import { NextRequest, NextResponse } from 'next/server';
import { handleAgentRequest, ApiError } from '@/lib/api/agentService';
import { PROTOCOL_VERSION } from '@/lib/api/contract';

// Thin transport adapter: parse HTTP → call the headless service → serialize.
// All real logic lives in lib/api/agentService.ts (Next-agnostic), so the same
// core can be mounted as a standalone Node/A2A server for native clients.

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await handleAgentRequest(body);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { protocolVersion: PROTOCOL_VERSION, error: { code: err.code, message: err.message } },
        { status: err.status },
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error('[/api/agent]', message);
    return NextResponse.json(
      { protocolVersion: PROTOCOL_VERSION, error: { code: 'internal_error', message } },
      { status: 500 },
    );
  }
}
