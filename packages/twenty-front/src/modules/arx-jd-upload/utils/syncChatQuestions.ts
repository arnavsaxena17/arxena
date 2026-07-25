import axios from 'axios';
import { ParsedJD } from '../types/ParsedJD';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

export const syncChatQuestionsToDatabase = async ({
  parsedJD,
  projectId,
  apiToken,
}: {
  parsedJD: ParsedJD;
  projectId: string;
  apiToken?: string;
}): Promise<void> => {
  const currentQuestions = (parsedJD.chatFlow?.questions ?? [])
    .map((question) => question.trim())
    .filter(Boolean);

  if (currentQuestions.length === 0 || !apiToken) {
    return;
  }

  await axios.post(
    `${REACT_APP_SERVER_BASE_URL}/candidate-sourcing/update-chat-questions`,
    {
      projectId,
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
