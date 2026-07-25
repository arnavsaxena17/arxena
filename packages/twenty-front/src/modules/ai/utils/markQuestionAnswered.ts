import { isToolUIPart } from 'ai';
import type { AskQuestionAnswer, AskQuestionsToolResult, ExtendedUIMessage, ExtendedUIMessagePart } from 'twenty-shared/ai';
import { isDefined } from 'twenty-shared/utils';

export const markQuestionAnswered = (
  messages: ExtendedUIMessage[],
  messageId: string,
  toolCallId: string,
  answers: AskQuestionAnswer[],
): ExtendedUIMessage[] =>
  messages.map((message) => {
    if (message.id !== messageId) {
      return message;
    }

    return {
      ...message,
      parts: message.parts.map((part) => {
        if (!isToolUIPart(part) || part.toolCallId !== toolCallId) {
          return part;
        }

        const previousOutput = isDefined(part.output)
          ? (part.output as Record<string, unknown>)
          : {};
        const previousResult = previousOutput.result as
          | AskQuestionsToolResult
          | undefined;

        return {
          ...part,
          output: {
            ...previousOutput,
            result: {
              questions: previousResult?.questions ?? [],
              status: 'answered',
              answers,
            } satisfies AskQuestionsToolResult,
          },
        } as ExtendedUIMessagePart;
      }),
    };
  });
