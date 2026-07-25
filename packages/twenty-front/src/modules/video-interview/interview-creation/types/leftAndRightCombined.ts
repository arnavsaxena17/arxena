import type { ReactElement } from 'react';

export type leftAndRightCombined = {
  id: string;
  leftQuestion: (questionNumber: number) => ReactElement;
  rightQuestion: (questionNumber: number) => ReactElement;
};