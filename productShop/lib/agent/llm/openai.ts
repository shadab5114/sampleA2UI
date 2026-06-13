import OpenAI from 'openai';
import type { LLMProvider, AgentMessage, LLMResponse, ToolDef, ToolCall } from './types';

type FnToolCall = { type: 'function'; id: string; function: { name: string; arguments: string } };

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async chat(
    messages: AgentMessage[],
    tools: ToolDef[],
    jsonMode = false,
  ): Promise<LLMResponse> {
    const model = process.env.A2UI_MODEL ?? 'gpt-4o';

    const oaiMessages: OpenAI.ChatCompletionMessageParam[] = [];
    for (const m of messages) {
      if (m.role === 'system') {
        oaiMessages.push({ role: 'system', content: m.content });
      } else if (m.role === 'user') {
        oaiMessages.push({ role: 'user', content: m.content });
      } else if (m.role === 'assistant') {
        oaiMessages.push({
          role: 'assistant',
          content: m.content ?? null,
          tool_calls: m.toolCalls?.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: tc.arguments },
          })),
        });
      } else if (m.role === 'tool_result') {
        oaiMessages.push({
          role: 'tool',
          tool_call_id: m.toolCallId,
          content: m.content,
        });
      }
    }

    const oaiTools: OpenAI.ChatCompletionTool[] = tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));

    const response = await this.client.chat.completions.create({
      model,
      messages: oaiMessages,
      tools: oaiTools,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    });

    const choice = response.choices[0];

    if (choice.finish_reason === 'tool_calls') {
      const toolCalls: ToolCall[] = ((choice.message.tool_calls ?? []) as FnToolCall[])
        .filter((tc) => tc.type === 'function')
        .map((tc) => ({ id: tc.id, name: tc.function.name, arguments: tc.function.arguments }));
      return { content: null, toolCalls, done: false };
    }

    return { content: choice.message.content ?? null, toolCalls: [], done: true };
  }
}
