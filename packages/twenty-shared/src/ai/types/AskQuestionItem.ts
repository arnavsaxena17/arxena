import { type AskQuestionOption } from '@/ai/types/AskQuestionOption';

export type AskQuestionItem = {
  header: string;
  question: string;
  options: AskQuestionOption[];
  allowMultiSelect?: boolean;
  // The user can always type an answer; these say that the free text is the
  // expected way to give the exact requirement, not a last resort
  allowFreeText?: boolean;
  freeTextHint?: string;
};
