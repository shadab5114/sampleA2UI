import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, AgentMessage, LLMResponse, ToolDef, ToolCall } from './types';

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async chat(
    messages: AgentMessage[],
    tools: ToolDef[],
    _jsonMode = false, // Anthropic relies on system-prompt JSON instruction instead
  ): Promise<LLMResponse> {
    const model = process.env.A2UI_MODEL ?? 'claude-sonnet-4-6';

    // System prompt is a first-class param in Anthropic — not a message
    const systemMsg = messages.find((m) => m.role === 'system');
    const system = systemMsg?.content ?? '';
    const rest = messages.filter((m) => m.role !== 'system');

    const anthropicMessages = this.toAnthropicMessages(rest);

    const anthropicTools: Anthropic.Tool[] = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Anthropic.Tool['input_schema'],
    }));

    const response = await this.client.messages.create({
      model,
      max_tokens: 4096,
      system,
      messages: anthropicMessages,
      tools: anthropicTools,
    });

    if (response.stop_reason === 'tool_use') {
      const toolCalls: ToolCall[] = response.content
        .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
        .map((b) => ({
          id: b.id,
          name: b.name,
          arguments: JSON.stringify(b.input),
        }));
      return { content: null, toolCalls, done: false };
    }

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === 'text',
    );
    return { content: textBlock?.text ?? null, toolCalls: [], done: true };
  }

  // Converts AgentMessage[] → Anthropic.MessageParam[].
  // Key rules:
  //   • assistant messages with tool calls become content arrays
  //   • consecutive tool_result messages collapse into one user message
  private toAnthropicMessages(messages: AgentMessage[]): Anthropic.MessageParam[] {
    const result: Anthropic.MessageParam[] = [];
    let i = 0;

    while (i < messages.length) {
      const m = messages[i];

      if (m.role === 'user') {
        result.push({ role: 'user', content: m.content });
        i++;
        continue;
      }

      if (m.role === 'assistant') {
        const content: Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam> = [];
        if (m.content) content.push({ type: 'text', text: m.content });
        for (const tc of m.toolCalls ?? []) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: JSON.parse(tc.arguments) as Record<string, unknown>,
          });
        }
        result.push({ role: 'assistant', content });
        i++;
        continue;
      }

      if (m.role === 'tool_result') {
        // Batch all adjacent tool_result messages into a single user turn
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        while (i < messages.length && messages[i].role === 'tool_result') {
          const tr = messages[i] as Extract<AgentMessage, { role: 'tool_result' }>;
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tr.toolCallId,
            content: tr.content,
          });
          i++;
        }
        result.push({ role: 'user', content: toolResults });
        continue;
      }

      i++; // skip unknown
    }

    return result;
  }
}
