export type leftAndRightCombined = {
  id: string;
  leftQuestion: (questionNumber: number) => JSX.Element;
  rightQuestion: (questionNumber: number) => JSX.Element;
};

// import { v4 as uid } from 'uuid';

// import { QuestionNavElement } from '@/ai-interview/interview-creation/left-side/components/ai-interview-modal-nav-container/question/QuestionNavElement';
// import { AIInterviewQuestion } from '@/ai-interview/interview-creation/right-side/components/question/AIInterviewQuestion';
// import { leftAndRightCombined } from '@/ai-interview/interview-creation/types/leftAndRightCombined';

// const defaultQuestionID: string = uid();
// const defaultQuestionNumber = 1;

// export const defaultLeftAndRightValue: leftAndRightCombined[] = [
//   {
//     id: defaultQuestionID,
//     leftQuestion: () =>
//       QuestionNavElement({
//         id: defaultQuestionID,
//         questionNumber: defaultQuestionNumber,
//         deleteQuestion: () => {},
//       }),
//     rightQuestion: AIInterviewQuestion({ id: defaultQuestionID }),
//   },
// ];
