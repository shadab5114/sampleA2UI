import type { LLMProvider } from './types';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';

export type { LLMProvider, AgentMessage, LLMResponse, ToolDef, ToolCall } from './types';

/** Reads LLM_PROVIDER env var (default: 'openai') and returns the right adapter. */
export function createProvider(): LLMProvider {
  const name = (process.env.LLM_PROVIDER ?? 'openai').toLowerCase();
  if (name === 'anthropic') return new AnthropicProvider();
  return new OpenAIProvider();
}

export function activeProviderName(): string {
  return (process.env.LLM_PROVIDER ?? 'openai').toLowerCase();
}
