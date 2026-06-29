import { ParsedJD } from '../types/ParsedJD';

type CreateCandidateField = (input: {
  name: string;
  jobsId: string;
  candidateFieldType: string;
}) => Promise<unknown>;

type UpdateCandidateField = (input: {
  idToUpdate: string;
  updateOneRecordInput: { name: string };
}) => Promise<unknown>;

export const syncChatQuestionsToDatabase = async ({
  parsedJD,
  jobId,
  createOneCandidateFieldRecord,
  updateOneCandidateFieldRecord,
}: {
  parsedJD: ParsedJD;
  jobId: string;
  createOneCandidateFieldRecord: CreateCandidateField;
  updateOneCandidateFieldRecord: UpdateCandidateField;
}): Promise<void> => {
  const currentQuestions = parsedJD.chatFlow?.questions ?? [];
  if (currentQuestions.length === 0) {
    return;
  }

  const existingSnapshot = parsedJD.existingChatQuestions ?? [];
  const fieldIds = parsedJD.chatQuestionFieldIds ?? [];

  const updatePromises: Promise<unknown>[] = [];

  for (let index = 0; index < existingSnapshot.length; index++) {
    const fieldId = fieldIds[index];
    const newName = currentQuestions[index]?.trim();
    const oldName = existingSnapshot[index]?.trim();

    if (
      fieldId &&
      newName &&
      oldName &&
      newName.toLowerCase() !== oldName.toLowerCase()
    ) {
      updatePromises.push(
        updateOneCandidateFieldRecord({
          idToUpdate: fieldId,
          updateOneRecordInput: { name: newName },
        }),
      );
    }
  }

  const createPromises: Promise<unknown>[] = [];

  for (let index = existingSnapshot.length; index < currentQuestions.length; index++) {
    const name = currentQuestions[index]?.trim();
    if (name) {
      createPromises.push(
        createOneCandidateFieldRecord({
          name,
          jobsId: jobId,
          candidateFieldType: 'Text',
        }),
      );
    }
  }

  await Promise.all([...updatePromises, ...createPromises]);
};
