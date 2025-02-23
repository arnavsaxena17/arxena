import { IconComponent, IconFileText, IconVideo } from 'twenty-ui';

type QuestionOrAnswer = {
  label: string;
  value: string;
  Icon: IconComponent;
};

type QuestionOrAnswerType = QuestionOrAnswer[];

export const questionOrAnswerOptions: QuestionOrAnswerType = [
  {
    label: 'Video',
    value: 'VIDEO',
    Icon: IconVideo,
  },
  {
    label: 'Text',
    value: 'TEXT',
    Icon: IconFileText,
  },
];
