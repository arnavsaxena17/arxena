import axios from 'axios';
import { ParsedJD } from '../types/ParsedJD';

export const syncChatQuestionsToDatabase = async ({
  parsedJD,
  jobId,
  apiToken,
}: {
  parsedJD: ParsedJD;
  jobId: string;
  apiToken?: string;
}): Promise<void> => {
  const currentQuestions = (parsedJD.chatFlow?.questions ?? [])
    .map((question) => question.trim())
    .filter(Boolean);

  if (currentQuestions.length === 0 || !apiToken) {
    return;
  }

  await axios.post(
    `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/update-chat-questions`,
    {
      jobId,
      chatQuestions: currentQuestions,
      previousQuestions: parsedJD.existingChatQuestions ?? [],
    },
    {
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    },
  );
};
