
import { type IconComponent } from 'twenty-ui';
import { IconVideo, IconFileText } from 'twenty-ui/icons';

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
