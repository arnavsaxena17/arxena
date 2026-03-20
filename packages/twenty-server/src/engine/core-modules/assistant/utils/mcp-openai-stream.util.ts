import OpenAI from 'openai';
import { StreamEventSender } from '../assistant.types';

export const consumeOpenAIStream = async (
  stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
  sendEvent: StreamEventSender,
): Promise<{
  content: string;
  toolCallsList: Array<{
    id: string;
    name: string;
    args: string;
    index: number;
  }>;
}> => {
  let content = '';
  const toolCallsAccum = new Map<
    number,
    { id: string; name: string; args: string; index: number }
  >();
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    if (!delta) continue;
    if (delta.content) {
      content += delta.content;
      sendEvent('text', { delta: delta.content });
    }
    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;
        const cur = toolCallsAccum.get(idx) ?? {
          id: tc.id ?? '',
          name: tc.function?.name ?? '',
          args: tc.function?.arguments ?? '',
          index: idx,
        };
        if (tc.id) cur.id = tc.id;
        if (tc.function?.name) cur.name = tc.function.name;
        if (tc.function?.arguments) cur.args += tc.function.arguments;
        toolCallsAccum.set(idx, cur);
      }
    }
  }
  const toolCallsList = [...toolCallsAccum.values()]
    .filter((t) => t.id && t.name)
    .sort((a, b) => a.index - b.index);
  return { content, toolCallsList };
};
