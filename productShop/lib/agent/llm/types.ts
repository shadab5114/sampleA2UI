// Provider-agnostic types for the agent loop.
// Both adapters (OpenAI, Anthropic) speak this language so agent.ts
// has zero provider-specific code.

export interface ToolDef {
  name: string;
  description: string;
  /** JSON Schema object (same shape accepted by both providers) */
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string; // JSON-serialised input
}

export type AgentMessage =
  | { role: 'system';      content: string }
  | { role: 'user';        content: string }
  | { role: 'assistant';   content: string | null; toolCalls?: ToolCall[] }
  | { role: 'tool_result'; toolCallId: string; content: string };

export interface LLMResponse {
  content: string | null;
  toolCalls: ToolCall[];
  /** false = model wants tool results; true = final text response */
  done: boolean;
}

export interface LLMProvider {
  chat(
    messages: AgentMessage[],
    tools: ToolDef[],
    jsonMode?: boolean,
  ): Promise<LLMResponse>;
}
